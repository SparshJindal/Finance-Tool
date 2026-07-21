'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

type Falsifier = {
  id: string
  text: string
  rationale: string | null
  status: 'UNTRIGGERED' | 'WATCH' | 'TRIGGERED'
  evidenceFindingIds: string[]
  lastEvaluatedAt: Date | string | null
}

export type ThesisHealthPanelProps = {
  ticker: string
  health: {
    score: number
    label: string
    triggeredCount: number
    watchCount: number
  }
  falsifiers: Falsifier[]
  allFindings?: { id: string, sourceTitle: string, sourceLink: string }[] // to map evidenceFindingIds
}

export function ThesisHealthPanel({ ticker, health, falsifiers, allFindings = [] }: ThesisHealthPanelProps) {
  const [expanded, setExpanded] = useState(false)

  // Color mapping based on label
  let healthColor = 'var(--text-primary)'
  let healthBarColor = 'var(--accent)'
  
  if (health.score >= 75) {
    healthColor = 'var(--bullish)'
    healthBarColor = 'var(--bullish)'
  } else if (health.score >= 50) {
    healthColor = '#f59e0b' // Amber
    healthBarColor = '#f59e0b'
  } else if (health.score >= 25) {
    healthColor = '#ea580c' // Orange
    healthBarColor = '#ea580c'
  } else {
    healthColor = 'var(--bearish)'
    healthBarColor = 'var(--bearish)'
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'TRIGGERED': return 'var(--bearish)'
      case 'WATCH': return '#f59e0b'
      default: return 'var(--text-muted)'
    }
  }

  return (
    <div className="card" style={{ padding: 'var(--sp-3)', cursor: 'pointer' }} onClick={() => setExpanded(!expanded)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--sp-2)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
            <span style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-primary)' }}>{ticker}</span>
            <span style={{ fontSize: 'var(--text-sm)', color: healthColor, fontWeight: 500 }}>{health.label}</span>
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 'var(--sp-1)' }}>
            {health.score}/100 Score • {falsifiers.length} Falsifiers ({health.triggeredCount} Triggered, {health.watchCount} Watch)
          </div>
        </div>
        <div style={{ fontSize: 'var(--text-xl)' }}>{expanded ? '−' : '+'}</div>
      </div>

      {/* Health Meter */}
      <div style={{ height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden', marginTop: 'var(--sp-3)' }}>
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${health.score}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          style={{ height: '100%', background: healthBarColor, borderRadius: '3px' }} 
        />
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ marginTop: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              {falsifiers.length === 0 ? (
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>No falsifiers generated yet.</div>
              ) : (
                falsifiers.map((f, i) => (
                  <div key={f.id || i} style={{ padding: 'var(--sp-3)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', borderLeft: `3px solid ${getStatusColor(f.status)}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-2)' }}>
                      <span style={{ 
                        fontSize: '10px', 
                        textTransform: 'uppercase', 
                        fontWeight: 600, 
                        padding: '2px 6px', 
                        borderRadius: '4px',
                        background: `${getStatusColor(f.status)}20`,
                        color: getStatusColor(f.status)
                      }}>
                        {f.status}
                      </span>
                    </div>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontWeight: 500 }}>
                      {f.text}
                    </div>
                    {f.rationale && (
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 'var(--sp-1)' }}>
                        {f.rationale}
                      </div>
                    )}
                    
                    {f.evidenceFindingIds && f.evidenceFindingIds.length > 0 && (
                      <div style={{ marginTop: 'var(--sp-2)', paddingTop: 'var(--sp-2)', borderTop: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 'var(--sp-1)' }}>Evidence Findings:</div>
                        {f.evidenceFindingIds.map(fid => {
                          const finding = allFindings.find(a => a.id === fid)
                          if (!finding) return null;
                          return (
                            <a 
                              key={fid} 
                              href={finding.sourceLink} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--accent)', textDecoration: 'none', marginBottom: '2px' }}
                              onClick={e => e.stopPropagation()}
                            >
                              {finding.sourceTitle} ↗
                            </a>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
