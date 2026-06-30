import type { FindingData } from '@/components/FindingCard'

export type HoldingVerdict = {
  holdingId: string
  ticker: string
  company: string
  directionLogic: 'LONG' | 'SHORT'   // the user's position
  thesis: string
  // Aggregate thesis signal across this holding's findings:
  verdict: 'Supports' | 'Threatens' | 'Mixed' | 'Neutral' | 'Quiet'
  maxSeverity: number          // 0–5, 0 if quiet
  supportCount: number
  threatenCount: number
  neutralCount: number
  topFinding: FindingData | null   // highest-severity non-neutral finding
  findings: FindingData[]          // all findings for this holding, sev desc
  isQuiet: boolean                 // true if no material (non-neutral) findings
  caption?: string | null          // AI-synthesized one-liner caption
}

export function buildHoldingVerdicts(
  holdings: { id: string; ticker: string; company: string; directionLogic: string; thesis: string; verdictCaption?: string | null }[],
  findings: FindingData[]
): HoldingVerdict[] {
  const verdicts: HoldingVerdict[] = []
  
  // Group findings by holdingId
  const findingsByHolding = new Map<string, FindingData[]>()
  for (const f of findings) {
    if (!findingsByHolding.has(f.holdingId)) {
      findingsByHolding.set(f.holdingId, [])
    }
    findingsByHolding.get(f.holdingId)!.push(f)
  }

  for (const h of holdings) {
    const rawFindings = findingsByHolding.get(h.id) || []
    
    // Sort findings for this holding: severity desc, then newest (assuming findings array is already newest-first or we sort by ID/time? We can't sort by createdAt if it's not in FindingData, but the findings passed from page.tsx are already ordered by createdAt desc)
    // Array.prototype.sort is stable in modern JS, so this preserves original time ordering as a tie-breaker.
    const sortedFindings = [...rawFindings].sort((a, b) => b.severity - a.severity)
    
    let supportCount = 0
    let threatenCount = 0
    let neutralCount = 0
    let maxSeverity = 0
    let topFinding: FindingData | null = null
    
    for (const f of sortedFindings) {
      let normalizedDir = 'Neutral'
      const rawDir = f.direction?.toUpperCase()
      
      if (rawDir === 'SUPPORTS' || rawDir === 'BULLISH') {
        normalizedDir = 'Supports'
      } else if (rawDir === 'THREATENS' || rawDir === 'BEARISH') {
        normalizedDir = 'Threatens'
      } else {
        normalizedDir = 'Neutral'
      }
      
      if (normalizedDir === 'Supports') supportCount++
      else if (normalizedDir === 'Threatens') threatenCount++
      else neutralCount++
      
      if (normalizedDir !== 'Neutral') {
        if (f.severity > maxSeverity) {
          maxSeverity = f.severity
        }
        if (!topFinding) {
          topFinding = f // First one is the highest severity because of sort
        }
      }
    }
    
    let verdict: HoldingVerdict['verdict'] = 'Quiet'
    
    if (rawFindings.length > 0) {
      if (supportCount === 0 && threatenCount === 0) {
        verdict = 'Neutral'
      } else if (supportCount > 0 && threatenCount === 0) {
        verdict = 'Supports'
      } else if (threatenCount > 0 && supportCount === 0) {
        verdict = 'Threatens'
      } else if (supportCount > 0 && threatenCount > 0) {
        verdict = 'Mixed'
      }
    }
    
    verdicts.push({
      holdingId: h.id,
      ticker: h.ticker,
      company: h.company,
      directionLogic: (h.directionLogic.toUpperCase() === 'SHORT' ? 'SHORT' : 'LONG'),
      thesis: h.thesis || '',
      verdict,
      maxSeverity,
      supportCount,
      threatenCount,
      neutralCount,
      topFinding,
      findings: sortedFindings,
      isQuiet: (supportCount === 0 && threatenCount === 0),
      caption: h.verdictCaption ?? null
    })
  }
  
  // Sort the returned array (movers first)
  const tierMap: Record<HoldingVerdict['verdict'], number> = {
    'Threatens': 4,
    'Mixed': 4,
    'Supports': 3,
    'Neutral': 2,
    'Quiet': 1
  }
  
  verdicts.sort((a, b) => {
    const tierDiff = tierMap[b.verdict] - tierMap[a.verdict]
    if (tierDiff !== 0) return tierDiff
    
    if (b.maxSeverity !== a.maxSeverity) {
      return b.maxSeverity - a.maxSeverity
    }
    
    return b.threatenCount - a.threatenCount
  })
  
  return verdicts
}
