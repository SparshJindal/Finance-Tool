import { prisma } from "@/lib/db";
import { getNews } from "@/lib/providers/news";
import crypto from "crypto";
import stringSimilarity from "string-similarity";
import { filterRelevance } from "@/lib/gate";
import { evaluateCandidates } from "@/lib/providers/summary";

export async function ingestNews(userId?: string, runEvaluation: boolean = true) {
  console.log(`[ingestNews] Starting pipeline... ${userId ? `(User: ${userId})` : '(Global)'}`);
  
  // 1. Gather all unique targets
  const holdings = await prisma.holding.findMany({ 
    where: userId ? { userId } : undefined,
    select: { id: true, ticker: true } 
  });
  
  const holdingIds = holdings.map(h => h.id);
  
  const competitors = await prisma.competitor.findMany({ 
    where: holdingIds.length > 0 ? { holdingId: { in: holdingIds } } : undefined,
    select: { ticker: true } 
  });
  
  const targetTickers = new Set([
    ...holdings.map(h => h.ticker),
    ...competitors.map(c => c.ticker)
  ]);

  if (targetTickers.size === 0) {
    return { error: "No targets to process" };
  }

  // 2. Fetch News
  const articles = await getNews(Array.from(targetTickers));
  
  // 3. Hash & Upsert
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
    include: { questions: true }
  });

  const fetchedUrls = articles.map(a => a.url);
  const evalArticles = await prisma.article.findMany({
    where: { url: { in: fetchedUrls } },
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
    collapsedArticles.map(a => ({ id: a.id, title: a.title, source: a.source })),
    holdingsWithQs.map(h => ({ id: h.id, questions: h.questions }))
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
