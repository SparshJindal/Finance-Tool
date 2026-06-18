'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { IntelRail } from './IntelRail'
import { TickerTape } from './TickerTape'
import { FindingCard, FindingData } from './FindingCard'
import { AddHoldingPanel } from './AddHoldingPanel'

type DashboardShellProps = {
  holdings: any[] // full holdings for the add-holding panel + nav
  findings: FindingData[]
  tickerItems: any[]
  lastScanAt: string | null
  totalThreats: number
  maxPortfolioSeverity: number
  // server action
  addHoldingAction: (fd: FormData) => void | Promise<void>
  controls?: React.ReactNode
}

export function DashboardShell({
  holdings,
  findings,
  tickerItems,
  lastScanAt,
  totalThreats,
  maxPortfolioSeverity,
  addHoldingAction,
  controls,
}: DashboardShellProps) {
  const [activeHolding, setActiveHolding] = useState<string | null>(null)
  
  // Format holding nav data for IntelRail
  const navHoldings = holdings.map(h => {
    const hFindings = findings.filter(f => f.holdingId === h.id)
    return {
      id: h.id,
      ticker: h.ticker,
      maxSeverity: hFindings.reduce((max, f) => Math.max(max, f.severity), 0),
      findingCount: hFindings.length
    }
  })

  // Filter findings
  const filteredFindings = findings.filter(f => {
    if (activeHolding && f.holdingId !== activeHolding) return false
    return true
  })

  // Sort: highest severity first, then newest
  filteredFindings.sort((a, b) => b.severity - a.severity)

  return (
    <div className="noise-bg" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <TickerTape items={tickerItems} />
      
      <div style={{ display: 'flex', flex: 1 }}>
        <IntelRail
          holdings={navHoldings}
          lastScanAt={lastScanAt}
          totalThreats={totalThreats}
          maxPortfolioSeverity={maxPortfolioSeverity}
          activeHolding={activeHolding}
          onHoldingClick={setActiveHolding}
          controls={controls}
        />
        
        <main style={{ flex: 1, padding: 'var(--sp-8) var(--sp-4)', paddingBottom: 'var(--sp-16)' }} className="md:ml-[220px]">
          <div style={{ maxWidth: '840px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--sp-8)' }}>
            
            {/* Top controls area for the dashboard */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--sp-2)' }}>
              <AddHoldingPanel action={addHoldingAction} />
            </div>

            {/* Findings Feed */}
            {filteredFindings.length === 0 ? (
              <div className="card" style={{ padding: 'var(--sp-12) var(--sp-8)', textAlign: 'center' }}>
                <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                  NO THREATS DETECTED — MARKETS QUIET
                </p>
              </div>
            ) : (
              <motion.div layout className="findings-feed" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
                <AnimatePresence mode="popLayout">
                  {filteredFindings.map((f, i) => (
                    <FindingCard key={f.id} finding={f} index={i} />
                  ))}
                </AnimatePresence>
              </motion.div>
            )}

          </div>
        </main>
      </div>
    </div>
  )
}
