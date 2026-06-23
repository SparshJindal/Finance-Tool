import { embedText } from "./providers/ai";
import { cosineSimilarity } from "./math";

export interface GateCandidate {
  articleId: string;
  holdingId: string;
  similarity: number;
  questionId?: string | null;
}

export async function filterRelevance(
  articles: { id: string; title: string; source: string }[],
  holdings: { id: string; questions: { id: string; text: string }[] }[]
): Promise<GateCandidate[]> {
  const threshold = parseFloat(process.env.RELEVANCE_THRESHOLD || "0.1");
  const candidates: GateCandidate[] = [];

  console.log(`[Gate] Embedding ${holdings.length} holding question-sets individually...`);
  const holdingEmbeddings = new Map<string, { id: string, vec: number[] }[]>();
  for (const h of holdings) {
    if (h.questions.length === 0) continue;
    const qEmbeds = [];
    for (const q of h.questions) {
      const vec = await embedText(q.text);
      qEmbeds.push({ id: q.id, vec });
      await new Promise(res => setTimeout(res, 300)); // strict rate limit buffer
    }
    holdingEmbeddings.set(h.id, qEmbeds);
  }

  console.log(`[Gate] Embedding ${articles.length} articles...`);
  const articleEmbeddings = new Map<string, number[]>();
  for (const a of articles) {
    const text = `${a.title} - ${a.source}`;
    const vec = await embedText(text);
    articleEmbeddings.set(a.id, vec);
    await new Promise(res => setTimeout(res, 300)); // strict rate limit buffer
  }

  console.log(`[Gate] Computing cosine similarity against threshold: ${threshold}`);
  let totalEvaluated = 0;
  let passed = 0;
  const allScores: number[] = [];

  for (const a of articles) {
    const aVec = articleEmbeddings.get(a.id);
    if (!aVec) continue;

    for (const h of holdings) {
      const qEmbeds = holdingEmbeddings.get(h.id);
      if (!qEmbeds || qEmbeds.length === 0) continue;

      totalEvaluated++;
      let maxSimilarity = -1;
      let bestQuestionId: string | null = null;

      for (const q of qEmbeds) {
        const sim = cosineSimilarity(aVec, q.vec);
        if (sim > maxSimilarity) {
          maxSimilarity = sim;
          bestQuestionId = q.id;
        }
      }
      
      allScores.push(maxSimilarity);

      if (maxSimilarity >= threshold) {
        passed++;
        candidates.push({ 
          articleId: a.id, 
          holdingId: h.id, 
          similarity: maxSimilarity,
          questionId: bestQuestionId
        });
      }
    }
  }

  if (allScores.length > 0) {
    allScores.sort((a, b) => a - b);
    const min = allScores[0].toFixed(3);
    const max = allScores[allScores.length - 1].toFixed(3);
    const median = allScores[Math.floor(allScores.length / 2)].toFixed(3);
    console.log(`[Gate] Score Distribution: Min=${min} | Median=${median} | Max=${max}`);
  }

  console.log(`[Gate] Relevance Filter Complete: ${totalEvaluated} pairs evaluated -> ${passed} passed (${threshold}+).`);
  return candidates;
}
