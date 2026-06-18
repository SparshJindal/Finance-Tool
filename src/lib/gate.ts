import { embedText } from "./providers/ai";
import { cosineSimilarity } from "./math";

export interface GateCandidate {
  articleId: string;
  holdingId: string;
  similarity: number;
}

export async function filterRelevance(
  articles: { id: string; title: string; source: string }[],
  holdings: { id: string; questions: { text: string }[] }[]
): Promise<GateCandidate[]> {
  const threshold = parseFloat(process.env.RELEVANCE_THRESHOLD || "0.72");
  const candidates: GateCandidate[] = [];

  console.log(`[Gate] Embedding ${holdings.length} holding question-sets...`);
  const holdingEmbeddings = new Map<string, number[]>();
  for (const h of holdings) {
    if (h.questions.length === 0) continue;
    const text = h.questions.map(q => q.text).join(" ");
    const vec = await embedText(text);
    holdingEmbeddings.set(h.id, vec);
    await new Promise(res => setTimeout(res, 300)); // strict rate limit buffer
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

  for (const a of articles) {
    const aVec = articleEmbeddings.get(a.id);
    if (!aVec) continue;

    for (const h of holdings) {
      const hVec = holdingEmbeddings.get(h.id);
      if (!hVec) continue;

      totalEvaluated++;
      const similarity = cosineSimilarity(aVec, hVec);
      
      if (similarity >= threshold) {
        passed++;
        candidates.push({ articleId: a.id, holdingId: h.id, similarity });
      }
    }
  }

  console.log(`[Gate] Relevance Filter Complete: ${totalEvaluated} pairs evaluated -> ${passed} passed (${threshold}+).`);
  return candidates;
}
