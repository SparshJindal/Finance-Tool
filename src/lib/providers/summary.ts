import { Type } from "@google/genai";
import { askAI } from "./ai";
import { prisma } from "@/lib/db";
import { GateCandidate } from "../gate";
import { fetchQuote } from "./quote";

const judgeSchema = {
  type: Type.OBJECT,
  properties: {
    results: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          articleId: { type: Type.STRING },
          material: { type: Type.BOOLEAN, description: "True if the article contains highly relevant, impactful news about the holding" },
          severity: { type: Type.INTEGER, description: "1 to 5, where 5 is extremely impactful" },
          direction: { type: Type.STRING, description: "BULLISH, BEARISH, or NEUTRAL" },
          answeredQuestionId: { type: Type.STRING, description: "The ID of the watch question this article most directly answers. If none, return empty string." },
          summary: { type: Type.STRING, description: "A concise 1-2 sentence summary of why this is material." }
        },
        required: ["articleId", "material", "severity", "direction", "answeredQuestionId", "summary"]
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
    chunk.forEach(art => {
      contextStr += `\nArticle ID: ${art.id}\n`;
      contextStr += `Title: ${art.title}\n`;
      contextStr += `Source: ${art.source}\n`;
      contextStr += `Excerpt: ${art.excerpt || "No excerpt available."}\n`;
    });

    const prompt = `
You are an expert portfolio manager. Review the provided articles for the specified portfolio holding.

Your task is to output a JSON object containing a "results" array.
Evaluate EACH article STRICTLY using the provided excerpt against the holding's thesis, direction logic, and watch-questions. Do not use outside facts.
For each article:
- Decide if the news is "material" (highly relevant and impactful). Set to true or false.
- Assign a severity score (1-5).
- Assign a direction (BULLISH, BEARISH, or NEUTRAL) based on the "Direction Logic".
- Decide if it answers one of the Watch Questions. If so, provide the exact question ID in "answeredQuestionId". If not, leave empty.
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
        if (parsed && parsed.results && Array.isArray(parsed.results)) {
          allResults.push(...parsed.results);
        } else if (parsed && Array.isArray(parsed)) {
          allResults.push(...parsed); // Fallback if groq returns the naked array
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

const evalSchema = {
  type: Type.OBJECT,
  properties: {
    findings: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          articleId: { type: Type.STRING },
          holdingId: { type: Type.STRING },
          severity: { type: Type.INTEGER, description: "1 to 5" },
          direction: { type: Type.STRING, description: "BULLISH, BEARISH, or NEUTRAL" },
          confidence: { type: Type.INTEGER, description: "0 to 100" },
          summary: { type: Type.STRING, description: "Short 1 sentence summary" },
          answeredQuestionId: { type: Type.STRING, description: "id of the watch question this article actually answers, or empty string" },
          answer: { type: Type.STRING, description: "one-line answer to that question from the article, or empty string" },
          answerConfidence: { type: Type.INTEGER, description: "0 to 100, how directly the article answers the question" }
        },
        required: ["articleId", "holdingId", "severity", "direction", "confidence", "summary", "answeredQuestionId", "answer", "answerConfidence"]
      }
    }
  },
  required: ["findings"]
};

export async function evaluateCandidates(candidates: GateCandidate[]) {
  if (candidates.length === 0) {
    console.log("[evaluateCandidates] No candidates to process.");
    return;
  }

  console.log(`[evaluateCandidates] Fetching data for ${candidates.length} candidates...`);

  const holdingIds = Array.from(new Set(candidates.map(c => c.holdingId)));
  const articleIds = Array.from(new Set(candidates.map(c => c.articleId)));

  const holdings = await prisma.holding.findMany({
    where: { id: { in: holdingIds } },
    include: { questions: true }
  });

  const articles = await prisma.article.findMany({
    where: { id: { in: articleIds } }
  });

  const CHUNK_SIZE = 10;
  const chunks: GateCandidate[][] = [];
  for (let i = 0; i < candidates.length; i += CHUNK_SIZE) {
    chunks.push(candidates.slice(i, i + CHUNK_SIZE));
  }

  const allFindings: any[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    
    // Fetch quotes for holdings in this chunk
    const chunkHoldingIds = Array.from(new Set(chunk.map(c => c.holdingId)));
    const chunkQuotes = new Map<string, { priceChangePct: number, volumeRatio: number } | null>();
    for (const hid of chunkHoldingIds) {
      const h = holdings.find(h => h.id === hid);
      if (h) {
        const quote = await fetchQuote(h.ticker, h.exchange);
        chunkQuotes.set(hid, quote);
      }
    }

    let contextStr = "Here are the highly relevant articles mapped to specific holdings:\n\n";
    
    chunk.forEach(c => {
      const art = articles.find(a => a.id === c.articleId);
      const hol = holdings.find(h => h.id === c.holdingId);
      if (!art || !hol) return;

      const quote = chunkQuotes.get(hol.id);

      contextStr += `[Candidate Match]\n`;
      contextStr += `Holding: ${hol.ticker} (${hol.company})\n`;
      contextStr += `Thesis: ${hol.thesis}\n`;
      if (quote) {
        contextStr += `Market Reaction: ${quote.priceChangePct}% price change, ${quote.volumeRatio}x average volume\n`;
      }
      contextStr += `Holding Direction Logic: ${hol.directionLogic}\n`;
      contextStr += `Watch Questions:\n${hol.questions.map(q => `- ${q.id}: ${q.text}`).join("\n")}\n`;
      contextStr += `Article ID: ${art.id}\n`;
      contextStr += `Holding ID: ${hol.id}\n`;
      contextStr += `Article Title: ${art.title}\n`;
      contextStr += `Article URL: ${art.url}\n`;
      contextStr += `Article Source: ${art.source}\n`;
      if (art.excerpt) {
        contextStr += `Article Excerpt: ${art.excerpt}\n`;
      }
      if (c.questionId) {
        const matchedQ = hol.questions.find(q => q.id === c.questionId);
        if (matchedQ) {
          contextStr += `Matched Question ID: ${c.questionId}\n`;
          contextStr += `Matched Question Text: ${matchedQ.text}\n`;
        }
      }
      contextStr += `Relevance Score: ${c.similarity.toFixed(3)}\n\n`;
    });

    const prompt = `
You are an expert portfolio manager. Review the provided candidate articles mapped to portfolio holdings.

Your task is to output a JSON object containing a "findings" array.
For EACH candidate match, assign a severity/relevance score (1-5), a short summary, a "direction" (BULLISH, BEARISH, or NEUTRAL), and a "confidence" score (0-100).
Use the "Holding Direction Logic" to determine whether the news is BULLISH or BEARISH for *this investor's specific position*. For example, if the investor's logic is "SHORT", then negative news for the company is BULLISH for the investor's position.
From the Watch Questions provided, decide if the article answers any. Pick the single best-answered one and return its id in "answeredQuestionId", provide a one-line "answer", and rate the "answerConfidence" (0-100). If none are answered, return empty strings and 0 for confidence.

Data Context:
${contextStr}
    `;

    console.log(`[evaluateCandidates] Asking AI to evaluate severity for chunk ${i + 1}/${chunks.length}...`);

    let attempt = 0;
    const maxTries = 3;
    let success = false;

    while (attempt < maxTries && !success) {
      try {
        const responseText = await askAI({
          prompt,
          schema: evalSchema,
          preferredModel: "gemini-2.5-flash",
        });

        const parsed = JSON.parse(responseText);
        if (parsed && parsed.findings && Array.isArray(parsed.findings)) {
          allFindings.push(...parsed.findings);
        } else if (parsed && Array.isArray(parsed)) {
          allFindings.push(...parsed); // Fallback if groq returns the naked array
        }
        success = true;
      } catch (err: any) {
        attempt++;
        if (err.status === 429 || (err.message && err.message.includes('429'))) {
          if (attempt >= maxTries) {
            console.warn(`[evaluateCandidates] Max 429 retries reached for chunk ${i + 1}. Skipping.`);
            break;
          }
          // Exponential backoff: 8s, 16s + jitter
          const baseDelay = 4000 * Math.pow(2, attempt); 
          const jitter = Math.floor(Math.random() * 1000);
          console.warn(`[evaluateCandidates] 429 Rate Limit hit. Retrying chunk ${i + 1} in ${baseDelay + jitter}ms (Attempt ${attempt}/${maxTries})`);
          await new Promise(r => setTimeout(r, baseDelay + jitter));
        } else {
          console.error(`[evaluateCandidates] Error on chunk ${i + 1}:`, err);
          break;
        }
      }
    }

    // Small baseline delay between sequential chunks to ease rate limit
    if (i < chunks.length - 1) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  console.log(`[evaluateCandidates] Processing AI output... Saving ${allFindings.length} total findings.`);

  if (allFindings.length > 0) {
    const validFindings = allFindings.filter((f: any) => 
      f.articleId && f.holdingId && f.severity != null && f.summary &&
      holdings.some(h => h.id === f.holdingId) && articles.some(a => a.id === f.articleId)
    );
    if (validFindings.length > 0) {
      // Fetch quotes for the final findings before saving
      const findingsToSave = await Promise.all(validFindings.map(async (f: any) => {
        const candidate = candidates.find(c => c.articleId === f.articleId && c.holdingId === f.holdingId);
        const holding = holdings.find(h => h.id === f.holdingId);
        let quote = null;
        if (holding) {
          quote = await fetchQuote(holding.ticker, holding.exchange);
        }
        const fallbackQuestionId = candidate?.questionId || null;
        const validQuestionId = f.answeredQuestionId && holding?.questions.some(q => q.id === f.answeredQuestionId) 
          ? f.answeredQuestionId 
          : fallbackQuestionId;

        return {
          articleId: f.articleId,
          holdingId: f.holdingId,
          severity: f.severity,
          direction: f.direction || null,
          confidence: f.confidence || null,
          summary: f.answer ? `${f.summary} Answer: ${f.answer}` : f.summary,
          priceChangePct: quote?.priceChangePct ?? null,
          volumeRatio: quote?.volumeRatio ?? null,
          questionId: validQuestionId,
        };
      }));

      await prisma.finding.createMany({
        data: findingsToSave
      });

      // Fire push notification
      const PUSH_ANSWER_CONFIDENCE = parseInt(process.env.PUSH_ANSWER_CONFIDENCE || '70', 10);
      const PUSH_MIN_SEVERITY = parseInt(process.env.PUSH_MIN_SEVERITY || '3', 10);

      const criticalFindings = validFindings.filter((f: any) => {
        const holding = holdings.find(h => h.id === f.holdingId);
        return holding?.kind === 'PORTFOLIO' && 
               f.answeredQuestionId && 
               f.answeredQuestionId.trim() !== '' &&
               f.answerConfidence >= PUSH_ANSWER_CONFIDENCE &&
               f.severity >= PUSH_MIN_SEVERITY;
      });
      if (criticalFindings.length > 0) {
        try {
          const { sendPushAlert } = await import('@/lib/push');
          const topFinding = criticalFindings[0];
          const holding = holdings.find(h => h.id === topFinding.holdingId);
          if (holding) {
            await sendPushAlert(holding.userId, {
              title: `🔴 ${holding.ticker} — Severity ${topFinding.severity}/5`,
              body: topFinding.summary,
            });
          }
        } catch (pushErr) {
          console.error('[evaluateCandidates] Push notification failed:', pushErr);
        }
      }
    }
  }
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
    preferredModel: "gemini-2.5-pro",
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
