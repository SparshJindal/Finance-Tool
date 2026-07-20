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
import { DashboardTopNav, DashboardContext } from './DashboardTopNav'

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
  children,
}: DashboardShellProps & { children?: React.ReactNode }) {
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
            
            {/* Top controls area for the dashboard */}
            {controls}

            {/* Dashboard Tab Navigation */}
            <DashboardTopNav />

            {/* Injected Page Content */}
            <DashboardContext.Provider value={{ activeHolding, setActiveHolding }}>
              {children}
            </DashboardContext.Provider>

          </div>
        </main>
      </div>
    </div>
  )
}
