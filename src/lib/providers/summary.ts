import { Type } from "@google/genai";
import { askAI, LlmQuotaExhaustedError } from "./ai";
import { prisma } from "@/lib/db";
import { fetchQuote } from "./quote";

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
          summary: { type: Type.STRING, description: "A concise 1-2 sentence summary of why this is material." }
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
    if (v === 'SHORT' || v === 'SHORTING' || v === 'FALSE' || v === '0') return 'SHORT';
    if (v === 'LONG' || v === 'TRUE' || v === '1') return 'LONG';
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

    let contextStr = `Holding: ${holding.ticker} (${holding.company})\n`;
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
- Decide if the news is "material" (highly relevant and impactful). Set to true or false.
  * MATERIALITY DEFINITION: News is material if it could reasonably affect the company's revenue, margins, demand, costs, supply chain, competitive position, regulation/legal exposure, leadership, or forward guidance. This is INDEPENDENT of whether it answers a watch-question. Do not silently drop relevant fundamentals.
  * ENTITY GROUNDING RULE: If the article's PRIMARY entity is not the holding (by ticker, company name, or known alias), return material=false and drop it.
- Assign a severity score (1-5).
  * SEVERITY SCALE: Routine-but-relevant fundamentals (e.g., a product price change) should land as low/moderate severity (1-3). Major disruptions, massive earnings beats/misses, or thesis-breaking news are 4-5.
- Assign a companyImpact ("positive", "negative", or "neutral"). Determine if the news is fundamentally good (positive) or bad (negative) for the company itself, IGNORING whether the holding is LONG or SHORT. Use the holding's thesis to add weight to the severity.
  * HEDGING RULE: If the impact can only be asserted with hedges like "potentially/if/could", downgrade companyImpact to "neutral".
- Decide if it answers one of the Watch Questions. If so, provide the exact question ID in "answeredQuestionId". If not, leave empty (an empty string). A question match is NOT required for the news to be material.
  * EXPLICIT LINK RULE: Require an EXPLICIT causal link between the article fact and the matched watch-question. Don't bolt a thesis question onto unrelated news.
- Write a short 1-2 sentence summary of the material information.
  * SUMMARY GROUNDING RULE: The summary may ONLY name companies/entities that literally appear in the article title or body. NEVER introduce a company name not present in the source (e.g. do not write "Auroactive Pharma" for an Aurobindo holding if it's not in the text).

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

The markdown "brief" MUST contain:
- A clear, engaging Title.
- **Two Distinct Sections**: You MUST separate findings into "📈 Portfolio" (active investments) and "👀 Watchlist" (what's moving before you buy). For Portfolio items, link the finding back to the thesis.
- **Industry-Level Rollup**: Group related holdings/events and discuss the macro/sector implications within those sections.
- **Per-Stock Summary**: For each affected stock, link the finding(s) back to the investment thesis (or 'why watching'). If Market Reaction data is available, render it explicitly under or next to the stock header (e.g. \`AAPL (🟢 🔴🔴🔴⚪⚪) | -2.5%, 1.2x avg vol\`).
- **Severity & Direction Visuals**: Render a direction icon (🟢 bullish / 🔴 bearish / ⚪ neutral) alongside the exactly 5 severity circles next to the stock headers or key points (e.g. 🟢 🔴🔴🔴⚪⚪ for bullish, severity 3).
- **Hyperlinks**: You MUST hyperlink all referenced articles back to their original URLs using markdown (e.g. [Article Title](URL)). Do NOT output raw URLs.

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
