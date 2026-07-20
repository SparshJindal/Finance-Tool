import { Type } from '@google/genai'
import { askAI } from './providers/ai'
import { prisma } from './db'

export async function evaluateFalsifier(falsifierId: string, holdingId: string, ticker: string, company: string, thesis: string, text: string, rationale: string | null) {
  try {
    const tavilyKey = process.env.TAVILY_API_KEY
    if (!tavilyKey) {
      console.warn('[FalsifierAgent] Missing TAVILY_API_KEY')
      return false
    }

    // 1. Search for specific news related to the falsifier condition
    const query = `${company} ${text} news`
    const searchRes = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: tavilyKey,
        query,
        search_depth: 'basic',
        days: 7,
        max_results: 3
      })
    })

    if (!searchRes.ok) {
      console.warn(`[FalsifierAgent] Tavily search failed: ${searchRes.status}`)
      return false
    }

    const searchData = await searchRes.json()
    const results = searchData.results || []
    if (results.length === 0) {
      return false // No relevant news found
    }

    const contextStr = results.map((r: any) => `Title: ${r.title}\nURL: ${r.url}\nContent: ${r.content}`).join('\n\n')

    // 2. Evaluate with LLM
    const prompt = `You are a strict financial analyst monitoring an investment thesis.
Company: ${company} (${ticker})
Investment Thesis: ${thesis}

FALSIFIER CONDITION (If this happens, the thesis is broken):
"${text}"
Rationale: ${rationale || 'N/A'}

RECENT SEARCH RESULTS:
${contextStr}

Task: Determine if the recent news conclusively PROVES that the FALSIFIER CONDITION has been met.
Respond strictly in JSON with:
- "triggered": boolean (true if condition met, false if not)
- "confidence": number between 1 and 100
- "reasoning": string explaining why, citing the search results
- "sourceUrl": string (the most relevant URL from the search results, if triggered)
- "summary": string (a punchy 1-sentence summary of the breaking news, if triggered)
`

    const schema = {
      type: Type.OBJECT,
      properties: {
        triggered: { type: Type.BOOLEAN },
        confidence: { type: Type.NUMBER },
        reasoning: { type: Type.STRING },
        sourceUrl: { type: Type.STRING },
        summary: { type: Type.STRING }
      },
      required: ['triggered', 'confidence', 'reasoning']
    };

    const responseText = await askAI({
      prompt,
      schema,
      preferredModel: 'gemini-2.5-flash'
    });

    const evalResult = JSON.parse(responseText) as { triggered: boolean, confidence: number, reasoning: string, sourceUrl?: string, summary?: string };

    // 3. Action if triggered
    if (evalResult.triggered && evalResult.confidence >= 80) {
      console.log(`[FalsifierAgent] TRIGGERED for ${ticker}: ${text}`)

      // Upsert the article from Tavily
      const sourceUrl = evalResult.sourceUrl || `falsifier://${falsifierId}/${Date.now()}`;
      const article = await prisma.article.upsert({
        where: { url: sourceUrl },
        update: {},
        create: {
          url: sourceUrl,
          title: evalResult.summary || 'Falsifier Alert News',
          source: 'Tavily Search',
          contentHash: `falsifier-${falsifierId}-${Date.now()}`,
          publishedAt: new Date(),
        }
      });

      // Create a high severity finding
      const finding = await prisma.finding.create({
        data: {
          holdingId,
          summary: `FALSIFIER TRIGGERED: ${evalResult.summary || text}`,
          severity: 5,
          direction: 'Threatens',
          confidence: evalResult.confidence,
          additionalSources: [evalResult.reasoning], // store reasoning here
          articleId: article.id
        }
      })

      // Update falsifier status
      await prisma.falsifier.update({
        where: { id: falsifierId },
        data: {
          status: 'TRIGGERED',
          triggeredAt: new Date(),
          evidenceFindingIds: {
            push: finding.id
          }
        }
      })

      return true
    }

    return false
  } catch (error) {
    console.error(`[FalsifierAgent] Error evaluating ${ticker}:`, error)
    return false
  }
}
