'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { IntelRail } from './IntelRail'
import { TickerTape } from './TickerTape'
import { PipelineControls } from './PipelineControls'
import type { FindingData } from './FindingCard'
import { AddHoldingPanel } from './AddHoldingPanel'
import { ManagePortfolioPanel } from './ManagePortfolioPanel'
import { ImportHoldingsPanel } from './ImportHoldingsPanel'
import { ProfilePanel } from './ProfilePanel'

import { PolygonMesh } from './PolygonMesh'
import { HoldingVerdictCard } from './HoldingVerdictCard'
import { EarningsCard } from './EarningsCard'
import { ThesisHealthPanel } from './ThesisHealthPanel'
import { WeeklyFeed } from './WeeklyFeed'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import type { HoldingRunResult } from '@/lib/pipeline'
import type { HoldingVerdict } from '@/lib/verdict'


type DashboardShellProps = {
  holdings: any[] // full holdings for the add-holding panel + nav
  holdingsRaw?: any[]
  holdingVerdicts?: HoldingVerdict[]
  findings: FindingData[]
  tickerItems: any[]
  lastScanAt: string | null
  totalThreats: number
  maxPortfolioSeverity: number
  // server action
  addHoldingAction: (fd: FormData) => void | Promise<void>
  updateHoldingAction: (fd: FormData) => void | Promise<void>
  deleteHoldingAction: (fd: FormData) => void | Promise<void>
  updateProfileAction: (fd: FormData) => Promise<{ success?: boolean; error?: string }>
  controls?: React.ReactNode
  userProfile?: {
    name: string
    email: string
    firstName: string | null
    lastName: string | null
    phone: string | null
    nationality: string | null
    image: string | null
  }
  weeklyFeedData?: any[]
}

export function DashboardShell({
  holdings,
  holdingsRaw = [],
  findings,
  tickerItems,
  lastScanAt,
  totalThreats,
  maxPortfolioSeverity,
  addHoldingAction,
  updateHoldingAction,
  deleteHoldingAction,
  updateProfileAction,
  controls,
  userProfile,
  holdingVerdicts = [],
  weeklyFeedData = [],
}: DashboardShellProps) {
  const [activeHolding, setActiveHolding] = useState<string | null>(null)
  const [quietExpanded, setQuietExpanded] = useState(false)
  const [holdingRunStatuses, setHoldingRunStatuses] = useState<Record<string, HoldingRunResult>>({})
  const reduced = useReducedMotion()

  const handleRunComplete = useCallback((results: HoldingRunResult[]) => {
    setHoldingRunStatuses(prev => {
      const next = { ...prev }
      results.forEach(r => { next[r.holdingId] = r })
      return next
    })
  }, [])
  
  // Format holding nav data for IntelRail
  const navHoldings = holdings.map(h => {
    const hFindings = findings.filter(f => f.holdingId === h.id && f.direction !== 'NEUTRAL' && f.direction !== 'Neutral')
    return {
      id: h.id,
      ticker: h.ticker,
      maxSeverity: hFindings.reduce((max, f) => Math.max(max, f.severity), 0),
      findingCount: hFindings.length,
      lastIngestedAt: h.lastIngestedAt ? (typeof h.lastIngestedAt === 'string' ? h.lastIngestedAt : h.lastIngestedAt.toISOString()) : null,
      lastRunStatus: holdingRunStatuses[h.id]?.status ?? null,
      isStudied: (h.questions && h.questions.length > 0) || (h.themes && h.themes.length > 0),
    }
  })

  // Onboarding steps calculations
  const step1Done = holdings.length > 0
  const step2Done = step1Done && holdings.every(h => 
    (h.questions && h.questions.length > 0) || 
    (h.themes && h.themes.length > 0)
  )
  const step3Done = step1Done && holdings.some(h => h.lastIngestedAt)
  const allStepsDone = step1Done && step2Done && step3Done

  const [guideDismissed, setGuideDismissed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('coranto_onboarding_guide_dismissed') === 'true'
    }
    return false
  })

  const handleDismissGuide = () => {
    setGuideDismissed(true)
    if (typeof window !== 'undefined') {
      localStorage.setItem('coranto_onboarding_guide_dismissed', 'true')
    }
  }

  const filteredVerdicts = useMemo(() => {
    return holdingVerdicts.filter(v => {
      if (activeHolding && v.holdingId !== activeHolding) return false
      return true
    })
  }, [holdingVerdicts, activeHolding])

  const movers = filteredVerdicts.filter(v => !v.isQuiet)
  const quiet = filteredVerdicts.filter(v => v.isQuiet)

  // L0 metrics (across entire portfolio, ignoring activeHolding filter)
  const totalThreatened = holdingVerdicts.filter(v => v.verdict === 'Threatens' || v.verdict === 'Mixed').length
  const totalSupported = holdingVerdicts.filter(v => v.verdict === 'Supports').length
  const totalQuietCount = holdingVerdicts.filter(v => v.isQuiet).length

  const earningsCardsData = useMemo(() => {
    const cards: { ticker: string; event: any }[] = []
    if (!holdingsRaw) return cards

    for (const h of holdingsRaw) {
      if (activeHolding && h.id !== activeHolding) continue
      if (h.earningsEvents && h.earningsEvents.length > 0) {
        // We only want to show the single most relevant event per holding:
        // Either the closest UPCOMING, or if none, the latest REPORTED.
        const upcoming = h.earningsEvents.filter((e: any) => e.status === "UPCOMING").sort((a: any, b: any) => new Date(a.reportDate).getTime() - new Date(b.reportDate).getTime())[0]
        const reported = h.earningsEvents.filter((e: any) => e.status === "REPORTED").sort((a: any, b: any) => new Date(b.reportDate).getTime() - new Date(a.reportDate).getTime())[0]
        
        if (upcoming) cards.push({ ticker: h.ticker, event: upcoming })
        else if (reported) cards.push({ ticker: h.ticker, event: reported })
      }
    }

    // Sort cards: UPCOMING first (soonest), then REPORTED (latest)
    cards.sort((a, b) => {
      if (a.event.status === "UPCOMING" && b.event.status === "REPORTED") return -1
      if (a.event.status === "REPORTED" && b.event.status === "UPCOMING") return 1
      if (a.event.status === "UPCOMING") {
        return new Date(a.event.reportDate).getTime() - new Date(b.event.reportDate).getTime()
      } else {
        return new Date(b.event.reportDate).getTime() - new Date(a.event.reportDate).getTime()
      }
    })

    return cards
  }, [holdingsRaw, activeHolding])

  const healthCardsData = useMemo(() => {
    return holdingVerdicts
      .filter(v => {
        if (activeHolding && v.holdingId !== activeHolding) return false
        return v.thesisHealth && v.falsifiers && v.falsifiers.length > 0
      })
      .sort((a, b) => (a.thesisHealth?.score || 100) - (b.thesisHealth?.score || 100))
  }, [holdingVerdicts, activeHolding])

  const controlsWithCallback = useMemo(() => {
    if (!controls) return null
    try {
      if (React.isValidElement(controls)) {
        return React.cloneElement(controls as any, {
          onRunComplete: handleRunComplete,
          userProfile,
          totalThreatened,
          totalSupported,
          totalQuietCount,
          profilePanel: userProfile ? <ProfilePanel userProfile={userProfile} updateAction={updateProfileAction} /> : null,
          managePortfolioPanel: <ManagePortfolioPanel holdings={holdings} updateAction={updateHoldingAction} deleteAction={deleteHoldingAction} />,
          addHoldingPanel: <AddHoldingPanel action={addHoldingAction} />,
          importHoldingsPanel: <ImportHoldingsPanel />
        })
      }
      return controls
    } catch (e) {
      console.error("Failed to inject props", e)
      return controls
    }
  }, [controls, handleRunComplete, userProfile, totalThreatened, totalSupported, totalQuietCount, holdings, updateProfileAction, updateHoldingAction, deleteHoldingAction, addHoldingAction])

  return (
    <div className="noise-bg" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      {/* Background Mesh */}
      {!reduced && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 0, opacity: 0.7, pointerEvents: 'none' }}>
          <PolygonMesh density={1.5} distortion={0.1} intensity={0.6} fadeMode="edges" />
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
        />
        
        <main style={{ flex: 1, padding: 'var(--sp-8) var(--sp-4)', paddingBottom: 'var(--sp-16)' }} className="md:ml-[220px]">
          <div style={{ maxWidth: '1300px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--sp-8)' }}>
            
            {/* Top controls area for the dashboard (Now replaced by Command Bar) */}
            {controlsWithCallback}

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
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 items-start">
                
                {/* LEFT COLUMN: Holdings News */}
                <div className="lg:h-[calc(100vh-160px)] lg:overflow-y-auto lg:pr-4" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
                  
                  {/* Slim Getting Started Guide */}
                  {!allStepsDone && !guideDismissed && (
                    <div style={{
                      background: 'var(--glass-bg)',
                      backdropFilter: 'blur(var(--glass-blur))',
                      WebkitBackdropFilter: 'blur(var(--glass-blur))',
                      border: '1px solid var(--border)',
                      borderLeft: '4px solid var(--accent)',
                      borderRadius: 'var(--radius-md)',
                      padding: 'var(--sp-4)',
                      boxShadow: 'var(--shadow-sm)',
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--sp-6)'
                    }}>
                      <div style={{ flex: 1, display: 'flex', gap: 'var(--sp-4)' }}>
                        <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-primary)', opacity: step1Done ? 0.5 : 1 }}>1. Add Holdings</div>
                        <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-primary)', opacity: step2Done ? 0.5 : (step1Done ? 1 : 0.5) }}>2. Study All</div>
                        <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-primary)', opacity: step3Done ? 0.5 : (step2Done ? 1 : 0.5) }}>3. Run Scan</div>
                      </div>
                      <button
                        onClick={handleDismissGuide}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '16px', padding: 0 }}
                        aria-label="Dismiss guide"
                      >×</button>
                    </div>
                  )}
                  
                  {/* This Week */}
                  {!activeHolding && (
                    <WeeklyFeed days={weeklyFeedData} />
                  )}

                  {/* Movers */}
                  {movers.length === 0 && quiet.length === 0 ? (
                     <div className="card" style={{ padding: 'var(--sp-12) var(--sp-8)', textAlign: 'center' }}>
                       <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                         NO THREATS DETECTED — MARKETS QUIET
                       </p>
                     </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {movers.map(v => (
                        <HoldingVerdictCard key={v.holdingId} verdict={v} reducedMotion={reduced} />
                      ))}
                    </div>
                  )}

                  {/* Quiet Expandable Section */}
                  {quiet.length > 0 && (
                    <div style={{ marginTop: 'var(--sp-2)' }}>
                      <button
                        onClick={() => setQuietExpanded(e => !e)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-secondary)',
                          fontSize: 'var(--text-sm)',
                          fontWeight: 500,
                          cursor: 'pointer',
                          padding: 'var(--sp-3) var(--sp-2)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--sp-2)',
                          width: '100%',
                          textAlign: 'left'
                        }}
                      >
                        <span style={{ opacity: 0.6, fontSize: '10px', transform: quietExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▶</span>
                        Quiet ({quiet.length})
                      </button>
                      
                      <AnimatePresence>
                        {quietExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            style={{ overflow: 'hidden' }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', paddingTop: 'var(--sp-2)' }}>
                              {quiet.map(v => (
                                <HoldingVerdictCard key={v.holdingId} verdict={v} reducedMotion={reduced} />
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>

                {/* RIGHT COLUMN: Radars */}
                <div className="lg:h-[calc(100vh-160px)] lg:overflow-y-auto lg:pr-4" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-8)' }}>
                  
                  {/* Earnings Radar */}
                  {earningsCardsData.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                      <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 600, paddingLeft: 'var(--sp-2)' }}>
                        Earnings Radar
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
                        {earningsCardsData.map(c => (
                          <EarningsCard key={`${c.ticker}-${c.event.id}`} ticker={c.ticker} event={c.event} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Thesis Health Radar */}
                  {healthCardsData.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                      <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 600, paddingLeft: 'var(--sp-2)' }}>
                        Thesis Health
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
                        {healthCardsData.map(v => (
                          <ThesisHealthPanel 
                            key={`health-${v.holdingId}`} 
                            ticker={v.ticker} 
                            health={v.thesisHealth!} 
                            falsifiers={v.falsifiers!} 
                            allFindings={v.findings} 
                          />
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  )
}
