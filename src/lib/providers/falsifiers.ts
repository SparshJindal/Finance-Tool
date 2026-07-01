import { askAI, LlmQuotaExhaustedError } from "./ai"
import { Type } from "@google/genai"
import type { Holding, Falsifier } from "@prisma/client"
import type { FindingData } from "@/components/FindingCard"

export async function generateThesisFalsifiers(holding: Pick<Holding, 'company' | 'ticker' | 'directionLogic' | 'thesis'>) {
  const systemPrompt = `You are an expert investment analyst utilizing a Popperian approach to thesis validation.
Given the company, the investor's direction logic (LONG or SHORT), and their investment thesis, your job is to produce 2-3 SPECIFIC, OBSERVABLE, and DISCONFIRMING conditions that would falsify this thesis ("what would prove the investor wrong").

CRITICAL RULES:
1. Each condition must be concrete and measurable (e.g., a specific metric threshold, a distinct event, or a clear trend). DO NOT use vague statements like "sentiment worsens" or "competition increases".
2. You MUST be direction-aware:
   - For a SHORT thesis, a falsifier is evidence the company is SUCCEEDING (e.g., "margins expand for 2+ quarters", "successfully launches new product X").
   - For a LONG thesis, a falsifier is evidence the company is FAILING (e.g., "revenue growth decelerates below 10%", "major regulatory ban in key market").
3. Provide exactly 2-3 items.
4. Each item needs a 'text' (the condition) and a 'rationale' (why this breaks the core thesis).
`

  const prompt = `
Company: ${holding.company} (${holding.ticker})
Direction Logic: ${holding.directionLogic}
Investment Thesis:
${holding.thesis}
`

  const schema = {
    type: Type.OBJECT,
    properties: {
      falsifiers: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING, description: "The specific, observable disconfirming condition" },
            rationale: { type: Type.STRING, description: "Why this breaks the thesis" }
          },
          required: ["text", "rationale"]
        },
        description: "List of 2-3 falsifiers"
      }
    },
    required: ["falsifiers"]
  }

  const result = await askAI({ prompt: systemPrompt + "\n" + prompt, schema, temperature: 0.3 })
  return result.falsifiers as { text: string, rationale: string }[]
}

export async function evaluateFalsifiers(
  holding: Pick<Holding, 'company' | 'ticker'>,
  falsifiers: Pick<Falsifier, 'id' | 'text' | 'rationale'>[],
  recentFindings: Pick<FindingData, 'id' | 'summary' | 'direction' | 'severity' | 'sourceTitle'>[]
) {
  if (falsifiers.length === 0 || recentFindings.length === 0) {
    return { results: [] }
  }

  const systemPrompt = `You are a strict, objective thesis auditor. 
You are given a list of Falsifiers (conditions that would prove the investor's thesis WRONG) and a list of recent material news Findings about the company.

Your task is to evaluate each Falsifier against the recent Findings to determine its current status.

STATUS RULES:
- TRIGGERED: There is clear, undeniable confirming evidence in the findings that the falsifier has occurred.
- WATCH: There is partial, emerging, or related evidence in the findings, but it is not yet definitive.
- UNTRIGGERED: There is no relevant evidence in the recent findings.

INSTRUCTIONS:
1. Return an array of results, one for each Falsifier.
2. Provide the 'index' of the Falsifier (0-indexed based on the provided list).
3. Provide the determined 'status'.
4. If the status is WATCH or TRIGGERED, provide 'matchedFindingIndices': an array of the indices (0-indexed) of the specific Findings that act as evidence. If UNTRIGGERED, this must be empty.
5. Provide a brief 'note' explaining your reasoning.
`

  let falsifiersText = "FALSIFIERS:\n"
  falsifiers.forEach((f, idx) => {
    falsifiersText += `[${idx}] Condition: ${f.text}\n    Rationale: ${f.rationale || 'N/A'}\n`
  })

  let findingsText = "\nRECENT FINDINGS:\n"
  recentFindings.forEach((f, idx) => {
    findingsText += `[${idx}] Title: ${f.sourceTitle}\n    Severity: ${f.severity}/5 | Direction: ${f.direction}\n    Summary: ${f.summary}\n`
  })

  const prompt = `
Company: ${holding.company} (${holding.ticker})

${falsifiersText}
${findingsText}
`

  const schema = {
    type: Type.OBJECT,
    properties: {
      results: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            index: { type: Type.INTEGER, description: "The index of the falsifier in the provided list" },
            status: { type: Type.STRING, enum: ["UNTRIGGERED", "WATCH", "TRIGGERED"], description: "The evaluated status" },
            matchedFindingIndices: { 
              type: Type.ARRAY, 
              items: { type: Type.INTEGER },
              description: "Indices of the findings that support the WATCH or TRIGGERED status. Empty if UNTRIGGERED."
            },
            note: { type: Type.STRING, description: "Brief explanation of the decision" }
          },
          required: ["index", "status", "matchedFindingIndices", "note"]
        }
      }
    },
    required: ["results"]
  }

  // We let LlmQuotaExhaustedError bubble up so pipeline.ts can catch it
  const result = await askAI({ prompt: systemPrompt + "\n" + prompt, schema, temperature: 0.2 })
  return result as {
    results: {
      index: number
      status: "UNTRIGGERED" | "WATCH" | "TRIGGERED"
      matchedFindingIndices: number[]
      note: string
    }[]
  }
}
