import { prisma } from "@/lib/db";
import { getNews } from "@/lib/providers/news";
import crypto from "crypto";
import stringSimilarity from "string-similarity";
import { filterRelevance } from "@/lib/gate";
import { evaluateCandidates } from "@/lib/providers/summary";

export async function ingestNews() {
  console.log("[ingestNews] Starting pipeline...");
  
  // 1. Gather all unique targets
  const holdings = await prisma.holding.findMany({ select: { ticker: true } });
  const competitors = await prisma.competitor.findMany({ select: { ticker: true } });
  
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
    
    // We use url as the unique identifier.
    // If it exists, we just update the contentHash and title in case they slightly shifted,
    // though usually they don't.
    try {
      await prisma.article.upsert({
        where: { url: art.url },
        update: {}, // Idempotent: don't overwrite firstSeen or existing clusterId if it exists
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

  // 4. Local Clustering (No AI Tokens)
  // Fetch articles from the last 48 hours that don't have a clusterId yet
  const recentArticles = await prisma.article.findMany({
    where: {
      firstSeen: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
      clusterId: null
    },
    orderBy: { publishedAt: 'desc' }
  });

  let clustersFormed = 0;

  if (recentArticles.length > 1) {
    // Basic grouping algorithm:
    // Iterate through recent articles. Compare title against others.
    // If similarity > 0.80, mark them with the same clusterId.
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
        // Set the clusterId of all matches to the ID of the first (most recent) article
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
    include: { questions: true }
  });

  const fetchedUrls = articles.map(a => a.url);
  const evalArticles = await prisma.article.findMany({
    where: { url: { in: fetchedUrls } },
    take: 100
  });

  const candidates = await filterRelevance(
    evalArticles.map(a => ({ id: a.id, title: a.title, source: a.source })),
    holdingsWithQs.map(h => ({ id: h.id, questions: h.questions }))
  );

  const report = {
    totalFetched: articles.length,
    newUpserted: upsertedCount,
    clustersFormed,
    candidatesFound: candidates.length
  };

  console.log("[ingestNews] Gating complete:", report);

  if (candidates.length > 0) {
    console.log(`[ingestNews] Starting AI evaluation for top 20 candidates...`);
    const topCandidates = candidates.sort((a, b) => b.similarity - a.similarity).slice(0, 20);
    await evaluateCandidates(topCandidates);
  };

  console.log("[ingestNews] Pipeline Fully Complete.");
  return { report, candidates };
}
