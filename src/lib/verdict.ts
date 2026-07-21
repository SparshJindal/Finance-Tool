import type { FindingData } from '@/components/feed/FindingCard'

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
  earningsEvents?: any[]
  falsifiers?: any[]
  thesisHealth?: { score: number, label: string, triggeredCount: number, watchCount: number }
}

export function buildHoldingVerdicts(
  holdings: { id: string; ticker: string; company: string; directionLogic: string; thesis: string; verdictCaption?: string | null; earningsEvents?: any[]; falsifiers?: any[] }[],
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

    let thesisHealth;
    if (h.falsifiers) {
      thesisHealth = computeThesisHealth(h.falsifiers, verdict);
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
      caption: h.verdictCaption ?? null,
      earningsEvents: h.earningsEvents,
      falsifiers: h.falsifiers,
      thesisHealth
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

export function computeThesisHealth(falsifiers: any[], verdict: HoldingVerdict['verdict']) {
  let score = 100;
  let triggeredCount = 0;
  let watchCount = 0;

  for (const f of falsifiers) {
    if (f.status === 'TRIGGERED') {
      score -= 25;
      triggeredCount++;
    } else if (f.status === 'WATCH') {
      score -= 10;
      watchCount++;
    }
  }

  if (verdict === 'Threatens') score -= 10;
  else if (verdict === 'Mixed') score -= 5;

  score = Math.max(0, Math.min(100, score));

  let label = "Intact";
  if (score < 25) label = "Broken";
  else if (score < 50) label = "Cracking";
  else if (score < 75) label = "Under pressure";

  return { score, label, triggeredCount, watchCount };
}
