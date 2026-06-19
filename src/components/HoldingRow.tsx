'use client'

import { useState } from 'react'
import { deleteHolding, updateHolding, studyHolding } from '@/app/actions'
import type { Holding, Competitor, Question } from '@prisma/client'
import { motion } from 'framer-motion'
import { useReducedMotion } from '@/hooks/useReducedMotion'

type HoldingWithDetails = Holding & { competitors: Competitor[], questions: Question[] }

export function HoldingRow({ holding }: { holding: HoldingWithDetails }) {
  const [isEditing, setIsEditing] = useState(false)
  const reducedMotion = useReducedMotion()

  if (isEditing) {
    return (
      <form
        action={async (fd) => {
          await updateHolding(fd)
          setIsEditing(false)
        }}
        className="card"
        style={{
          padding: 'var(--sp-6)',
          border: '1px solid var(--accent-border)',
        }}
      >
        <input type="hidden" name="id" value={holding.id} />

        <p className="section-label" style={{ marginBottom: 'var(--sp-4)' }}>
          Editing — {holding.ticker}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)', marginBottom: 'var(--sp-4)' }}>
          <div>
            <label className="section-label" style={{ display: 'block', marginBottom: 'var(--sp-2)' }}>Ticker</label>
            <input name="ticker" defaultValue={holding.ticker} required className="input" />
          </div>
          <div>
            <label className="section-label" style={{ display: 'block', marginBottom: 'var(--sp-2)' }}>Company</label>
            <input name="company" defaultValue={holding.company} required className="input" />
          </div>
        </div>

        <div style={{ marginBottom: 'var(--sp-4)' }}>
          <label className="section-label" style={{ display: 'block', marginBottom: 'var(--sp-2)' }}>Thesis</label>
          <textarea name="thesis" defaultValue={holding.thesis} required rows={2} className="input" style={{ resize: 'vertical' }} />
        </div>

        <div style={{ marginBottom: 'var(--sp-5)' }}>
          <label className="section-label" style={{ display: 'block', marginBottom: 'var(--sp-2)' }}>Direction</label>
          <select name="directionLogic" defaultValue={holding.directionLogic} className="input">
            <option value="LONG">LONG</option>
            <option value="SHORT">SHORT</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
          <motion.button whileHover={reducedMotion ? undefined : { scale: 1.02 }} whileTap={reducedMotion ? undefined : { scale: 0.98 }} type="submit" className="btn btn-primary">Save Changes</motion.button>
          <motion.button whileHover={reducedMotion ? undefined : { scale: 1.02 }} whileTap={reducedMotion ? undefined : { scale: 0.98 }} type="button" onClick={() => setIsEditing(false)} className="btn btn-secondary">Cancel</motion.button>
        </div>
      </form>
    )
  }

  return (
    <motion.div
      whileHover={reducedMotion ? undefined : { scale: 1.01 }}
      className="card card-lift"
      style={{ padding: 'var(--sp-5)' }}
    >
      {/* Top row: ticker + meta + actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--sp-4)' }}>

        {/* Left: identity */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', flexWrap: 'wrap', marginBottom: 'var(--sp-2)' }}>
            {/* Ticker — mono, prominent */}
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-lg)',
              fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '-0.01em',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {holding.ticker}
            </span>

            {/* Direction chip */}
            <span
              className="label"
              style={{
                background: holding.directionLogic === 'LONG' ? 'var(--bullish-dim)' : 'var(--bearish-dim)',
                color: holding.directionLogic === 'LONG' ? 'var(--bullish)' : 'var(--bearish)',
                border: `1px solid ${holding.directionLogic === 'LONG' ? 'var(--bullish-border)' : 'var(--bearish-border)'}`,
              }}
            >
              {holding.directionLogic}
            </span>

            {/* Sector chip */}
            {holding.sector && (
              <span className="label" style={{
                background: 'var(--surface-overlay)',
                color: 'var(--text-muted)',
                border: '1px solid var(--border)',
              }}>
                {holding.sector}
              </span>
            )}
          </div>

          {/* Company */}
          <p style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
            marginBottom: 'var(--sp-3)',
            fontWeight: 500,
          }}>
            {holding.company}
          </p>

          {/* Thesis */}
          <p style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--text-secondary)',
            lineHeight: 1.65,
          }}>
            {holding.thesis}
          </p>
        </div>

        {/* Right: actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', alignItems: 'flex-end', flexShrink: 0 }}>
          <form action={studyHolding as unknown as (fd: FormData) => void}>
            <input type="hidden" name="id" value={holding.id} />
            <motion.button whileHover={reducedMotion ? undefined : { scale: 1.05 }} whileTap={reducedMotion ? undefined : { scale: 0.95 }} type="submit" className="btn btn-secondary" style={{ fontSize: 'var(--text-xs)' }}>
              Study
            </motion.button>
          </form>
          <motion.button whileHover={reducedMotion ? undefined : { scale: 1.05 }} whileTap={reducedMotion ? undefined : { scale: 0.95 }} onClick={() => setIsEditing(true)} className="btn btn-ghost" style={{ fontSize: 'var(--text-xs)' }}>
            Edit
          </motion.button>
          <form action={deleteHolding as unknown as (fd: FormData) => void}>
            <input type="hidden" name="id" value={holding.id} />
            <motion.button whileHover={reducedMotion ? undefined : { scale: 1.05 }} whileTap={reducedMotion ? undefined : { scale: 0.95 }} type="submit" className="btn btn-danger" style={{ fontSize: 'var(--text-xs)' }}>
              Remove
            </motion.button>
          </form>
        </div>
      </div>

      {/* Expanded details: competitors + questions */}
      {(holding.competitors.length > 0 || holding.questions.length > 0) && (
        <div style={{
          marginTop: 'var(--sp-5)',
          paddingTop: 'var(--sp-5)',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--sp-4)',
        }}>

          {holding.competitors.length > 0 && (
            <div>
              <p className="section-label" style={{ marginBottom: 'var(--sp-2)' }}>Watch Competitors</p>
              <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
                {holding.competitors.map(c => (
                  <span key={c.id} className="label" style={{
                    background: 'var(--surface-overlay)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border)',
                    fontFamily: 'var(--font-mono)',
                  }}>
                    {c.ticker}
                  </span>
                ))}
              </div>
            </div>
          )}

          {holding.questions.length > 0 && (
            <div>
              <p className="section-label" style={{ marginBottom: 'var(--sp-3)' }}>Watch Questions</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                {holding.questions.map(q => (
                  <li key={q.id} style={{ display: 'flex', gap: 'var(--sp-4)', alignItems: 'flex-start' }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 'var(--text-2xs)',
                      fontWeight: 500,
                      color: 'var(--accent)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      minWidth: '80px',
                      paddingTop: '2px',
                      flexShrink: 0,
                    }}>
                      {q.category}
                    </span>
                    <span style={{
                      fontSize: 'var(--text-sm)',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.55,
                    }}>
                      {q.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </motion.div>
  )
}
