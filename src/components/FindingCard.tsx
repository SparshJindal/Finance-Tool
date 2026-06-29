'use client'

import { useState, useTransition, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Severity } from './Severity'
import { RelevanceBadge } from './RelevanceBadge'
import { submitFindingFeedback } from '@/app/actions'

export type FindingData = {
  id: string
  holdingId: string
  ticker: string
  company: string
  severity: number

  summary: string
  sourceLink: string
  sourceTitle: string
  questionText: string | null
  feedback: 'up' | 'down' | null
  direction?: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | null
  confidence?: number | null
}

function UpIcon({ active }: { active: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: active ? 'scale(1.1)' : 'scale(1)', transition: 'transform 0.2s' }}>
      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
    </svg>
  )
}

function DownIcon({ active }: { active: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: active ? 'scale(1.1)' : 'scale(1)', transition: 'transform 0.2s' }}>
      <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-2"></path>
    </svg>
  )
}

/** Severity-to-left-bar color */
function sevColor(sev: number): string {
  const colors = ['var(--sev-1)', 'var(--sev-2)', 'var(--sev-3)', 'var(--sev-4)', 'var(--sev-5)']
  return colors[Math.min(4, Math.max(0, sev - 1))]
}

export const FindingCard = memo(function FindingCard({
  finding,
  index,
  reducedMotion,
  itemVariants,
  disableLayout,
}: {
  finding: FindingData
  index: number
  reducedMotion?: boolean
  itemVariants?: any
  disableLayout?: boolean
}) {
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(finding.feedback)
  const [confirmation, setConfirmation] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const isHighSeverity = finding.severity >= 4
  const pulseClass = (!reducedMotion && isHighSeverity && index < 2) ? 'severity-pulse attention-ping' : ''

  const handleFeedback = (type: 'up' | 'down') => {
    const newFeedback = feedback === type ? null : type
    setFeedback(newFeedback)
    setConfirmation(null)
    startTransition(async () => {
      await submitFindingFeedback(finding.id, newFeedback)
      if (newFeedback) {
        setConfirmation(newFeedback === 'up' ? "Got it" : "Thanks — we'll surface fewer like this")
        setTimeout(() => setConfirmation(null), 3000)
      }
    })
  }

  return (
    <motion.div
      layout={disableLayout ? false : true}
      variants={reducedMotion ? undefined : itemVariants}
      initial={reducedMotion ? { opacity: 0, y: 16 } : undefined}
      animate={reducedMotion ? { opacity: 1, y: 0 } : undefined}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={reducedMotion ? {
        opacity: { duration: 0.25, delay: index * 0.03, ease: 'easeOut' },
        y: { type: 'spring', stiffness: 300, damping: 26, delay: index * 0.03 },
        layout: disableLayout ? undefined : { type: 'spring', stiffness: 300, damping: 28 }
      } : { layout: disableLayout ? undefined : { type: 'spring', stiffness: 300, damping: 28 } }}
      whileHover={reducedMotion ? undefined : { scale: 1.01 }}
      whileTap={reducedMotion ? undefined : { scale: 0.99 }}
      className={`card ${pulseClass}`}
      style={{
        padding: 'var(--sp-5)',
        paddingLeft: 'calc(var(--sp-5) + 3px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--sp-3)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Severity accent bar */}
      <span className="sev-bar" style={{ background: sevColor(finding.severity) }} />

      {/* Top Header: Ticker · Direction · Severity ····· Feedback */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-md)',
            fontWeight: 700,
            color: 'var(--text-primary)',
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.01em',
          }}>
            {finding.ticker}
          </span>
          <span style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
            fontWeight: 400,
          }}>
            {finding.company}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
          {finding.direction && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '10px',
              fontWeight: 500,
              fontFamily: 'var(--font-mono)',
              color: finding.direction === 'BULLISH' ? 'var(--bullish)' : finding.direction === 'BEARISH' ? 'var(--bearish)' : 'var(--text-muted)',
              background: 'var(--surface-overlay)',
              padding: '2px 6px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
            }}>
              {finding.direction === 'BULLISH' && <><span>🟢</span> Supports thesis</>}
              {finding.direction === 'BEARISH' && <><span>🔴</span> Threatens thesis</>}
              {finding.direction === 'NEUTRAL' && <><span>⚪</span> Neutral</>}
            </span>
          )}
          {finding.confidence != null && (
            <span style={{
              fontSize: '10px',
              fontWeight: 500,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-muted)',
              background: 'var(--surface-overlay)',
              padding: '2px 6px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
            }}>
              confidence: {finding.confidence}%
            </span>
          )}
          <RelevanceBadge severity={finding.severity} size="sm" />
          <Severity value={finding.severity} size="sm" />
        </div>
      </div>

      {/* Promoted Question Text */}
      {finding.questionText && (
        <div style={{
          background: 'var(--surface-overlay)',
          borderLeft: '3px solid var(--accent)',
          padding: 'var(--sp-2) var(--sp-3)',
          borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
          fontSize: 'var(--text-xs)',
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-ui)',
          lineHeight: 1.4,
        }}>
          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Flagged because:</span> {finding.questionText}
        </div>
      )}

      {/* Summary — secondary weight */}
      <p style={{
        fontFamily: 'var(--font-ui)',
        fontSize: 'var(--text-sm)',
        color: 'var(--text-secondary)',
        lineHeight: 1.55,
        margin: 0,
      }}>
        {finding.summary}
      </p>

      {/* Meta bottom: question match · source link · feedback */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--sp-3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', flex: 1, minWidth: 0 }}>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', flexShrink: 0 }}>
          {/* Confirmation Message */}
          <AnimatePresence>
            {confirmation && (
              <motion.span
                initial={reducedMotion ? { opacity: 0 } : { opacity: 0, x: 10 }}
                animate={reducedMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
                exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: 10 }}
                style={{
                  fontSize: '11px',
                  color: 'var(--accent)',
                  marginRight: 'var(--sp-2)',
                  fontFamily: 'var(--font-mono)'
                }}
              >
                {confirmation}
              </motion.span>
            )}
          </AnimatePresence>

          {/* Feedback thumbs */}
          <motion.button
            whileHover={reducedMotion ? undefined : { scale: 1.05 }}
            whileTap={reducedMotion ? undefined : { scale: 0.95 }}
            onClick={() => handleFeedback('up')}
            className="btn btn-ghost"
            style={{
              padding: '4px',
              color: feedback === 'up' ? 'var(--bullish)' : 'var(--text-muted)'
            }}
            aria-label="Helpful finding"
          >
            <UpIcon active={feedback === 'up'} />
          </motion.button>
          <motion.button
            whileHover={reducedMotion ? undefined : { scale: 1.05 }}
            whileTap={reducedMotion ? undefined : { scale: 0.95 }}
            onClick={() => handleFeedback('down')}
            className="btn btn-ghost"
            style={{
              padding: '4px',
              color: feedback === 'down' ? 'var(--bearish)' : 'var(--text-muted)'
            }}
            aria-label="Not helpful finding"
          >
            <DownIcon active={feedback === 'down'} />
          </motion.button>

          {/* Source link */}
          <motion.a
            whileHover={reducedMotion ? undefined : { scale: 1.02 }}
            whileTap={reducedMotion ? undefined : { scale: 0.98 }}
            href={finding.sourceLink}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
            style={{ fontSize: 'var(--text-xs)', textDecoration: 'none', marginLeft: 'var(--sp-1)' }}
          >
            {finding.sourceLink && (
              <img 
                src={`https://www.google.com/s2/favicons?domain=${new URL(finding.sourceLink).hostname}&sz=32`} 
                alt="" 
                style={{ width: '12px', height: '12px', borderRadius: '2px', opacity: 0.7 }} 
              />
            )}
            Source ↗
          </motion.a>
        </div>
      </div>
    </motion.div>
  )
})
