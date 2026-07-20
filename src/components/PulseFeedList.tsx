'use client'

import React from 'react'
import { ThesisHealthPanel } from './ThesisHealthPanel'
import { useDashboard } from './DashboardTopNav'

export function PulseFeedList({ holdings }: { holdings: any[] }) {
  const { activeHolding } = useDashboard()

  const filteredHoldings = activeHolding 
    ? holdings.filter(h => h.holdingId === activeHolding)
    : holdings

  if (filteredHoldings.length === 0) {
    return (
      <div style={{ padding: 'var(--sp-6)', color: 'var(--text-muted)', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)' }}>
        No holdings found for this selection.
      </div>
    )
  }

  return (
    <>
      {filteredHoldings.map(v => (
        <ThesisHealthPanel 
          key={v.holdingId} 
          ticker={v.ticker} 
          health={v.thesisHealth!} 
          falsifiers={v.falsifiers!} 
          allFindings={v.findings} 
        />
      ))}
    </>
  )
}
