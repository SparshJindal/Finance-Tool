import { Type } from "@google/genai";
import { askAI, LlmQuotaExhaustedError } from "./ai";
import { prisma } from "@/lib/db";
import { fetchQuote } from "./quote";
import { resolveEntity } from "@/lib/entity";

const judgeSchema = {
  type: Type.OBJECT,
  properties: {
    results: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          articleIndex: { type: Type.INTEGER, description: "The 1-based index of the article in the list" },
          material: { type: Type.BOOLEAN, description: "True if the article contains highly relevant, impactful news about the holding" },
          severity: { type: Type.INTEGER, description: "1 to 5, where 5 is extremely impactful" },
          companyImpact: { type: Type.STRING, description: "positive, negative, or neutral — how this news impacts the company fundamentally, IGNORING the portfolio holding's direction." },
          answeredQuestionId: { type: Type.STRING, description: "The ID of the watch question this article most directly answers. If none, return empty string." },
          summary: { type: Type.STRING, description: "Two parts: (1) a verbatim quote or hard number from the article in quotes, then (2) one thesis-relative sentence (Supports/Threatens)." }
        },
        required: ["articleIndex", "material", "severity", "companyImpact", "answeredQuestionId", "summary"]
      }
    }
  },
  required: ["results"]
};

export function deriveThesisLabel(direction: string, companyImpact: string): string {
  if (companyImpact === 'neutral') return 'Neutral';
  
  if (direction === 'SHORT') {
    return companyImpact === 'positive' ? 'Threatens' : 'Supports';
  } else {
    return companyImpact === 'positive' ? 'Supports' : 'Threatens';
  }
}

export function normalizeDirection(directionLogic?: string, kind?: string, direction?: string): 'LONG' | 'SHORT' {
  const vals = [direction, directionLogic, kind].map(v => (v || '').toString().toUpperCase().trim());

  for (const v of vals) {
    if (!v) continue;
    if (/\bSHORT\b/.test(v) || /\bSHORTING\b/.test(v) || /\bSELL\b/.test(v) || /\bBEAR/.test(v) || v === 'FALSE' || v === '0') return 'SHORT';
    if (/\bLONG\b/.test(v) || /\bBUY\b/.test(v) || /\bBULL/.test(v) || v === 'TRUE' || v === '1') return 'LONG';
  }

  console.warn(`[WARNING] Unknown direction value. Defaulting to LONG.`);
  return 'LONG';
}

export async function judgeHoldingArticles(
  holding: { id: string, ticker: string, company: string, thesis: string, directionLogic: string, kind?: string, direction?: string, questions: {id: string, text: string}[] },
  articles: { id: string, title: string, excerpt: string, url: string, source: string, matchedQuestionId?: string }[]
) {
  if (articles.length === 0) return [];

  const CHUNK_SIZE = 10;
  const chunks: typeof articles[] = [];
  for (let i = 0; i < articles.length; i += CHUNK_SIZE) {
    chunks.push(articles.slice(i, i + CHUNK_SIZE));
  }

  const allResults: any[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    const entity = resolveEntity(holding.ticker, 'US', holding.company); // Use US as fallback for exchange

    let contextStr = `Holding: ${holding.ticker} (${holding.company})\n`;
    contextStr += `Canonical Entity Name: ${entity.canonicalName}\n`;
    if (entity.negativeAliases.length > 0) {
      contextStr += `WARNING: Do NOT confuse with the following negative aliases/competitors: ${entity.negativeAliases.join(', ')}\n`;
    }
    contextStr += `Thesis: ${holding.thesis}\n`;
    contextStr += `Direction Logic: ${holding.directionLogic || holding.direction || holding.kind}\n`;
    contextStr += `Watch Questions:\n${holding.questions.map(q => `- [ID: ${q.id}] ${q.text}`).join("\n")}\n\n`;
    
    contextStr += `Articles to evaluate:\n`;
    chunk.forEach((art, idx) => {
      contextStr += `\nArticle Index: ${idx + 1}\n`;
      contextStr += `Title: ${art.title}\n`;
      contextStr += `Source: ${art.source}\n`;
      contextStr += `Excerpt: ${art.excerpt ? art.excerpt.slice(0, 600) + (art.excerpt.length > 600 ? "..." : "") : "No excerpt available."}\n`;
      if (art.matchedQuestionId) {
        contextStr += `*Hint: This article was retrieved specifically to answer question ID: ${art.matchedQuestionId}*\n`;
      }
    });

    const prompt = `
You are an expert portfolio manager. Review the provided articles for the specified portfolio holding.

Your task is to output a JSON object containing a "results" array.
Evaluate EACH article STRICTLY using the provided excerpt. Do not use outside facts.

For each article:
- STEP 0 — ENTITY GATE (do this first): Confirm the holding is EXPLICITLY named in the article title or excerpt by ticker, company name, or a listed alias. If it is NOT literally present, immediately return material=false, severity=1, companyImpact=neutral and do not evaluate further. Do NOT infer relevance from a shared industry, sector, or theme keyword. Example: a general 'plastics regulation' story is NOT about a company merely because its name contains 'Plastics'.
- JURISDICTION RULE: Regulatory, legal, or policy news affects a holding only if the holding demonstrably operates in that jurisdiction OR the article explicitly ties the law to the holding by name. Never assume a US/state law affects a non-US company (e.g. an Indian .BO/.NS listing) absent an explicit link.
- Decide if the news is "material" (highly relevant and impactful). Set to true or false.
  * MATERIALITY DEFINITION: News is material if it could reasonably affect the company's revenue, margins, demand, costs, supply chain, competitive position, regulation/legal exposure, leadership, or forward guidance. This is INDEPENDENT of whether it answers a watch-question. Do not silently drop relevant fundamentals.
  * ENTITY GROUNDING RULE: If the article's PRIMARY entity is not the holding (by Canonical Entity Name, ticker, or known alias), or if it primarily discusses one of the WARNING negative aliases, return material=false and drop it.
- Assign a severity score (1-5).
  * 5 = Thesis-breaking / confirmed, quantified, company-specific event already happening (e.g. earnings miss with numbers, signed M&A, regulatory ban, guidance cut). Must cite a hard number or a definitive verb.
  * 4 = Major, confirmed, company-specific but not thesis-ending.
  * 3 = Notable confirmed fundamental development.
  * 2 = Routine/relevant but minor (single analyst note, small product update).
  * 1 = Mention / noise / opinion / "could/may/rumored".
  * Speculative, rumored, hedged ("could", "may", "reportedly", "is said to") news caps severity at 2.
  * Analyst-opinion / price-target pieces cap at 2.
  * If the article is not PRIMARILY about the holding, severity caps at 2.
  * Reserve 4-5 for confirmed, quantified, company-specific events ONLY.
- Assign a companyImpact ("positive", "negative", or "neutral"). Determine if the news is fundamentally good (positive) or bad (negative) for the company itself, IGNORING whether the holding is LONG or SHORT. Use the holding's thesis to add weight to the severity.
  * HEDGING RULE: If the only stated impact is hedged ('may', 'could', 'might', 'potentially', 'if'), companyImpact MUST be neutral and severity MUST be ≤2.
- Decide if it answers one of the Watch Questions. If so, provide the exact question ID in "answeredQuestionId". If not, leave empty (an empty string). A question match is NOT required for the news to be material.
  * EXPLICIT LINK RULE: Require an EXPLICIT causal link between the article fact and the matched watch-question. Don't bolt a thesis question onto unrelated news.
- Write a short summary of the material information.
  * The summary MUST be exactly two parts — (1) a verbatim quote or hard number copied from the article title/excerpt (wrap it in quotes), and (2) ONE sentence explaining what it means relative to THIS holding's thesis and direction (Supports/Threatens), using thesis-relative language only.
  * SUMMARY GROUNDING RULE: The summary may ONLY name companies/entities that literally appear in the article title or body. NEVER introduce a company name not present in the source. If no verbatim quote/number is available to extract, the article is not material — set material=false.

Data Context:
${contextStr}
`;

    console.log(`[judgeHoldingArticles] Asking AI to judge chunk ${i + 1}/${chunks.length} for ${holding.ticker}...`);
    
    let attempt = 0;
    let success = false;
    while (attempt < 3 && !success) {
      try {
        const responseText = await askAI({
          prompt,
          schema: judgeSchema,
          preferredModel: "gemini-2.5-flash"
        });
        const parsed = JSON.parse(responseText);
        let rawResults: any[] = [];
        if (parsed && parsed.results && Array.isArray(parsed.results)) {
          rawResults = parsed.results;
        } else if (parsed && Array.isArray(parsed)) {
          rawResults = parsed; // Fallback if groq returns the naked array
        }
        
        // Map integer index back to the real DB article.id
        let chunkResults: any[] = [];
        for (const r of rawResults) {
          const impact = r.companyImpact ? r.companyImpact.toLowerCase() : 'neutral';
          const direction = normalizeDirection(holding.directionLogic, holding.kind, holding.direction);
          const derivedLabel = deriveThesisLabel(direction, impact);
          
          console.log({
            ticker: holding.ticker,
            direction: holding.direction ?? holding.directionLogic,
            companyImpact: impact,
            derivedLabel
          });

          if (typeof r.articleIndex === 'number' && r.articleIndex >= 1 && r.articleIndex <= chunk.length) {
            chunkResults.push({
              ...r,
              direction: derivedLabel,
              articleId: chunk[r.articleIndex - 1].id
            });
          } else {
             if (r.articleId) {
               chunkResults.push({
                 ...r,
                 direction: derivedLabel
               });
             }
          }
        }

        // TIER 2: Re-judge high-severity / high-relevance findings
        if (process.env.TWO_TIER_JUDGE === 'true') {
          const needsRejudge = chunkResults.filter(r => r.material && r.severity >= 4);
          if (needsRejudge.length > 0) {
            console.log(`[judgeHoldingArticles] TIER 2: Re-judging ${needsRejudge.length} high-severity articles for ${holding.ticker}...`);
            
            const rejudgeArticles = chunk.filter(art => needsRejudge.some(r => r.articleId === art.id));
            let tier2Context = `Holding: ${holding.ticker} (${holding.company})\n`;
            tier2Context += `Thesis: ${holding.thesis}\n`;
            tier2Context += `Direction Logic: ${holding.directionLogic || holding.direction || holding.kind}\n`;
            tier2Context += `Watch Questions:\n${holding.questions.map(q => `- [ID: ${q.id}] ${q.text}`).join("\n")}\n\n`;
            tier2Context += `Articles to evaluate:\n`;
            rejudgeArticles.forEach((art, idx) => {
              tier2Context += `\nArticle Index: ${idx + 1}\n`;
              tier2Context += `Title: ${art.title}\n`;
              tier2Context += `Source: ${art.source}\n`;
              tier2Context += `Excerpt: ${art.excerpt ? art.excerpt.slice(0, 600) + (art.excerpt.length > 600 ? "..." : "") : "No excerpt available."}\n`;
              if (art.matchedQuestionId) {
                tier2Context += `*Hint: This article was retrieved specifically to answer question ID: ${art.matchedQuestionId}*\n`;
              }
            });

            // Give the API a brief rest before hitting the heavier model
            await new Promise(r => setTimeout(r, 2000));

            let t2Attempt = 0;
            let t2Success = false;
            while (t2Attempt < 3 && !t2Success) {
              try {
                const t2ResponseText = await askAI({
                  prompt: prompt.replace(contextStr, tier2Context),
                  schema: judgeSchema,
                  preferredModel: "gemini-2.5-flash",
                  groqModelOverride: "llama-3.3-70b-versatile"
                });
                
                const t2Parsed = JSON.parse(t2ResponseText);
                let t2RawResults: any[] = [];
                if (t2Parsed && t2Parsed.results && Array.isArray(t2Parsed.results)) {
                  t2RawResults = t2Parsed.results;
                } else if (t2Parsed && Array.isArray(t2Parsed)) {
                  t2RawResults = t2Parsed;
                }

                for (const t2r of t2RawResults) {
                  const t2Impact = t2r.companyImpact ? t2r.companyImpact.toLowerCase() : 'neutral';
                  const t2Direction = normalizeDirection(holding.directionLogic, holding.kind, holding.direction);
                  const t2Label = deriveThesisLabel(t2Direction, t2Impact);

                  console.log({
                    ticker: holding.ticker,
                    direction: holding.direction ?? holding.directionLogic,
                    companyImpact: t2Impact,
                    derivedLabel: t2Label
                  });

                  if (typeof t2r.articleIndex === 'number' && t2r.articleIndex >= 1 && t2r.articleIndex <= rejudgeArticles.length) {
                    const finalId = rejudgeArticles[t2r.articleIndex - 1].id;
                    const originalIdx = chunkResults.findIndex(r => r.articleId === finalId);
                    if (originalIdx !== -1) chunkResults[originalIdx] = {
                      ...t2r,
                      direction: t2Label,
                      articleId: finalId
                    };
                  } else if (t2r.articleId) {
                    const originalIdx = chunkResults.findIndex(r => r.articleId === t2r.articleId);
                    if (originalIdx !== -1) chunkResults[originalIdx] = {
                      ...t2r,
                      direction: t2Label
                    };
                  }
                }
                t2Success = true;
              } catch (err: any) {
                if (err instanceof LlmQuotaExhaustedError) throw err;
                t2Attempt++;
                if (err.status === 429 || (err.message && err.message.includes('429'))) {
                  if (t2Attempt >= 3) break;
                  await new Promise(r => setTimeout(r, 4000 * Math.pow(2, t2Attempt) + Math.random() * 1000));
                } else {
                  console.error(`[judgeHoldingArticles] TIER 2 Error:`, err);
                  break;
                }
              }
            }
          }
        }

        allResults.push(...chunkResults);
        success = true;
      } catch (err: any) {
        // Daily quota exhaustion — re-throw immediately, don't retry
        if (err instanceof LlmQuotaExhaustedError) {
          throw err;
        }
        attempt++;
        if (err.status === 429 || (err.message && err.message.includes('429'))) {
          if (attempt >= 3) break;
          const delay = 4000 * Math.pow(2, attempt) + Math.random() * 1000;
          await new Promise(r => setTimeout(r, delay));
        } else {
          console.error(`[judgeHoldingArticles] Error on chunk ${i + 1}:`, err);
          break; // Continue to next chunk on non-429 error
        }
      }
    }
    
    if (i < chunks.length - 1) {
      // 2s delay between chunks to pace TPM under the 6k limit
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  return allResults;
}



const briefSchema = {
  type: Type.OBJECT,
  properties: {
    brief: { 
      type: Type.STRING, 
      description: "The full markdown formatted daily brief." 
    }
  },
  required: ["brief"]
};

export async function generateDailyBrief(userId: string) {
  console.log(`[generateDailyBrief] Fetching undelivered findings... (User: ${userId})`);
  
  const findings = await prisma.finding.findMany({
    where: { 
      delivered: false,
      holding: { userId } 
    },
    include: {
      holding: true,
      article: true
    }
  });

  if (findings.length === 0) {
    console.log("[generateDailyBrief] No undelivered findings. Skipping brief generation.");
    return null;
  }

  let contextStr = "Here are the highly relevant findings detected over the last 24 hours:\n\n";
  
  findings.forEach(f => {
    contextStr += `[Finding]\n`;
    contextStr += `Holding: ${f.holding.ticker} (${f.holding.company})\n`;
    contextStr += `Kind: ${f.holding.kind}\n`;
    contextStr += `Thesis / Why Watching: ${f.holding.thesis}\n`;
    if (f.priceChangePct != null && f.volumeRatio != null) {
      contextStr += `Market Reaction: ${f.priceChangePct}% price change, ${f.volumeRatio}x average volume\n`;
    }
    contextStr += `Severity: ${f.severity}/5\n`;
    contextStr += `Direction: ${f.direction || 'Unknown'}\n`;
    contextStr += `Confidence: ${f.confidence != null ? f.confidence + '%' : 'Unknown'}\n`;
    contextStr += `Article Title: ${f.article.title}\n`;
    contextStr += `Article URL: ${f.article.url}\n`;
    contextStr += `Article Source: ${f.article.source}\n`;
    contextStr += `AI Summary: ${f.summary}\n\n`;
  });

  const prompt = `
You are an expert portfolio manager writing the Daily Disruption Brief for the portfolio owner.

Your task is to output a JSON object containing a "brief" property. 
The "brief" MUST be a beautifully formatted markdown report encompassing all the provided findings from the last 24 hours.

The markdown "brief" MUST follow a thesis-first layered disclosure layout:
- LEAD with a one-line portfolio headline (L0): how many holdings are threatened / supported / quiet today.
- **Two Distinct Sections**: You MUST separate holdings into "📈 Portfolio" (active investments) and "👀 Watchlist" (what's moving before you buy).
- Group BY HOLDING. For each holding with material findings, output an L1 line: <icon> TICKER — <Supports/Threatens/Mixed> your thesis · severity dots · market reaction if present. The icon must be 🟢 Supports / 🔴 Threatens / 🟡 Mixed / ⚪ Neutral (never buy/sell). Render severity as exactly 5 circles (e.g. 🔴🔴🔴⚪⚪).
- Under each holding, render its findings as L2: output the exact grounded summary provided (the quote + thesis-relative sentence) and hyperlink the article source inline ([Title](URL)). Links are secondary, the summary is primary. Do NOT output raw URLs.
- Add a short "Quiet today" footer listing tickers with no material findings.

Data Context:
${contextStr}
  `;

  console.log(`[generateDailyBrief] Asking AI to construct markdown brief...`);

  const responseText = await askAI({
    prompt,
    schema: briefSchema,
    preferredModel: "gemini-2.5-flash",
  });

  const parsed = JSON.parse(responseText);
  const brief = parsed?.brief;

  if (typeof brief === 'string' && brief.length > 0) {
    const briefDoc = await prisma.dailyBrief.create({
      data: {
        userId,
        content: brief
      }
    });
    console.log(`[generateDailyBrief] Saved daily brief.`);
    return briefDoc;
  }
  return null;
}

export async function generateHoldingCaption(
  holding: { ticker: string; company: string; thesis: string; directionLogic: string },
  findings: { summary: string; severity: number; direction?: string | null; title?: string }[]
): Promise<string | null> {
  if (findings.length === 0) return null;

  const topFindings = findings.slice(0, 6);
  let contextStr = `Holding: ${holding.company} (${holding.ticker})\nDirection: ${holding.directionLogic}\nThesis: ${holding.thesis}\n\nRecent Findings:\n`;
  topFindings.forEach((f, i) => {
    contextStr += `${i + 1}. [Severity ${f.severity}] ${f.summary}\n`;
  });

  const schema = {
    type: Type.OBJECT,
    properties: {
      caption: { type: Type.STRING }
    },
    required: ["caption"]
  };

  const prompt = `
    You are an expert portfolio manager writing a quick one-liner update for a holding in your portfolio.
    Review the recent findings and synthesize them into a SINGLE sentence (max ~22 words).
    
    RULES:
    1. Summarize WHAT is happening across the news (synthesize, don't just copy one item).
    2. State the thesis impact using exactly "supports your thesis", "threatens your thesis", or "pressures your thesis" (or "mixed:" if conflicting).
    3. NEVER use buy/sell/hold language or price targets.
    4. Plain English only. No markdown, no quotes.
    5. Ground only in the provided summaries. Do not invent facts or entities.

    Context:
    ${contextStr}
  `;

  try {
    const aiRes = await askAI({
      prompt,
      schema,
      preferredModel: 'gemini-2.5-flash',
      temperature: 0.2
    });

    const parsed = JSON.parse(aiRes);
    return typeof parsed.caption === 'string' ? parsed.caption : null;
  } catch (error: any) {
    if (error instanceof LlmQuotaExhaustedError) {
      throw error;
    }
    console.error(`[generateHoldingCaption] Error for ${holding.ticker}:`, error);
    return null;
  }
}
