import { prisma } from "@/lib/db";
import { getNews, markFetched } from "@/lib/providers/news";
import crypto from "crypto";
import stringSimilarity from "string-similarity";
import { judgeHoldingArticles, generateHoldingCaption } from "@/lib/providers/summary";
import { fetchArticleExcerpt } from "@/lib/providers/extract";
import { fetchQuote } from "@/lib/providers/quote";
import { LlmQuotaExhaustedError } from "@/lib/providers/ai";
import { evaluateFalsifiers } from "@/lib/providers/falsifiers";
import { sourceTier } from "@/lib/providers/sourceQuality";
import type { NormalizedArticle } from "@/lib/providers/news";
import { fetchEarningsForHolding, judgeEarningsVsThesis } from "@/lib/providers/earnings";
import { logger } from "@/lib/log";
import { metricsStorage, MetricsCollector, withTiming } from "@/lib/metrics";
import { resolveEntity } from "@/lib/entity";

export type HoldingRunResult = {
  holdingId: string
  ticker: string
  status: 'updated' | 'quiet' | 'failed' | 'cached'
  findingsAdded: number
  reason?: 'LLM_QUOTA_EXHAUSTED' | 'NO_NEW_ARTICLES' | 'FETCH_ERROR' | 'JUDGE_ERROR'
}

function buildEventSignature(title: string, excerpt: string): { entities: Set<string>, numbers: Set<string>, actions: Set<string> } {
  const entities = new Set<string>();
  const numbers = new Set<string>();
  const actions = new Set<string>();

  const titleTokens = title.split(/[\s,;:()[\]"']+/);
  const textTokens = (title + " " + excerpt).split(/[\s,;:()[\]"']+/);

  const stopWordsCaps = new Set(['The', 'A', 'An', 'In', 'On', 'At', 'To', 'For', 'Of', 'With', 'By', 'From', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
  
  for (const t of titleTokens) {
    if (/^[A-Z][a-zA-Z0-9.&-]+$/.test(t)) {
      if (!stopWordsCaps.has(t)) {
        entities.add(t.toLowerCase());
      }
    }
  }

  for (const t of textTokens) {
    if (/^\$?\d+(\.\d+)?[bmkBMK%]?$/.test(t)) {
      numbers.add(t.replace(/\s+/g, '').toUpperCase());
    }
  }

  const actionKeywords = new Set([
    'deal', 'acquire', 'merger', 'lawsuit', 'earnings', 'guidance', 'recall',
    'partnership', 'launch', 'ban', 'approval', 'downgrade', 'upgrade', 'contract', 'ipo'
  ]);
  
  for (const t of textTokens) {
    const lower = t.toLowerCase();
    if (actionKeywords.has(lower)) {
      actions.add(lower);
    }
  }

  return { entities, numbers, actions };
}

function sameEvent(sigA: ReturnType<typeof buildEventSignature>, sigB: ReturnType<typeof buildEventSignature>): boolean {
  const jaccard = (a: Set<string>, b: Set<string>) => {
    if (a.size === 0 || b.size === 0) return 0;
    const intersection = new Set([...a].filter(x => b.has(x)));
    const union = new Set([...a, ...b]);
    return intersection.size / union.size;
  };

  const entityOverlap = jaccard(sigA.entities, sigB.entities);
  
  let numberMatch = 0;
  for (const n of sigA.numbers) {
    if (sigB.numbers.has(n)) {
      numberMatch = 1;
      break;
    }
  }

  const actionOverlap = jaccard(sigA.actions, sigB.actions);

  return entityOverlap >= 0.5 && (actionOverlap >= 0.5 || numberMatch === 1);
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

  const entity = resolveEntity(holding.ticker, 'US', holding.company); // We default to US if exchange isn't in holding type here, but holding actually has exchange in callers.
  // The holding type in relevanceFilter params doesn't have exchange, so let's default to US or add it later if needed.
  
  const allSafeAliases = Array.from(new Set([...safeAliases, ...entity.aliases.map(a => a.toLowerCase())]));

  function mentionsCompany(text: string): boolean {
    if (!text) return false;
    const lower = text.toLowerCase();
    
    let hasStrongPositive = lower.includes(companyLower);
    if (!hasStrongPositive) {
      for (const alias of allSafeAliases) {
        if (lower.includes(alias)) {
          hasStrongPositive = true;
          break;
        }
      }
    }
    
    let hasWeakPositive = false;
    if (tickerRe.test(text)) hasWeakPositive = true;

    let hasNegative = false;
    for (const neg of entity.negativeAliases) {
      if (lower.includes(neg.toLowerCase())) {
        hasNegative = true;
        break;
      }
    }

    if (hasNegative && !hasStrongPositive) {
      // It might match the ticker, but it discusses a confusable without naming the actual company. Reject.
      return false; 
    }

    return hasStrongPositive || hasWeakPositive;
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

    // The only exception: an article carrying a matchedQuestionId may be kept even without a mention
    if (!hasCompanyMention && !art.matchedQuestionId) {
      dropped++;
      continue;
    }

    // Drop if title leads with a competitor and does NOT mention our company
    if (leadsWithCompetitor(art.title) && !hasCompanyMention) {
      dropped++;
      continue;
    }

    kept.push(art);
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

    // 3. Source Quality Tier (lower is better, tier 1 > tier 2 > tier 3)
    const aTier = sourceTier(a.source, a.url);
    const bTier = sourceTier(b.source, b.url);
    if (aTier !== bTier) return aTier - bTier;

    // 4. Fallback to newest first
    return b.publishedAt.getTime() - a.publishedAt.getTime();
  });

  // Soft drop: if we have >= 3 tier-1 or tier-2 articles, drop the tier-3 articles.
  let finalKept: NormalizedArticle[] = [];
  const goodArticles = kept.filter(a => sourceTier(a.source, a.url) <= 2);
  if (goodArticles.length >= 3) {
    finalKept = goodArticles;
    dropped += kept.length - goodArticles.length;
  } else {
    finalKept = kept;
  }

  return { kept: finalKept, dropped };
}

async function ingestNewsInternal(userId?: string, runEvaluation: boolean = true, targetHoldingIds?: string[], skipHeavyApis: boolean = false): Promise<HoldingRunResult[]> {
  logger.info({ userId, targetHoldingIds }, "[ingestNewsInternal] Starting pipeline...");
  
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

  const { holdingLimiter, llmLimiter } = await import('@/lib/limiters');
  
  await Promise.allSettled(holdings.map(async (h, i) => holdingLimiter(async () => {
    if (quotaExhausted) return;
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
      const { articles: rawArticles, cacheStamps } = await withTiming('fetch', () => getNews([targetTicker], skipHeavyApis));
      
      // 2. Pre-filter: basic title check + keyword relevance gate
      const filteredArticles = rawArticles.filter(art => {
        return art.title && art.title !== "No Title" && art.title.trim().length > 0;
      });

      const holdingArticles = filteredArticles;
      console.log(`[ingestNews] ${h.ticker}: Fetched ${holdingArticles.length} raw articles BEFORE pre-filter.`);

      // Apply keyword relevance filter BEFORE LLM judging
      const { kept: relevantArticles, dropped: droppedCount } = await withTiming('relevance', async () => relevanceFilter(
        holdingArticles,
        { ticker: h.ticker, company: h.company, aliases: h.aliases || [] },
        holdingCompetitors
      ));
      
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
      const { kept: relevantUnjudged } = await withTiming('relevance', async () => relevanceFilter(
        unjudgedDbArticles.map(a => ({ ...a, url: a.url, title: a.title, excerpt: a.excerpt || undefined })),
        { ticker: h.ticker, company: h.company, aliases: h.aliases || [] },
        holdingCompetitors
      ));
      
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
        return;
      }

      const judgments = await withTiming('judge', () => llmLimiter(() => judgeHoldingArticles(h, dbArticles.map(a => {
        const originalArt = articles.find(orig => orig.url === a.url);
        return {
          id: a.id,
          title: a.title,
          excerpt: a.excerpt || "",
          url: a.url,
          source: a.source,
          matchedQuestionId: originalArt?.matchedQuestionId
        };
      }))));

      const validArticleIds = new Set(dbArticles.map(a => a.id));

      const passedJudgments = judgments.filter(j => {
        if (!j.articleId || !validArticleIds.has(j.articleId)) {
          console.warn(`[ingestNews] Invalid or hallucinated articleId ${j.articleId} for holding ${h.ticker}. Skipping finding.`);
          return false;
        }
        const isNeutral = (j.direction || '').toUpperCase() === 'NEUTRAL';
        return isNeutral
          ? j.severity >= 4
          : (j.material === true || j.severity >= pushMinSeverity);
      });

      if (passedJudgments.length > 0) {
        let quote: any = null;
        try {
          quote = await fetchQuote(h.ticker, h.exchange);
        } catch (e) {
          console.error(`[ingestNews] fetchQuote failed for ${h.ticker}`, e);
        }

        const existingFindings = await prisma.finding.findMany({
          where: {
            holdingId: h.id,
            articleId: { in: passedJudgments.map(j => j.articleId) }
          }
        });
        const existingMap = new Map(existingFindings.map(f => [f.articleId, f]));

        const updates: any[] = [];
        const creations: any[] = [];
        const pushAlerts: any[] = [];

        for (const j of passedJudgments) {
          const validQuestionId = j.answeredQuestionId && h.questions.some(q => q.id === j.answeredQuestionId) 
            ? j.answeredQuestionId 
            : null;
          
          const existing = existingMap.get(j.articleId);
          let isNewOrUpgraded = false;

          const data = {
            severity: j.severity,
            direction: j.direction || "NEUTRAL",
            summary: j.summary,
            questionId: validQuestionId,
            priceChangePct: quote?.priceChangePct ?? null,
            volumeRatio: quote?.volumeRatio ?? null,
          };

          if (existing) {
            updates.push({ where: { id: existing.id }, data });
            if (j.severity > existing.severity) isNewOrUpgraded = true;
          } else {
            creations.push({
              articleId: j.articleId,
              holdingId: h.id,
              ...data
            });
            isNewOrUpgraded = true;
          }

          if (isNewOrUpgraded) {
            pushAlerts.push({
              title: `🔴 ${h.ticker} — Severity ${j.severity}/5`,
              body: j.summary,
            });
          }
        }

        try {
          await prisma.$transaction([
            ...updates.map(u => prisma.finding.update(u)),
            ...(creations.length > 0 ? [prisma.finding.createMany({ data: creations })] : [])
          ]);
          
          totalFindingsSaved += passedJudgments.length;
          holdingFindingsAdded += passedJudgments.length;

          if (pushAlerts.length > 0) {
            try {
              const { sendPushAlert } = await import('@/lib/push');
              await Promise.allSettled(pushAlerts.map(alert => sendPushAlert(h.userId, alert)));
            } catch (pushErr) {
              console.error(`[ingestNews] Push notification failed for ${h.ticker}:`, pushErr);
            }
          }
        } catch (findingErr) {
          console.error(`[ingestNews] Failed to process findings batch for holding ${h.ticker}. Error:`, findingErr);
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
        return; // Fast fail
      }
      console.error(`[ingestNews] Critical failure processing holding ${h.ticker}. Skipping to next. Error:`, error);
      holdingResults.push({ holdingId: h.id, ticker: h.ticker, status: 'failed', findingsAdded: 0, reason: 'FETCH_ERROR' });
    }
  })));

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
  
  await withTiming('dedup', async () => {
    const findingsByHolding = new Map<string, typeof validFindings>();
    
    for (const f of validFindings) {
      if (!findingsByHolding.has(f.holdingId)) findingsByHolding.set(f.holdingId, []);
      findingsByHolding.get(f.holdingId)!.push(f);
    }

  for (const [holdingId, group] of findingsByHolding.entries()) {
    if (group.length <= 1) continue;

    const adjacencyList = new Map<string, string[]>();
    for (const f of group) adjacencyList.set(f.id, []);
    
    // Precompute signatures
    const signatures = new Map<string, ReturnType<typeof buildEventSignature>>();
    for (const f of group) {
      signatures.set(f.id, buildEventSignature(f.article.title, f.article.excerpt || ""));
    }
    
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const sigA = signatures.get(group[i].id)!;
        const sigB = signatures.get(group[j].id)!;
        
        if (sameEvent(sigA, sigB)) {
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
  });

  if (findingsToDelete.size > 0) {
    await prisma.finding.deleteMany({
      where: { id: { in: Array.from(findingsToDelete) } }
    });
  }

  // --- CAPTION PASS ---
  try {
    const survivingFindings = await prisma.finding.findMany({
      where: {
        holdingId: { in: holdingIds },
        createdAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) }
      },
      include: { article: true },
      orderBy: { severity: 'desc' }
    });

    const holdingsToUpdate = Array.from(new Set(survivingFindings.map(f => f.holdingId)));
    if (holdingsToUpdate.length > 0) {
      await withTiming('caption', async () => {
        for (const hid of holdingsToUpdate) {
          const h = holdings.find(x => x.id === hid)!;
          const hf = survivingFindings.filter(f => f.holdingId === hid);
          const nonNeutral = hf.filter(f => (f.direction || '').toUpperCase() !== 'NEUTRAL');
          
          if (nonNeutral.length === 0) {
            await prisma.holding.update({
              where: { id: h.id },
              data: { verdictCaption: null, verdictCaptionAt: new Date() }
            });
          } else {
            try {
              const caption = await llmLimiter(() => generateHoldingCaption(h, nonNeutral.map(f => ({
                summary: f.summary,
                severity: f.severity,
                direction: f.direction,
                title: f.article.title
              }))));
              await prisma.holding.update({
                where: { id: h.id },
                data: { verdictCaption: caption, verdictCaptionAt: new Date() }
              });
            } catch (e) {
              console.error(`[ingestNews] Failed to generate caption for ${h.ticker}:`, e);
            }
          }
        }
      });
    }
  } catch (error: any) {
    if (error instanceof LlmQuotaExhaustedError || error.name === "LlmQuotaExhaustedError") {
      console.warn("[ingestNews] Quota exhausted during caption pass. Stopping captions but pipeline continues.");
    } else {
      console.error("[ingestNews] Error during caption pass:", error);
    }
  }

  // --- FALSIFIER PASS ---
  try {
    const holdingsWithFalsifiers = await prisma.holding.findMany({
      where: { id: { in: holdingIds } },
      include: { falsifiers: true }
    });
    
    const recentFindingsForFalsifiers = await prisma.finding.findMany({
      where: {
        holdingId: { in: holdingIds },
        createdAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) }
      },
      include: { article: true },
      orderBy: { severity: 'desc' }
    });

    const findingsByHoldingF = new Map<string, typeof recentFindingsForFalsifiers>();
    recentFindingsForFalsifiers.forEach(f => {
      if (!findingsByHoldingF.has(f.holdingId)) findingsByHoldingF.set(f.holdingId, []);
      findingsByHoldingF.get(f.holdingId)!.push(f);
    });

    for (const h of holdingsWithFalsifiers) {
      if (h.falsifiers.length === 0) continue;
      const hFindings = findingsByHoldingF.get(h.id) || [];
      const nonNeutral = hFindings.filter(f => (f.direction || '').toUpperCase() !== 'NEUTRAL');
      
      if (nonNeutral.length > 0) {
        await withTiming('falsifier', async () => {
          const findingsForEval = nonNeutral.map(f => ({
            id: f.id,
            summary: f.summary,
            direction: f.direction as any,
            severity: f.severity,
            sourceTitle: f.article.title
          }));
          
          const evalResults = await llmLimiter(() => evaluateFalsifiers(h, h.falsifiers, findingsForEval));
          
          for (const res of evalResults.results) {
            const targetFalsifier = h.falsifiers[res.index];
            if (!targetFalsifier) continue;
            
            const matchedIds = res.matchedFindingIndices
              .map((i: number) => findingsForEval[i]?.id)
              .filter(Boolean) as string[];
              
            const isTriggering = res.status === 'TRIGGERED' && targetFalsifier.status !== 'TRIGGERED';
            
            await prisma.falsifier.update({
              where: { id: targetFalsifier.id },
              data: {
                status: res.status,
                evidenceFindingIds: matchedIds,
                lastEvaluatedAt: new Date(),
                triggeredAt: isTriggering ? new Date() : (res.status === 'TRIGGERED' ? targetFalsifier.triggeredAt : null)
              }
            });
          }
        });
      }
    }
  } catch (error: any) {
    if (error instanceof LlmQuotaExhaustedError || error.name === "LlmQuotaExhaustedError") {
      console.warn("[ingestNews] Quota exhausted during falsifier pass. Stopping but pipeline continues.");
    } else {
      console.error("[ingestNews] Error during falsifier pass:", error);
    }
  }

  // --- EARNINGS PASS ---
  if (!skipHeavyApis) {
    await refreshEarnings(undefined, holdingIds);
  }

  console.log("[ingestNews] Pipeline Fully Complete.");
  return holdingResults;
}

export async function refreshEarnings(userId?: string, targetHoldingIds?: string[]) {
  const whereClause: any = {};
  if (userId) whereClause.userId = userId;
  if (targetHoldingIds && targetHoldingIds.length > 0) {
    whereClause.id = { in: targetHoldingIds };
  }
  
  const holdings = await prisma.holding.findMany({ where: whereClause });
  
  for (const h of holdings) {
    try {
      const events = await withTiming('earnings', async () => {
        const evs = await fetchEarningsForHolding(h);
        for (const e of evs) {
          if (e.status === 'REPORTED' && e.guidance && h.thesis) {
            const result = await judgeEarningsVsThesis(h as any, e);
            if (result) {
              return evs.map(ev => (ev.reportDate && e.reportDate && ev.reportDate.getTime() === e.reportDate.getTime()) ? {
                ...ev,
                thesisVerdict: result.verdict,
                thesisSummary: result.summary
              } : ev);
            }
          }
        }
        return evs;
      });
      
      for (const e of events) {
        if (!e.reportDate) continue;
        
        let verdict = e.thesisVerdict;
        let summary = e.thesisSummary;
        
        if (e.status === "REPORTED" && (e.epsActual != null || e.revenueActual != null)) {
          // Check if we already have this event with a verdict
          const existing = await prisma.earningsEvent.findUnique({
            where: {
              holdingId_reportDate: { holdingId: h.id, reportDate: e.reportDate }
            }
          });
          
          if (!existing || !existing.thesisVerdict) {
            const judgment = await judgeEarningsVsThesis(h, e);
            verdict = judgment.verdict;
            summary = judgment.summary;
          } else {
            verdict = existing.thesisVerdict;
            summary = existing.thesisSummary;
          }
        }
        
        await prisma.earningsEvent.upsert({
          where: {
            holdingId_reportDate: { holdingId: h.id, reportDate: e.reportDate }
          },
          update: {
            status: e.status,
            epsEstimate: e.epsEstimate,
            epsActual: e.epsActual,
            epsSurprisePct: e.epsSurprisePct,
            revenueEstimate: e.revenueEstimate,
            revenueActual: e.revenueActual,
            revenueSurprisePct: e.revenueSurprisePct,
            guidance: e.guidance,
            source: e.source,
            fiscalPeriod: e.fiscalPeriod,
            reportWhen: e.reportWhen,
            ...(verdict ? { thesisVerdict: verdict } : {}),
            ...(summary ? { thesisSummary: summary } : {})
          },
          create: {
            holdingId: h.id,
            reportDate: e.reportDate,
            status: e.status,
            epsEstimate: e.epsEstimate,
            epsActual: e.epsActual,
            epsSurprisePct: e.epsSurprisePct,
            revenueEstimate: e.revenueEstimate,
            revenueActual: e.revenueActual,
            revenueSurprisePct: e.revenueSurprisePct,
            guidance: e.guidance,
            source: e.source,
            fiscalPeriod: e.fiscalPeriod,
            reportWhen: e.reportWhen,
            thesisVerdict: verdict,
            thesisSummary: summary
          }
        });
      }
    } catch (error: any) {
      if (error instanceof LlmQuotaExhaustedError || error.name === "LlmQuotaExhaustedError") {
        logger.warn({ ticker: h.ticker }, `[refreshEarnings] Quota exhausted. Stopping earnings pass.`);
        break; // Stop pass on quota exhaustion, but don't crash the pipeline
      }
      logger.error({ err: error, ticker: h.ticker }, `[refreshEarnings] Error processing`);
    }
  }
}

export type PipelineReport = {
  results: HoldingRunResult[];
  metrics: Record<string, any>;
};

export async function ingestNews(userId?: string, runEvaluation: boolean = true, targetHoldingIds?: string[], skipHeavyApis: boolean = false): Promise<PipelineReport> {
  const collector = new MetricsCollector();
  const startTime = Date.now();
  
  return metricsStorage.run(collector, async () => {
    try {
      const results = await ingestNewsInternal(userId, runEvaluation, targetHoldingIds, skipHeavyApis);
      const metricsJson = collector.toJSON();
      const durationMs = Date.now() - startTime;
      
      logger.info({ pipeline_run_summary: metricsJson, userId, targetHoldingIds, durationMs }, "Pipeline Run Summary");
      
      try {
        await prisma.pipelineRun.create({
          data: {
            userId: userId || null,
            startedAt: new Date(startTime),
            durationMs: durationMs,
            holdingsProcessed: results.length,
            findingsSaved: results.reduce((sum, r) => sum + r.findingsAdded, 0),
            errorsJson: {},
            stageTimingsJson: metricsJson.stageTimings,
            p95Json: metricsJson.p95,
            costJson: metricsJson.cost
          }
        });
      } catch (dbErr) {
        logger.error({ err: dbErr }, "Failed to persist PipelineRun to DB");
      }
      
      return { results, metrics: metricsJson };
    } catch (e) {
      logger.error({ err: e }, "Pipeline run failed");
      throw e;
    }
  });
}
