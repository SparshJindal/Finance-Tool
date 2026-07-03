'use client'

import React from 'react'

type FeedItem = {
  id: string
  ticker: string
  company: string
  direction: string | null
  severity: number
  summary: string
  article: {
    title: string
    url: string
    source: string
  }
}

type DayGroup = {
  label: string
  dateISO: string
  items: FeedItem[]
  quiet: boolean
  quietTickers?: string[]
}

type WeeklyFeedProps = {
  days: DayGroup[]
}

function getVerdictIcon(direction: string | null) {
  const d = (direction || '').toUpperCase()
  if (d === 'SUPPORTS' || d === 'BULLISH') return '🟢'
  if (d === 'THREATENS' || d === 'BEARISH') return '🔴'
  if (d === 'MIXED') return '🟡'
  return '⚪'
}

export function WeeklyFeed({ days }: WeeklyFeedProps) {
  if (!days || days.length === 0) {
    return (
      <div className="card" style={{ padding: 'var(--sp-6)', textAlign: 'center', marginBottom: 'var(--sp-8)' }}>
        <p style={{ color: 'var(--text-muted)' }}>No material headlines in the last 7 days.</p>
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: 'var(--sp-6)', marginBottom: 'var(--sp-8)' }}>
      <h2 style={{ 
        fontFamily: "'Cormorant Garamond', Georgia, serif", 
        fontSize: 'var(--text-xl)', 
        fontWeight: 600, 
        color: 'var(--text-primary)', 
        marginBottom: 'var(--sp-6)',
        borderBottom: '1px solid var(--border)',
        paddingBottom: 'var(--sp-3)'
      }}>
        This Week
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
        {days.map((day, idx) => (
          <div key={day.dateISO || idx}>
            <div className="section-label" style={{ marginBottom: 'var(--sp-3)', color: 'var(--text-secondary)' }}>
              {day.label} <span style={{ opacity: 0.5, marginLeft: 'var(--sp-2)' }}>{day.dateISO}</span>
            </div>
            
            {day.quiet ? (
              <div style={{ 
                fontSize: 'var(--text-sm)', 
                color: 'var(--text-muted)',
                paddingLeft: 'var(--sp-3)',
                borderLeft: '2px solid var(--border)'
              }}>
                ⚪ {day.quietTickers?.join(', ')} — quiet
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                {day.items.map(item => (
                  <div key={item.id} style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--sp-2)',
                    paddingLeft: 'var(--sp-3)',
                    borderLeft: '2px solid var(--border-hi)'
                  }}>
                    {/* Header Row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '12px' }}>{getVerdictIcon(item.direction)}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                        {item.ticker}
                      </span>
                      {/* Severity dots */}
                      <div style={{ display: 'flex', gap: '2px', marginLeft: 'var(--sp-2)', alignItems: 'center' }}>
                        {[1,2,3,4,5].map(i => {
                          let dotColor = 'var(--border)'
                          if (i <= item.severity) {
                            if (item.severity >= 4) dotColor = 'var(--bearish)'
                            else if (item.severity === 3) dotColor = 'var(--accent)'
                            else dotColor = 'var(--text-secondary)'
                          }
                          return (
                            <div 
                              key={i} 
                              style={{ 
                                width: '4px', 
                                height: '4px', 
                                borderRadius: '50%', 
                                background: dotColor 
                              }} 
                            />
                          )
                        })}
                      </div>
                    </div>
                    {/* Summary */}
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {item.summary}
                      {' '}
                      <a 
                        href={item.article.url} 
                        target="_blank" 
                        rel="noreferrer"
                        style={{ color: 'var(--accent)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '2px', fontWeight: 500 }}
                      >
                        [source ↗]
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
