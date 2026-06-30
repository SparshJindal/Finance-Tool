import { prisma } from "@/lib/db";
import { getNews, markFetched } from "@/lib/providers/news";
import crypto from "crypto";
import stringSimilarity from "string-similarity";
import { judgeHoldingArticles } from "@/lib/providers/summary";
import { fetchArticleExcerpt } from "@/lib/providers/extract";
import { fetchQuote } from "@/lib/providers/quote";
import { LlmQuotaExhaustedError } from "@/lib/providers/ai";
import type { NormalizedArticle } from "@/lib/providers/news";

export type HoldingRunResult = {
  holdingId: string
  ticker: string
  status: 'updated' | 'quiet' | 'failed' | 'cached'
  findingsAdded: number
  reason?: 'LLM_QUOTA_EXHAUSTED' | 'NO_NEW_ARTICLES' | 'FETCH_ERROR' | 'JUDGE_ERROR'
}

function getTokens(text: string): Set<string> {
  const stopWords = new Set(['the', 'and', 'for', 'with', 'from', 'this', 'that', 'have', 'are', 'was', 'were', 'will', 'say', 'says', 'said', 'has', 'had', 'its', 'their', 'they', 'after', 'over', 'more', 'than', 'which', 'what', 'who', 'when', 'where', 'why', 'how', 'about', 'news', 'stock', 'shares', 'company', 'inc', 'corp', 'new', 'first', 'update', 'today', 'report', 'reports', 'to', 'in', 'of', 'a', 'on', 'by', 'is', 'it', 'as', 'at', 'an', 'be']);
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
  return new Set(words);
}

function calculateJaccard(a: string, b: string): number {
  const setA = getTokens(a);
  const setB = getTokens(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

function isHighCollision(ticker: string, company: string): boolean {
  const cleanTicker = ticker.split('.')[0].toUpperCase();
  if (cleanTicker.length <= 3) return true;
  const commonNames = ['apple', 'block', 'meta', 'alphabet', 'snow', 'target', 'square', 'amazon', 'zoom', 'roku', 'snap', 'box', 'gap', 'yelp', 'visa'];
  if (commonNames.some(c => company.toLowerCase().includes(c))) return true;
  return false;
}

/**
 * Zero-token keyword relevance filter applied BEFORE the LLM judge.
 * Drops articles that don't mention the company, keeping the LLM budget for genuine hits.
 */
function relevanceFilter(
  articles: NormalizedArticle[],
  holding: { ticker: string; company: string; aliases: string[] },
  competitors: { ticker?: string; name: string }[]
): { kept: NormalizedArticle[]; dropped: number } {
  const cleanTicker = holding.ticker.split('.')[0];
  const tickerRe = new RegExp(`\\b${cleanTicker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  const companyLower = holding.company.toLowerCase();

  // Only use multi-word aliases (single words like "microchip" cause false positives)
  const safeAliases = (holding.aliases || [])
    .filter(a => a.trim().split(/\s+/).length >= 2)
    .map(a => a.toLowerCase());

  const competitorNames = competitors
    .map(c => c.name?.toLowerCase())
    .filter(Boolean) as string[];
  const competitorTickers = competitors
    .map(c => c.ticker?.toUpperCase())
    .filter(Boolean) as string[];

  function mentionsCompany(text: string): boolean {
    if (!text) return false;
    if (tickerRe.test(text)) return true;
    const lower = text.toLowerCase();
    if (lower.includes(companyLower)) return true;
    for (const alias of safeAliases) {
      if (lower.includes(alias)) return true;
    }
    return false;
  }

  function leadsWithCompetitor(title: string): boolean {
    if (!title) return false;
    const titleLower = title.toLowerCase();
    // Check if title starts with a competitor name/ticker
    for (const cn of competitorNames) {
      if (titleLower.startsWith(cn)) return true;
    }
    for (const ct of competitorTickers) {
      // Check if title starts with competitor ticker as a word
      const ctRe = new RegExp(`^${ct.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (ctRe.test(title)) return true;
    }
    return false;
  }

  const kept: NormalizedArticle[] = [];
  let dropped = 0;

  const highCollision = isHighCollision(holding.ticker, holding.company);

  for (const art of articles) {
    const titleMatch = mentionsCompany(art.title);
    const excerptMatch = mentionsCompany(art.excerpt || '');
    const hasCompanyMention = titleMatch || excerptMatch;

    // Topic-sourced articles MUST mention the company
    if (art.retrievalSource === 'topic' && !hasCompanyMention) {
      dropped++;
      continue;
    }

    // Drop if title leads with a competitor and does NOT mention our company
    if (leadsWithCompetitor(art.title) && !hasCompanyMention) {
      dropped++;
      continue;
    }

    // For primary/question sources, keep if there's any company mention
    // or if there's no retrieval source tagged (legacy/fallback)
    // For low-collision unique names, keep them even without positive anchor hits!
    if (highCollision) {
      if (hasCompanyMention || !art.retrievalSource) {
        kept.push(art);
      } else {
        dropped++;
      }
    } else {
      kept.push(art);
    }
  }

  // Sort kept articles by relevance
  kept.sort((a, b) => {
    // 1. Title match is highest priority
    const aTitle = mentionsCompany(a.title);
    const bTitle = mentionsCompany(b.title);
    if (aTitle && !bTitle) return -1;
    if (!aTitle && bTitle) return 1;

    // 2. Source priority (question > primary > topic)
    const sourceScore = (src?: string) => {
      if (src === 'question') return 3;
      if (src === 'primary') return 2;
      if (src === 'topic') return 1;
      return 0;
    };
    
    const aScore = sourceScore(a.retrievalSource);
    const bScore = sourceScore(b.retrievalSource);
    if (aScore !== bScore) return bScore - aScore;

    // 3. Fallback to newest first
    return b.publishedAt.getTime() - a.publishedAt.getTime();
  });

  return { kept, dropped };
}

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
  let quotaExhausted = false;
  const holdingResults: HoldingRunResult[] = [];
  const pushMinSeverity = parseInt(process.env.PUSH_MIN_SEVERITY || "3", 10);
  const maxArticles = parseInt(process.env.MAX_ARTICLES_PER_HOLDING || "10", 10);

  for (let i = 0; i < holdings.length; i++) {
    const h = holdings[i];
    let holdingFindingsAdded = 0;
    try {
      console.log(`[ingestNews] Processing holding ${i + 1}/${holdings.length}: ${h.ticker} (${h.company})`);
      
      const holdingCompetitors = competitors.filter(c => c.holdingId === h.id);

      const targetTicker = {
        holdingId: h.id,
        symbol: h.ticker,
        name: h.company,
        exchange: h.exchange,
        sector: h.sector || undefined,
        themes: h.themes,
        aliases: h.aliases || [],
        questions: h.questions.map(q => ({ id: q.id, text: q.text })),
        competitors: holdingCompetitors.map(c => ({ ticker: c.ticker, name: c.name }))
      };

      // 1. Fetch News for this holding
      const { articles: rawArticles, cacheStamps } = await getNews([targetTicker], skipHeavyApis);
      
      // 2. Pre-filter: basic title check + keyword relevance gate
      const filteredArticles = rawArticles.filter(art => {
        return art.title && art.title !== "No Title" && art.title.trim().length > 0;
      });

      const holdingArticles = filteredArticles;
      console.log(`[ingestNews] ${h.ticker}: Fetched ${holdingArticles.length} raw articles BEFORE pre-filter.`);

      // Apply keyword relevance filter BEFORE LLM judging
      const { kept: relevantArticles, dropped: droppedCount } = relevanceFilter(
        holdingArticles,
        { ticker: h.ticker, company: h.company, aliases: h.aliases || [] },
        holdingCompetitors
      );
      
      console.log(`[ingestNews] ${h.ticker}: Kept ${relevantArticles.length} articles AFTER pre-filter (dropped ${droppedCount}).`);

      const articlesToProcess = relevantArticles.slice(0, maxArticles);
      const articles: import("@/lib/providers/news").NormalizedArticle[] = [];

      if (articlesToProcess.length > 0) {
        // 3. Excerpts
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
              return { ...art, excerpt: excerpt || undefined };
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
      }

      // 5. Gather all articles to judge (newly fetched + unjudged DB articles)
      const fetchedUrls = articles.map(a => a.url);
      let dbArticles = await prisma.article.findMany({
        where: { url: { in: fetchedUrls } }
      });

      const maxBacklog = parseInt(process.env.MAX_BACKLOG_PER_HOLDING || "5", 10);
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const unjudgedDbArticles = await prisma.article.findMany({
        where: {
          publishedAt: { gte: threeDaysAgo },
          findings: { none: { holdingId: h.id } },
          OR: [
            { title: { contains: h.ticker, mode: 'insensitive' } },
            { title: { contains: h.company, mode: 'insensitive' } },
            { excerpt: { contains: h.ticker, mode: 'insensitive' } },
            { excerpt: { contains: h.company, mode: 'insensitive' } },
          ]
        },
        orderBy: { publishedAt: 'desc' },
        take: maxBacklog
      });

      // Pass unjudged db articles through the strict memory relevanceFilter
      const { kept: relevantUnjudged } = relevanceFilter(
        unjudgedDbArticles.map(a => ({ ...a, url: a.url, title: a.title, excerpt: a.excerpt || undefined })),
        { ticker: h.ticker, company: h.company, aliases: h.aliases || [] },
        holdingCompetitors
      );
      
      const relevantUnjudgedUrls = new Set(relevantUnjudged.map(a => a.url));
      const finalUnjudgedDbArticles = unjudgedDbArticles.filter(a => relevantUnjudgedUrls.has(a.url));

      if (finalUnjudgedDbArticles.length > 0) {
        console.log(`[ingestNews] ${h.ticker}: Found ${finalUnjudgedDbArticles.length} unjudged DB articles from previous runs to evaluate.`);
      }

      const allToJudgeMap = new Map<string, any>();
      dbArticles.forEach(a => allToJudgeMap.set(a.id, a));
      finalUnjudgedDbArticles.forEach(a => allToJudgeMap.set(a.id, a));
      dbArticles = Array.from(allToJudgeMap.values());

      if (dbArticles.length === 0) {
        console.log(`[ingestNews] No new or unjudged articles to evaluate for ${h.ticker}.`);
        await prisma.holding.update({ where: { id: h.id }, data: { lastIngestedAt: new Date() }});
        if (cacheStamps.length > 0) await markFetched(cacheStamps);
        holdingResults.push({ holdingId: h.id, ticker: h.ticker, status: 'cached', findingsAdded: 0, reason: 'NO_NEW_ARTICLES' });
        continue;
      }

      const judgments = await judgeHoldingArticles(h, dbArticles.map(a => {
        const originalArt = articles.find(orig => orig.url === a.url);
        return {
          id: a.id,
          title: a.title,
          excerpt: a.excerpt || "",
          url: a.url,
          source: a.source,
          matchedQuestionId: originalArt?.matchedQuestionId
        };
      }));

      const validArticleIds = new Set(dbArticles.map(a => a.id));

      for (const j of judgments) {
        if (!j.articleId || !validArticleIds.has(j.articleId)) {
          console.warn(`[ingestNews] Invalid or hallucinated articleId ${j.articleId} for holding ${h.ticker}. Skipping finding.`);
          continue;
        }

        if (j.material === true || j.severity >= pushMinSeverity) {
          try {
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

            let isNewOrUpgraded = false;

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
              if (j.severity > existingFinding.severity) {
                isNewOrUpgraded = true;
              }
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
              isNewOrUpgraded = true;
            }
            
            if (isNewOrUpgraded) {
              try {
                const { sendPushAlert } = await import('@/lib/push');
                await sendPushAlert(h.userId, {
                  title: `🔴 ${h.ticker} — Severity ${j.severity}/5`,
                  body: j.summary,
                });
              } catch (pushErr) {
                console.error(`[ingestNews] Push notification failed for ${h.ticker}:`, pushErr);
              }
            }
            totalFindingsSaved++;
            holdingFindingsAdded++;
          } catch (findingErr) {
            console.error(`[ingestNews] Failed to process finding for article ${j.articleId} on holding ${h.ticker}. Skipping. Error:`, findingErr);
          }
        }
      }

      // 6. Update lastIngestedAt and stamp the cache ONLY because judging succeeded
      await prisma.holding.update({
        where: { id: h.id },
        data: { lastIngestedAt: new Date() }
      });

      if (cacheStamps.length > 0) {
        await markFetched(cacheStamps);
      }

      holdingResults.push({
        holdingId: h.id,
        ticker: h.ticker,
        status: holdingFindingsAdded > 0 ? 'updated' : 'quiet',
        findingsAdded: holdingFindingsAdded
      });

    } catch (error) {
      if (error instanceof LlmQuotaExhaustedError) {
        console.error(`[ingestNews] LLM daily quota exhausted. Aborting remaining holdings. Error: ${error.message}`);
        quotaExhausted = true;
        holdingResults.push({ holdingId: h.id, ticker: h.ticker, status: 'failed', findingsAdded: 0, reason: 'LLM_QUOTA_EXHAUSTED' });
        break; // Stop processing further holdings gracefully
      }
      console.error(`[ingestNews] Critical failure processing holding ${h.ticker}. Skipping to next. Error:`, error);
      holdingResults.push({ holdingId: h.id, ticker: h.ticker, status: 'failed', findingsAdded: 0, reason: 'FETCH_ERROR' });
    }
  }

  // Deduplication: Per-Holding Event Collapse & Cross-Holding Weaker Attachment Drop
  const recentFindings = await prisma.finding.findMany({
    where: { createdAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) } },
    include: { article: true }
  });

  // 1. Cross-Holding Weaker Attachment Drop
  const findingsByArticle = new Map<string, typeof recentFindings>();
  for (const f of recentFindings) {
    if (!findingsByArticle.has(f.articleId)) findingsByArticle.set(f.articleId, []);
    findingsByArticle.get(f.articleId)!.push(f);
  }

  const findingsToDelete = new Set<string>();

  for (const group of findingsByArticle.values()) {
    if (group.length > 1) {
      const maxSev = Math.max(...group.map(g => g.severity));
      const weakFindings = group.filter(g => g.severity < maxSev);
      for (const w of weakFindings) {
        findingsToDelete.add(w.id);
      }
    }
  }

  // 2. Per-Holding Event Collapse (Connected Components via Jaccard 0.15 on Title + Excerpt)
  const validFindings = recentFindings.filter(f => !findingsToDelete.has(f.id));
  const findingsByHolding = new Map<string, typeof validFindings>();
  
  for (const f of validFindings) {
    if (!findingsByHolding.has(f.holdingId)) findingsByHolding.set(f.holdingId, []);
    findingsByHolding.get(f.holdingId)!.push(f);
  }

  for (const [holdingId, group] of findingsByHolding.entries()) {
    if (group.length <= 1) continue;

    const adjacencyList = new Map<string, string[]>();
    for (const f of group) adjacencyList.set(f.id, []);
    
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const textA = group[i].article.title + " " + (group[i].article.excerpt || "");
        const textB = group[j].article.title + " " + (group[j].article.excerpt || "");
        
        const similarity = calculateJaccard(textA, textB);
        if (similarity >= 0.15) {
          adjacencyList.get(group[i].id)!.push(group[j].id);
          adjacencyList.get(group[j].id)!.push(group[i].id);
        }
      }
    }
    
    const visited = new Set<string>();
    const clusters: (typeof validFindings)[] = [];
    
    for (const f of group) {
      if (!visited.has(f.id)) {
        const cluster = [];
        const queue = [f.id];
        visited.add(f.id);
        
        while (queue.length > 0) {
          const currentId = queue.shift()!;
          const currentF = group.find(x => x.id === currentId)!;
          cluster.push(currentF);
          
          for (const neighborId of adjacencyList.get(currentId)!) {
            if (!visited.has(neighborId)) {
              visited.add(neighborId);
              queue.push(neighborId);
            }
          }
        }
        clusters.push(cluster);
      }
    }

    for (const cluster of clusters) {
      if (cluster.length > 1) {
        // Sort by severity desc, then createdAt desc to pick representative
        cluster.sort((a, b) => b.severity !== a.severity ? b.severity - a.severity : b.createdAt.getTime() - a.createdAt.getTime());
        const representative = cluster[0];
        const duplicates = cluster.slice(1);
        
        const extraUrls = duplicates.map(d => d.article.url);
        // also pull in any existing additionalSources they had
        let currentExtras = representative.additionalSources || [];
        for (const d of duplicates) {
           if (d.additionalSources && Array.isArray(d.additionalSources)) {
             currentExtras = currentExtras.concat(d.additionalSources);
           }
        }
        const mergedExtras = Array.from(new Set([...currentExtras, ...extraUrls]));
        
        await prisma.finding.update({
          where: { id: representative.id },
          data: { additionalSources: mergedExtras }
        });
        
        for (const d of duplicates) {
          findingsToDelete.add(d.id);
        }
        
        clustersFormed += (cluster.length - 1);
      }
    }
  }

  if (findingsToDelete.size > 0) {
    await prisma.finding.deleteMany({
      where: { id: { in: Array.from(findingsToDelete) } }
    });
  }

  const report = {
    totalHoldingsProcessed: holdings.length,
    newUpserted: upsertedCount,
    clustersFormed,
    findingsSaved: totalFindingsSaved,
    quotaExhausted,
    holdingResults
  };

  console.log("[ingestNews] Pipeline Fully Complete.", report);
  return { report };
}
