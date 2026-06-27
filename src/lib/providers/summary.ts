import { Type } from "@google/genai";
import { askAI } from "./ai";
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
          direction: { type: Type.STRING, description: "BULLISH, BEARISH, or NEUTRAL" },
          answeredQuestionId: { type: Type.STRING, description: "The ID of the watch question this article most directly answers. If none, return empty string." },
          summary: { type: Type.STRING, description: "A concise 1-2 sentence summary of why this is material." }
        },
        required: ["articleIndex", "material", "severity", "direction", "answeredQuestionId", "summary"]
      }
    }
  },
  required: ["results"]
};

export async function judgeHoldingArticles(
  holding: { id: string, ticker: string, company: string, thesis: string, directionLogic: string, questions: {id: string, text: string}[] },
  articles: { id: string, title: string, excerpt: string, url: string, source: string }[]
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
    contextStr += `Direction Logic: ${holding.directionLogic}\n`;
    contextStr += `Watch Questions:\n${holding.questions.map(q => `- [ID: ${q.id}] ${q.text}`).join("\n")}\n\n`;
    
    contextStr += `Articles to evaluate:\n`;
    chunk.forEach((art, idx) => {
      contextStr += `\nArticle Index: ${idx + 1}\n`;
      contextStr += `Title: ${art.title}\n`;
      contextStr += `Source: ${art.source}\n`;
      contextStr += `Excerpt: ${art.excerpt ? art.excerpt.slice(0, 600) + (art.excerpt.length > 600 ? "..." : "") : "No excerpt available."}\n`;
    });

    const prompt = `
You are an expert portfolio manager. Review the provided articles for the specified portfolio holding.

Your task is to output a JSON object containing a "results" array.
Evaluate EACH article STRICTLY using the provided excerpt. Do not use outside facts.

For each article:
- Decide if the news is "material" (highly relevant and impactful). Set to true or false.
  * MATERIALITY DEFINITION: News is material if it could reasonably affect the company's revenue, margins, demand, costs, supply chain, competitive position, regulation/legal exposure, leadership, or forward guidance. This is INDEPENDENT of whether it answers a watch-question. Do not silently drop relevant fundamentals.
- Assign a severity score (1-5).
  * SEVERITY SCALE: Routine-but-relevant fundamentals (e.g., a product price change) should land as low/moderate severity (1-3). Major disruptions, massive earnings beats/misses, or thesis-breaking news are 4-5.
- Assign a direction (BULLISH, BEARISH, or NEUTRAL) based on the "Direction Logic". Use the holding's thesis to add weight to the severity and determine the exact direction.
- Decide if it answers one of the Watch Questions. If so, provide the exact question ID in "answeredQuestionId". If not, leave empty (an empty string). A question match is NOT required for the news to be material.
- Write a short 1-2 sentence summary of the material information.

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
        for (const r of rawResults) {
          if (typeof r.articleIndex === 'number' && r.articleIndex >= 1 && r.articleIndex <= chunk.length) {
            allResults.push({
              ...r,
              articleId: chunk[r.articleIndex - 1].id
            });
          } else {
             // Handle cases where the model hallucinates an invalid index or returns articleId directly (if it ignored the schema somehow)
             if (r.articleId) {
               allResults.push(r);
             }
          }
        }
        success = true;
      } catch (err: any) {
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
      await new Promise(r => setTimeout(r, 1000));
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
