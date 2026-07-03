import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { HoldingVerdict } from '@/lib/verdict'
import { FindingCard } from './FindingCard'
import { EarningsCard } from './EarningsCard'
import { ThesisHealthPanel } from './ThesisHealthPanel'

type HoldingVerdictCardProps = {
  verdict: HoldingVerdict
  reducedMotion?: boolean
}

// Simple deterministic pseudo-random generator
function seededRandom(seed: number) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

function generateSparkline(ticker: string, verdict: string, isReduced: boolean) {
  // Base deterministic seed based on ticker
  let seed = 0;
  for (let i = 0; i < ticker.length; i++) seed += ticker.charCodeAt(i);

  // Start point
  let currentY = 30;
  let points = [`0,${currentY}`];
  
  const segments = 10;
  const stepX = 500 / segments;

  for (let i = 1; i <= segments; i++) {
    // Random walk with drift based on verdict
    const r = seededRandom(seed + i) - 0.5; // -0.5 to 0.5
    
    let drift = 0;
    if (verdict === 'Supports') drift = -4; // drift up (lower Y)
    else if (verdict === 'Threatens') drift = 4; // drift down (higher Y)
    else drift = 0; // sideways

    currentY += (r * 10) + drift;
    
    // clamp
    if (currentY < 5) currentY = 5;
    if (currentY > 55) currentY = 55;

    points.push(`${i * stepX},${currentY.toFixed(1)}`);
  }

  const path = `M${points.map(p => {
    const [x,y] = p.split(',');
    return `${x},${y}`;
  }).join(' L')}`;

  const lastY = currentY;

  return { path, lastY };
}

export function HoldingVerdictCard({ verdict, reducedMotion = false }: HoldingVerdictCardProps) {
  const [expanded, setExpanded] = useState(false)

  const toggle = () => setExpanded(e => !e)

  let badgeColor = 'var(--text-muted)'
  let badgeBg = 'var(--surface-overlay)'
  let badgeBorder = 'var(--border)'
  let badgeText = ''
  let gradientColor = 'var(--text-muted)'

  switch (verdict.verdict) {
    case 'Supports':
      badgeColor = 'var(--bullish)'
      badgeBg = 'var(--bullish-dim)'
      badgeBorder = 'var(--bullish-border)'
      badgeText = '🟢 SUPPORTS YOUR THESIS'
      gradientColor = 'var(--bullish)'
      break
    case 'Threatens':
      badgeColor = 'var(--bearish)'
      badgeBg = 'var(--bearish-dim)'
      badgeBorder = 'var(--bearish-border)'
      badgeText = '🔴 THREATENS YOUR THESIS'
      gradientColor = 'var(--bearish)'
      break
    case 'Mixed':
      badgeColor = 'var(--accent-amber)'
      badgeBg = 'var(--surface-sunken)'
      badgeBorder = 'var(--border)'
      badgeText = '🟡 MIXED SIGNALS'
      gradientColor = 'var(--accent)'
      break
    case 'Neutral':
      badgeColor = 'var(--text-secondary)'
      badgeText = '⚪ NEUTRAL'
      break
    case 'Quiet':
      badgeColor = 'var(--text-muted)'
      badgeText = '⚪ QUIET — NOTHING MATERIAL'
      break
  }

  const dirBadgeColor = verdict.directionLogic === 'LONG' ? 'var(--bullish)' : 'var(--bearish)'
  const dirBadgeBg = verdict.directionLogic === 'LONG' ? 'var(--bullish-dim)' : 'var(--bearish-dim)'
  const dirBadgeBorder = verdict.directionLogic === 'LONG' ? 'var(--bullish-border)' : 'var(--bearish-border)'

  const { path: sparklinePath, lastY } = useMemo(() => generateSparkline(verdict.ticker, verdict.verdict, reducedMotion), [verdict.ticker, verdict.verdict, reducedMotion])

  return (
    <motion.div
      className="card"
      style={{ padding: 'var(--sp-5)', marginBottom: 'var(--sp-4)', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
      whileHover={reducedMotion ? undefined : { scale: 1.01 }}
      onClick={toggle}
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggle() }}
    >
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', flexWrap: 'wrap', marginBottom: 'var(--sp-4)' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {verdict.ticker}
          </span>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 500 }}>
            {verdict.company}
          </span>
          <span
            className="label"
            style={{
              background: dirBadgeBg,
              color: dirBadgeColor,
              border: `1px solid ${dirBadgeBorder}`,
              marginLeft: 'auto',
              fontWeight: 600,
              fontSize: '0.75rem',
              letterSpacing: '0.05em'
            }}
          >
            {verdict.directionLogic}
          </span>
        </div>

        {/* Verdict Badge */}
        <div style={{ marginBottom: 'var(--sp-4)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span
            className="label"
            style={{
              background: badgeBg,
              color: badgeColor,
              border: `1px solid ${badgeBorder}`,
              fontWeight: 600,
              fontSize: '0.75rem',
              letterSpacing: '0.05em',
              padding: '4px 8px'
            }}
          >
            {badgeText}
          </span>
          
          {/* Severity Meter */}
          {verdict.maxSeverity > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Max Sev
              </span>
              <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', height: '12px' }}>
                {[1, 2, 3, 4, 5].map((i) => {
                  let color = 'var(--surface-overlay)'
                  if (i <= 3) color = 'var(--accent)'
                  if (i === 4) color = 'var(--sev-4)'
                  if (i === 5) color = 'var(--bearish)'
                  
                  const isLit = i <= verdict.maxSeverity
                  
                  return (
                    <div 
                      key={i}
                      style={{ 
                        width: '4px', 
                        height: `${12 + (i - 1) * 1.5}px`, 
                        backgroundColor: isLit ? color : 'var(--border-hi)',
                        borderRadius: '1px',
                        transformOrigin: 'bottom'
                      }}
                    />
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Teaser */}
        {!expanded && (verdict.caption || verdict.topFinding?.summary) && (
           <p style={{
             fontSize: '1rem',
             color: 'var(--text-secondary)',
             lineHeight: 1.5,
             margin: '0 0 var(--sp-6) 0'
           }}>
             {verdict.caption || verdict.topFinding?.summary}
           </p>
        )}

        {/* Sparkline */}
        {!expanded && (
          <div style={{ width: '100%', height: '60px', position: 'relative' }}>
            <svg width="100%" height="100%" viewBox="0 0 500 60" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
              <defs>
                <linearGradient id={`sparkGrad-${verdict.holdingId}`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={gradientColor} stopOpacity="0.1" />
                  <stop offset="100%" stopColor={gradientColor} stopOpacity="1" />
                </linearGradient>
              </defs>
              <path
                d={sparklinePath}
                fill="none"
                stroke={`url(#sparkGrad-${verdict.holdingId})`}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
              <circle 
                r="4" 
                fill={gradientColor} 
                cx="500"
                cy={lastY}
              />
            </svg>
          </div>
        )}

      </div>

      {/* L2 Grounded Summaries */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ marginTop: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', borderTop: '1px solid var(--border)', paddingTop: 'var(--sp-4)' }}>
              
              {verdict.earningsEvents && verdict.earningsEvents.length > 0 && (
                <div onClick={e => e.stopPropagation()}>
                  <EarningsCard ticker={verdict.ticker} event={
                    // Prefer upcoming, otherwise latest reported
                    verdict.earningsEvents.filter((e: any) => e.status === "UPCOMING").sort((a: any, b: any) => new Date(a.reportDate).getTime() - new Date(b.reportDate).getTime())[0] ||
                    verdict.earningsEvents.filter((e: any) => e.status === "REPORTED").sort((a: any, b: any) => new Date(b.reportDate).getTime() - new Date(a.reportDate).getTime())[0]
                  } />
                </div>
              )}

              {verdict.thesisHealth && verdict.falsifiers && verdict.falsifiers.length > 0 && (
                <div onClick={e => e.stopPropagation()}>
                  <ThesisHealthPanel 
                    ticker={verdict.ticker}
                    health={verdict.thesisHealth}
                    falsifiers={verdict.falsifiers}
                    allFindings={verdict.findings}
                  />
                </div>
              )}

              {verdict.findings.length > 0 ? (
                verdict.findings.map((f, i) => (
                  // Stop propagation so clicking inside a card doesn't toggle the parent
                  <div key={f.id} onClick={e => e.stopPropagation()}>
                    <FindingCard finding={f} index={i} />
                  </div>
                ))
              ) : (
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>No recent findings available.</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
