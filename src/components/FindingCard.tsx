'use client'

import { useState, useTransition } from 'react'
import { motion } from 'framer-motion'
import { Severity } from './Severity'
import { DirectionBadge } from './DirectionBadge'
import { submitFindingFeedback } from '@/app/actions'

export type FindingData = {
  id: string
  holdingId: string
  ticker: string
  company: string
  severity: number
  direction: string
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

export function FindingCard({
  finding,
  index,
}: {
  finding: FindingData
  index: number
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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{
        opacity: { duration: 0.3, delay: index * 0.04, ease: 'easeOut' },
        y: { type: 'spring', stiffness: 250, damping: 24, delay: index * 0.04 },
        layout: { type: 'spring', stiffness: 300, damping: 28 }
      }}
      className={`card ${pulseClass}`}
      style={{
        padding: 'var(--sp-5)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--sp-4)',
        position: 'relative',
        overflow: 'hidden',
        transition: 'border-color 0.2s ease, transform 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.borderColor = 'var(--accent-border)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.borderColor = 'var(--border)'
      }}
    >
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1 }}>
            {finding.ticker}
          </span>
          <DirectionBadge direction={finding.direction} />
          <Severity value={finding.severity} />
        </div>
        <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
          <button
            onClick={() => handleFeedback('up')}
            className="btn btn-ghost"
            style={{
              padding: '4px',
              color: feedback === 'up' ? 'var(--tailwind-green)' : 'var(--text-muted)'
            }}
            aria-label="Helpful finding"
          >
            <UpIcon active={feedback === 'up'} />
          </button>
          <button
            onClick={() => handleFeedback('down')}
            className="btn btn-ghost"
            style={{
              padding: '4px',
              color: feedback === 'down' ? 'var(--threat)' : 'var(--text-muted)'
            }}
            aria-label="Not helpful finding"
          >
            <DownIcon active={feedback === 'down'} />
          </button>
        </div>
      </div>

      {/* Summary */}
      <p style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--text-md)', color: 'var(--text-primary)', lineHeight: 1.5, margin: 0 }}>
        {finding.summary}
      </p>

      {/* Meta bottom */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'var(--sp-2)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)', flex: 1, minWidth: 0, paddingRight: 'var(--sp-4)' }}>
          {finding.questionText && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
              <span className="label" style={{ background: 'var(--base-2)', color: 'var(--text-muted)' }}>MATCH</span>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {finding.questionText}
              </span>
            </div>
          )}
        </div>
        <a
          href={finding.sourceLink}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-secondary"
          style={{ fontSize: 'var(--text-xs)', flexShrink: 0, textDecoration: 'none' }}
        >
          {finding.sourceLink && (
            <img 
              src={`https://www.google.com/s2/favicons?domain=${new URL(finding.sourceLink).hostname}&sz=32`} 
              alt="" 
              style={{ width: '14px', height: '14px', borderRadius: '2px' }} 
            />
          )}
          Source ↗
        </a>
      </div>
    </motion.div>
  )
}
