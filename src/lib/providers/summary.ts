import { Type } from "@google/genai";
import { askAI } from "./ai";
import { prisma } from "@/lib/db";
import { GateCandidate } from "../gate";

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
          direction: { type: Type.STRING, description: "OPPORTUNITY, RISK, or NEUTRAL" },
          summary: { type: Type.STRING, description: "Short 1 sentence summary" }
        },
        required: ["articleId", "holdingId", "severity", "direction", "summary"]
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
    let contextStr = "Here are the highly relevant articles mapped to specific holdings:\\n\\n";
    
    chunk.forEach(c => {
      const art = articles.find(a => a.id === c.articleId);
      const hol = holdings.find(h => h.id === c.holdingId);
      if (!art || !hol) return;

      contextStr += `[Candidate Match]\\n`;
      contextStr += `Holding: ${hol.ticker} (${hol.company})\\n`;
      contextStr += `Thesis: ${hol.thesis}\\n`;
      contextStr += `Watch Questions: ${hol.questions.map(q => q.text).join(" ")}\\n`;
      contextStr += `Article ID: ${art.id}\\n`;
      contextStr += `Holding ID: ${hol.id}\\n`;
      contextStr += `Article Title: ${art.title}\\n`;
      contextStr += `Article URL: ${art.url}\\n`;
      contextStr += `Article Source: ${art.source}\\n`;
      if (c.questionId) {
        const matchedQ = hol.questions.find(q => q.id === c.questionId);
        if (matchedQ) {
          contextStr += `Matched Question ID: ${c.questionId}\\n`;
          contextStr += `Matched Question Text: ${matchedQ.text}\\n`;
        }
      }
      contextStr += `Relevance Score: ${c.similarity.toFixed(3)}\\n\\n`;
    });

    const prompt = `
You are an expert portfolio manager. Review the provided candidate articles mapped to portfolio holdings.

Your task is to output a JSON object containing a "findings" array.
For EACH candidate match, assign a severity (1-5), direction, and short summary.

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
        if (parsed.findings && Array.isArray(parsed.findings)) {
          allFindings.push(...parsed.findings);
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
      holdings.some(h => h.id === f.holdingId) && articles.some(a => a.id === f.articleId)
    );
    if (validFindings.length > 0) {
      await prisma.finding.createMany({
        data: validFindings.map((f: any) => {
          const candidate = candidates.find(c => c.articleId === f.articleId && c.holdingId === f.holdingId);
          return {
            articleId: f.articleId,
            holdingId: f.holdingId,
            severity: f.severity,
            direction: f.direction,
            summary: f.summary,
            questionId: candidate?.questionId || null
          };
        })
      });

      // Fire push notification for high-severity findings
      const criticalFindings = validFindings.filter((f: any) => f.severity >= 4);
      if (criticalFindings.length > 0) {
        try {
          const { sendPushAlert } = await import('@/lib/push');
          const topFinding = criticalFindings[0];
          const holding = holdings.find(h => h.id === topFinding.holdingId);
          await sendPushAlert({
            title: `🔴 ${holding?.ticker || 'Portfolio'} — Severity ${topFinding.severity}/5`,
            body: topFinding.summary,
          });
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

  let contextStr = "Here are the highly relevant findings detected over the last 24 hours:\\n\\n";
  
  findings.forEach(f => {
    contextStr += `[Finding]\\n`;
    contextStr += `Holding: ${f.holding.ticker} (${f.holding.company})\\n`;
    contextStr += `Thesis: ${f.holding.thesis}\\n`;
    contextStr += `Severity: ${f.severity}/5\\n`;
    contextStr += `Direction: ${f.direction}\\n`;
    contextStr += `Article Title: ${f.article.title}\\n`;
    contextStr += `Article URL: ${f.article.url}\\n`;
    contextStr += `Article Source: ${f.article.source}\\n`;
    contextStr += `AI Summary: ${f.summary}\\n\\n`;
  });

  const prompt = `
You are an expert portfolio manager writing the Daily Disruption Brief for the portfolio owner.

Your task is to output a JSON object containing a "brief" property. 
The "brief" MUST be a beautifully formatted markdown report encompassing all the provided findings from the last 24 hours.

The markdown "brief" MUST contain:
- A clear, engaging Title.
- **Industry-Level Rollup**: Group related holdings/events and discuss the macro/sector implications.
- **Per-Stock Summary**: For each affected stock, link the finding(s) back to the investment thesis. 
- **Severity Visuals**: Attach the severity score visually next to the stock headers or key points using exactly 5 circles (e.g. 🔴🔴🔴⚪⚪ for severity 3, 🔴🔴🔴🔴🔴 for 5).
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

  if (parsed.brief) {
    const brief = await prisma.dailyBrief.create({
      data: { 
        content: parsed.brief,
        userId
      }
    });
    console.log(`[generateDailyBrief] Saved daily brief.`);
    return brief;
  }
  return null;
}
