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
    select: { id: true, ticker: true, company: true, sector: true, exchange: true, themes: true } 
  });
  
  const holdingIds = holdings.map(h => h.id);
  
  const competitors = await prisma.competitor.findMany({ 
    where: holdingIds.length > 0 ? { holdingId: { in: holdingIds } } : undefined,
    select: { ticker: true, name: true, holdingId: true } 
  });
  
  const targetTickers = new Map<string, any>();
  
  holdings.forEach(h => {
    targetTickers.set(h.ticker, {
      holdingId: h.id,
      symbol: h.ticker,
      name: h.company,
      exchange: h.exchange,
      sector: h.sector || undefined,
      themes: h.themes
    });
  });

  competitors.forEach(c => {
    if (!targetTickers.has(c.ticker)) {
      // Find parent holding to inherit exchange/sector, fallback to US
      const parent = holdings.find(h => h.id === c.holdingId);
      targetTickers.set(c.ticker, {
        symbol: c.ticker,
        name: c.name,
        exchange: parent?.exchange || "US",
        sector: parent?.sector || undefined,
        themes: parent?.themes || []
      });
    }
  });

  if (targetTickers.size === 0) {
    return { error: "No targets to process" };
  }

  // 2. Fetch News
  const rawArticles = await getNews(Array.from(targetTickers.values()), skipHeavyApis);
  
  // 3. Pre-filter and Fetch Excerpts
  console.log(`[ingestNews] Pre-filtering ${rawArticles.length} raw articles...`);
  const filteredArticles = rawArticles.filter(art => {
    return art.title && art.title !== "No Title" && art.title.trim().length > 0;
  });
  console.log(`[ingestNews] Kept ${filteredArticles.length} articles after pre-filtering.`);

  // Limit to MAX_ARTICLES_PER_RUN to absolutely prevent Vercel timeouts on massive batches
  const maxArticles = parseInt(process.env.MAX_ARTICLES_PER_RUN || "150", 10);
  const articlesToProcess = filteredArticles.slice(0, maxArticles);

  const articles = [];
  const chunkSize = 10;
  let skippedScrapes = 0;
  for (let i = 0; i < articlesToProcess.length; i += chunkSize) {
    const chunk = articlesToProcess.slice(i, i + chunkSize);
    const chunkWithExcerpts = await Promise.all(
      chunk.map(async (art) => {
        // Use search-provider excerpt if available; only fall back to live scraping
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
    console.log(`[ingestNews] Skipped ${skippedScrapes} live scrapes (excerpts provided by search API).`);
  }
  
  // 4. Hash & Upsert
  let upsertedCount = 0;
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

  // 4. Local Clustering
  const recentArticles = await prisma.article.findMany({
    where: {
      firstSeen: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
      clusterId: null
    },
    orderBy: { publishedAt: 'desc' }
  });

  let clustersFormed = 0;
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

  // 5. Direct LLM Relevance & Judgment
  console.log("[ingestNews] Starting direct LLM judgment...");
  const holdingsWithQs = await prisma.holding.findMany({
    where: userId ? { userId } : undefined,
    include: { questions: true },
  });

  // Fetch from DB the articles we just upserted so we have their full IDs and data
  const fetchedUrls = articles.map(a => a.url);
  const dbArticles = await prisma.article.findMany({
    where: { url: { in: fetchedUrls } }
  });

  let totalFindingsSaved = 0;
  const pushMinSeverity = parseInt(process.env.PUSH_MIN_SEVERITY || "3", 10);

  for (const h of holdingsWithQs) {
    // Re-match the DB articles to this holding using matchedHoldingIds
    // (articles array has matchedHoldingIds, dbArticles does not, so we map via URL)
    const hUrls = articles.filter(a => a.matchedHoldingIds?.includes(h.id)).map(a => a.url);
    if (hUrls.length === 0) continue;

    const holdingArticlesToJudge = dbArticles.filter(dbA => hUrls.includes(dbA.url));
    if (holdingArticlesToJudge.length === 0) continue;

    try {
      const judgments = await judgeHoldingArticles(h, holdingArticlesToJudge.map(a => ({
        id: a.id,
        title: a.title,
        excerpt: a.excerpt || "",
        url: a.url,
        source: a.source
      })));

      for (const j of judgments) {
        if (j.material === true || j.severity >= pushMinSeverity) {
          // Fetch quote for finding context
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
    } catch (error) {
      console.error(`[ingestNews] Failed to judge articles for holding ${h.ticker}:`, error);
    }
  }

  const report = {
    totalFetched: articles.length,
    newUpserted: upsertedCount,
    clustersFormed,
    findingsSaved: totalFindingsSaved
  };

  console.log("[ingestNews] Pipeline Fully Complete.");
  return { report, candidates: [] };
}
