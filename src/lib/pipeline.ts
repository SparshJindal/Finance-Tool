import { prisma } from "@/lib/db";
import { getNews } from "@/lib/providers/news";
import crypto from "crypto";
import stringSimilarity from "string-similarity";
import { evaluateCandidates, judgeHoldingArticles } from "@/lib/providers/summary";
import { fetchArticleExcerpt } from "@/lib/providers/extract";
import { fetchQuote } from "@/lib/providers/quote";

export async function ingestNews(userId?: string, runEvaluation: boolean = true, targetHoldingIds?: string[], skipHeavyApis: boolean = false) {
  console.log(`[ingestNews] Starting pipeline... ${userId ? `(User: ${userId})` : '(Global)'}`);
  
  // 1. Gather all unique targets
  const holdings = await prisma.holding.findMany({ 
    where: { 
      userId,
      ...(targetHoldingIds ? { id: { in: targetHoldingIds } } : {})
    },
    include: { questions: true } 
  });
  
  const holdingIds = holdings.map(h => h.id);
  
  const competitors = await prisma.competitor.findMany({ 
    where: holdingIds.length > 0 ? { holdingId: { in: holdingIds } } : undefined,
    select: { ticker: true, name: true, holdingId: true } 
  });
  
  // We no longer build a targetTickers map and fetch everything at once.
  // Instead, we process each holding individually, wrapped in a robust try/catch.
  let upsertedCount = 0;
  let clustersFormed = 0;
  let totalFindingsSaved = 0;
  const pushMinSeverity = parseInt(process.env.PUSH_MIN_SEVERITY || "3", 10);
  const maxArticles = parseInt(process.env.MAX_ARTICLES_PER_RUN || "150", 10);

  for (let i = 0; i < holdings.length; i++) {
    const h = holdings[i];
    try {
      console.log(`[ingestNews] Processing holding ${i + 1}/${holdings.length}: ${h.ticker} (${h.company})`);
      
      const targetTicker = {
        holdingId: h.id,
        symbol: h.ticker,
        name: h.company,
        exchange: h.exchange,
        sector: h.sector || undefined,
        themes: h.themes
      };

      // 1. Fetch News for this holding
      const rawArticles = await getNews([targetTicker], skipHeavyApis);
      
      // 2. Pre-filter
      const filteredArticles = rawArticles.filter(art => {
        return art.title && art.title !== "No Title" && art.title.trim().length > 0;
      });
      const articlesToProcess = filteredArticles.slice(0, maxArticles);

      if (articlesToProcess.length === 0) {
        console.log(`[ingestNews] No articles found for ${h.ticker}. Moving to next holding.`);
        // Update lastIngestedAt even if no news found, so it goes to back of queue
        await prisma.holding.update({ where: { id: h.id }, data: { lastIngestedAt: new Date() }});
        continue;
      }

      // 3. Excerpts
      const articles = [];
      const chunkSize = 10;
      let skippedScrapes = 0;
      for (let j = 0; j < articlesToProcess.length; j += chunkSize) {
        const chunk = articlesToProcess.slice(j, j + chunkSize);
        const chunkWithExcerpts = await Promise.all(
          chunk.map(async (art) => {
            if (art.excerpt && art.excerpt.trim().length > 50) {
              skippedScrapes++;
              return { ...art };
            }
            const excerpt = await fetchArticleExcerpt(art.url);
            return { ...art, excerpt };
          })
        );
        articles.push(...chunkWithExcerpts);
      }
      if (skippedScrapes > 0) {
        console.log(`[ingestNews] ${h.ticker}: Skipped ${skippedScrapes} live scrapes.`);
      }

      // 4. Hash & Upsert
      for (const art of articles) {
        const contentHash = crypto.createHash('md5').update(art.url + art.title).digest('hex');
        try {
          await prisma.article.upsert({
            where: { url: art.url },
            update: {},
            create: {
              url: art.url,
              title: art.title,
              source: art.source,
              publishedAt: art.publishedAt,
              contentHash,
              excerpt: art.excerpt,
            }
          });
          upsertedCount++;
        } catch (e) {
          console.error(`[ingestNews] Failed to upsert ${art.url}:`, e);
        }
      }

      // 5. Direct LLM Judgment
      const fetchedUrls = articles.map(a => a.url);
      const dbArticles = await prisma.article.findMany({
        where: { url: { in: fetchedUrls } }
      });

      const judgments = await judgeHoldingArticles(h, dbArticles.map(a => ({
        id: a.id,
        title: a.title,
        excerpt: a.excerpt || "",
        url: a.url,
        source: a.source
      })));

      for (const j of judgments) {
        if (j.material === true || j.severity >= pushMinSeverity) {
          const quote = await fetchQuote(h.ticker, h.exchange);
          const validQuestionId = j.answeredQuestionId && h.questions.some(q => q.id === j.answeredQuestionId) 
            ? j.answeredQuestionId 
            : null;

          const existingFinding = await prisma.finding.findFirst({
            where: {
              articleId: j.articleId,
              holdingId: h.id
            }
          });

          if (existingFinding) {
            await prisma.finding.update({
              where: { id: existingFinding.id },
              data: {
                severity: j.severity,
                direction: j.direction || "NEUTRAL",
                summary: j.summary,
                questionId: validQuestionId,
                priceChangePct: quote?.priceChangePct ?? null,
                volumeRatio: quote?.volumeRatio ?? null,
              }
            });
          } else {
            await prisma.finding.create({
              data: {
                articleId: j.articleId,
                holdingId: h.id,
                severity: j.severity,
                direction: j.direction || "NEUTRAL",
                summary: j.summary,
                questionId: validQuestionId,
                priceChangePct: quote?.priceChangePct ?? null,
                volumeRatio: quote?.volumeRatio ?? null,
              }
            });
          }
          totalFindingsSaved++;
        }
      }

      // 6. Update lastIngestedAt
      await prisma.holding.update({
        where: { id: h.id },
        data: { lastIngestedAt: new Date() }
      });

    } catch (error) {
      console.error(`[ingestNews] Critical failure processing holding ${h.ticker}. Skipping to next. Error:`, error);
    }
  }

  // Local Clustering (done globally across recent articles)
  const recentArticles = await prisma.article.findMany({
    where: {
      firstSeen: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
      clusterId: null
    },
    orderBy: { publishedAt: 'desc' }
  });

  if (recentArticles.length > 1) {
    const groupedIds = new Set<string>();
    for (let i = 0; i < recentArticles.length; i++) {
      const a = recentArticles[i];
      if (groupedIds.has(a.id)) continue;
      let hasMatch = false;
      const matchIds = [a.id];
      for (let j = i + 1; j < recentArticles.length; j++) {
        const b = recentArticles[j];
        if (groupedIds.has(b.id)) continue;
        const similarity = stringSimilarity.compareTwoStrings(a.title.toLowerCase(), b.title.toLowerCase());
        if (similarity > 0.80) {
          hasMatch = true;
          matchIds.push(b.id);
          groupedIds.add(b.id);
        }
      }
      if (hasMatch) {
        await prisma.article.updateMany({
          where: { id: { in: matchIds } },
          data: { clusterId: a.id }
        });
        clustersFormed++;
      }
    }
  }

  const report = {
    totalHoldingsProcessed: holdings.length,
    newUpserted: upsertedCount,
    clustersFormed,
    findingsSaved: totalFindingsSaved
  };

  console.log("[ingestNews] Pipeline Fully Complete.", report);
  return { report, candidates: [] };
}
