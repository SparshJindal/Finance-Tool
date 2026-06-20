'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { IntelRail } from './IntelRail'
import { TickerTape } from './TickerTape'
import { FindingCard, FindingData } from './FindingCard'
import { AddHoldingPanel } from './AddHoldingPanel'
import { ManagePortfolioPanel } from './ManagePortfolioPanel'
import { ImportHoldingsPanel } from './ImportHoldingsPanel'
import { PolygonMesh } from './PolygonMesh'
import { useReducedMotion } from '@/hooks/useReducedMotion'

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.05,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 300,
      damping: 26,
    },
  },
  exit: { opacity: 0, scale: 0.97 },
}

type DashboardShellProps = {
  holdings: any[] // full holdings for the add-holding panel + nav
  findings: FindingData[]
  tickerItems: any[]
  lastScanAt: string | null
  totalThreats: number
  maxPortfolioSeverity: number
  // server action
  addHoldingAction: (fd: FormData) => void | Promise<void>
  updateHoldingAction: (fd: FormData) => void | Promise<void>
  deleteHoldingAction: (fd: FormData) => void | Promise<void>
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
  updateHoldingAction,
  deleteHoldingAction,
  controls,
}: DashboardShellProps) {
  const [activeHolding, setActiveHolding] = useState<string | null>(null)
  const reduced = useReducedMotion()
  
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
    <div className="noise-bg" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      {/* Background Mesh */}
      {!reduced && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, opacity: 0.8, pointerEvents: 'none' }}>
          <PolygonMesh density={1.5} distortion={0.1} intensity={0.4} fadeMode="edges" />
        </div>
      )}

      <div style={{ position: 'relative', zIndex: 10 }}>
        <TickerTape items={tickerItems} />
      </div>
      
      <div style={{ display: 'flex', flex: 1, position: 'relative', zIndex: 10 }}>
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
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--sp-2)', gap: 'var(--sp-2)' }}>
              <ManagePortfolioPanel 
                holdings={holdings}
                updateAction={updateHoldingAction}
                deleteAction={deleteHoldingAction}
              />
              <AddHoldingPanel action={addHoldingAction} />
              <ImportHoldingsPanel />
            </div>

            {/* Findings Feed / Empty State */}
            {holdings.length === 0 ? (
              <div style={{
                padding: 'var(--sp-10)',
                background: 'var(--glass-bg)',
                backdropFilter: 'blur(var(--glass-blur))',
                WebkitBackdropFilter: 'blur(var(--glass-blur))',
                border: '1px dashed var(--border-hi)',
                borderRadius: 'var(--radius-lg)',
                textAlign: 'center',
                maxWidth: '600px',
                margin: '0 auto',
                marginTop: 'var(--sp-8)',
              }}>
                <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--sp-3)' }}>
                  Welcome to coranto.
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-md)', lineHeight: 1.6, marginBottom: 'var(--sp-6)' }}>
                  Your portfolio is currently empty. To unleash the power of autonomous AI market monitoring, click the <b>&quot;Add New Position&quot;</b> button above.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-6)', textAlign: 'left', marginTop: 'var(--sp-6)', paddingTop: 'var(--sp-6)', borderTop: '1px solid var(--border)' }}>
                  <div>
                    <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--sp-2)', display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                      <span style={{ color: 'var(--accent)', opacity: 0.7 }}>01.</span> Search Stocks
                    </h3>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.5 }}>Type the ticker or company name. We have over 2,000 Indian stocks (NSE) loaded and ready.</p>
                  </div>
                  <div>
                    <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--sp-2)', display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                      <span style={{ color: 'var(--accent)', opacity: 0.7 }}>02.</span> Add Thesis
                    </h3>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.5 }}>Provide your core investment thesis. Our AI uses this context to filter out noise and find true threats.</p>
                  </div>
                </div>
              </div>
            ) : filteredFindings.length === 0 ? (
              <div className="card" style={{ padding: 'var(--sp-12) var(--sp-8)', textAlign: 'center' }}>
                <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                  NO THREATS DETECTED — MARKETS QUIET
                </p>
              </div>
            ) : (
              <motion.div
                layout
                className="findings-feed"
                style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}
                variants={reduced ? undefined : containerVariants}
                initial={reduced ? undefined : 'hidden'}
                animate={reduced ? undefined : 'visible'}
              >
                <AnimatePresence mode="popLayout">
                  {filteredFindings.map((f, i) => (
                    <FindingCard key={f.id} finding={f} index={i} reducedMotion={reduced} itemVariants={reduced ? undefined : itemVariants} />
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
