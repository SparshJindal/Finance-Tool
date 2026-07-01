'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { HoldingVerdict } from '@/lib/verdict'
import { FindingCard } from './FindingCard'
import { EarningsCard } from './EarningsCard'
import { ThesisHealthPanel } from './ThesisHealthPanel'
import { Severity } from './Severity'

type HoldingVerdictCardProps = {
  verdict: HoldingVerdict
  reducedMotion?: boolean
}

export function HoldingVerdictCard({ verdict, reducedMotion = false }: HoldingVerdictCardProps) {
  const [expanded, setExpanded] = useState(false)

  const toggle = () => setExpanded(e => !e)

  let badgeColor = 'var(--text-muted)'
  let badgeBg = 'var(--surface-overlay)'
  let badgeBorder = 'var(--border)'
  let badgeText = ''

  switch (verdict.verdict) {
    case 'Supports':
      badgeColor = 'var(--bullish)'
      badgeBg = 'var(--bullish-dim)'
      badgeBorder = 'var(--bullish-border)'
      badgeText = '🟢 Supports your thesis'
      break
    case 'Threatens':
      badgeColor = 'var(--bearish)'
      badgeBg = 'var(--bearish-dim)'
      badgeBorder = 'var(--bearish-border)'
      badgeText = '🔴 Threatens your thesis'
      break
    case 'Mixed':
      badgeColor = 'var(--accent-amber)'
      badgeBg = 'var(--surface-sunken)'
      badgeBorder = 'var(--border)'
      badgeText = '🟡 Mixed signals'
      break
    case 'Neutral':
      badgeColor = 'var(--text-secondary)'
      badgeText = '⚪ Neutral'
      break
    case 'Quiet':
      badgeColor = 'var(--text-muted)'
      badgeText = '⚪ Quiet — nothing material'
      break
  }

  return (
    <motion.div
      className="card"
      style={{ padding: 'var(--sp-4)', marginBottom: 'var(--sp-3)', cursor: 'pointer' }}
      whileHover={reducedMotion ? undefined : { scale: 1.01 }}
      onClick={toggle}
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggle() }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
        
        {/* L1 Header row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)', alignItems: 'center', justifyContent: 'space-between' }}>
          
          {/* Identity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-md)',
              fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '-0.01em',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {verdict.ticker}
            </span>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', fontWeight: 500 }}>
              {verdict.company}
            </span>
            <span
              className="label"
              style={{
                background: verdict.directionLogic === 'LONG' ? 'var(--bullish-dim)' : 'var(--bearish-dim)',
                color: verdict.directionLogic === 'LONG' ? 'var(--bullish)' : 'var(--bearish)',
                border: `1px solid ${verdict.directionLogic === 'LONG' ? 'var(--bullish-border)' : 'var(--bearish-border)'}`,
              }}
            >
              {verdict.directionLogic}
            </span>
          </div>

          {/* Verdict + Severity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)' }}>
             <span
              className="label"
              style={{
                background: badgeBg,
                color: badgeColor,
                border: `1px solid ${badgeBorder}`,
                fontWeight: 600,
              }}
            >
              {badgeText}
            </span>
            {verdict.maxSeverity > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Max Sev
                </span>
                <Severity value={verdict.maxSeverity} size="sm" label={false} />
              </div>
            )}
          </div>
        </div>

        {/* Teaser */}
        {!expanded && (verdict.caption || verdict.topFinding?.summary) && (
           <p style={{
             fontSize: 'var(--text-sm)',
             color: 'var(--text-secondary)',
             lineHeight: 1.5,
             display: '-webkit-box',
             WebkitLineClamp: 1,
             WebkitBoxOrient: 'vertical',
             overflow: 'hidden'
           }}>
             {verdict.caption || verdict.topFinding?.summary}
           </p>
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
