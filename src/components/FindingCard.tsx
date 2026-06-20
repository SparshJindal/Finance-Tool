'use client'

import { useState, useTransition } from 'react'
import { motion } from 'framer-motion'
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

export function FindingCard({
  finding,
  index,
  reducedMotion,
  itemVariants,
}: {
  finding: FindingData
  index: number
  reducedMotion?: boolean
  itemVariants?: any
}) {
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(finding.feedback)
  const [isPending, startTransition] = useTransition()

  const isHighSeverity = finding.severity >= 4
  const pulseClass = isHighSeverity ? 'severity-pulse attention-ping' : ''

  const handleFeedback = (type: 'up' | 'down') => {
    const newFeedback = feedback === type ? null : type
    setFeedback(newFeedback)
    startTransition(() => {
      submitFindingFeedback(finding.id, newFeedback)
    })
  }

  return (
    <motion.div
      layout
      variants={reducedMotion ? undefined : itemVariants}
      initial={reducedMotion ? { opacity: 0, y: 16 } : undefined}
      animate={reducedMotion ? { opacity: 1, y: 0 } : undefined}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={reducedMotion ? {
        opacity: { duration: 0.25, delay: index * 0.03, ease: 'easeOut' },
        y: { type: 'spring', stiffness: 300, damping: 26, delay: index * 0.03 },
        layout: { type: 'spring', stiffness: 300, damping: 28 }
      } : { layout: { type: 'spring', stiffness: 300, damping: 28 } }}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
          <RelevanceBadge severity={finding.severity} size="sm" />
          <Severity value={finding.severity} size="sm" />
        </div>
      </div>

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
          {finding.questionText && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', minWidth: 0 }}>
              <span className="label" style={{ background: 'var(--surface-overlay)', color: 'var(--text-muted)', border: '1px solid var(--border)', flexShrink: 0 }}>MATCH</span>
              <span style={{
                fontFamily: 'var(--font-ui)',
                fontSize: 'var(--text-xs)',
                color: 'var(--text-muted)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {finding.questionText}
              </span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', flexShrink: 0 }}>
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
}
