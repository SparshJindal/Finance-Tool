import { prisma } from "@/lib/db";
import { getNews } from "@/lib/providers/news";
import crypto from "crypto";
import stringSimilarity from "string-similarity";
import { filterRelevance } from "@/lib/gate";
import { evaluateCandidates } from "@/lib/providers/summary";
import { fetchArticleExcerpt } from "@/lib/providers/extract";

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

  // 5. Semantic Relevance Gate
  console.log("[ingestNews] Starting semantic relevance gating...");
  const holdingsWithQs = await prisma.holding.findMany({
    where: userId ? { userId } : undefined,
    include: { questions: true },
    // thesis and themes are scalar columns — always included by default
  });

  const fetchedUrls = articles.map(a => a.url);
  const evalArticles = await prisma.article.findMany({
    where: {
      OR: [
        { url: { in: fetchedUrls } },
        {
          firstSeen: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
          findings: {
            none: {
              holdingId: { in: holdingIds }
            }
          }
        }
      ]
    },
    orderBy: { publishedAt: 'desc' },
    take: 100
  });

  const collapsedArticles: typeof evalArticles = [];
  const seenClusters = new Set<string>();
  for (const a of evalArticles) {
    if (a.clusterId) {
      if (!seenClusters.has(a.clusterId)) {
        seenClusters.add(a.clusterId);
        collapsedArticles.push(a);
      }
    } else {
      collapsedArticles.push(a);
    }
  }

  const candidates = await filterRelevance(
    collapsedArticles.map(a => ({ id: a.id, title: a.title, source: a.source, excerpt: a.excerpt })),
    holdingsWithQs.map(h => ({ id: h.id, questions: h.questions, thesis: h.thesis, themes: h.themes }))
  );

  const report = {
    totalFetched: articles.length,
    newUpserted: upsertedCount,
    clustersFormed,
    candidatesFound: candidates.length
  };

  let topCandidates: any[] = [];
  if (candidates.length > 0) {
    topCandidates = candidates.sort((a, b) => b.similarity - a.similarity).slice(0, 20);
    if (runEvaluation) {
      console.log(`[ingestNews] Starting AI evaluation for top 20 candidates...`);
      await evaluateCandidates(topCandidates);
    }
  }

  console.log("[ingestNews] Pipeline Fully Complete.");
  return { report, candidates: topCandidates };
}
