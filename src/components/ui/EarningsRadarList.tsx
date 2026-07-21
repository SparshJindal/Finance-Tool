'use client'

import React from 'react'
import { EarningsCard } from '@/components/ui/EarningsCard'
import { useDashboard } from '@/components/layout/DashboardTopNav'

export function EarningsRadarList({ earningsCardsData }: { earningsCardsData: any[] }) {
  const { activeHolding } = useDashboard()

  const filtered = activeHolding 
    ? earningsCardsData.filter(d => d.holdingId === activeHolding)
    : earningsCardsData

  if (filtered.length === 0) {
    return null
  }

  return (
    <div style={{ background: 'var(--surface-elevated)', borderRadius: 'var(--radius-lg)', padding: 'var(--sp-4)', border: '1px solid var(--border)' }}>
      <h3 style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 'var(--sp-4)' }}>
        Earnings Radar
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
        {filtered.slice(0, 5).map((data) => (
          <EarningsCard
            key={`${data.ticker}-${data.event.id}`}
            ticker={data.ticker}
            event={data.event}
          />
        ))}
      </div>
    </div>
  )
}
