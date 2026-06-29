'use client'

import { useTransition, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import type { HoldingRunResult } from '@/lib/pipeline'

type RunSummary = {
  updated: string[]
  quiet: string[]
  failed: { ticker: string; reason?: string }[]
  cached: string[]
  findingsAdded: number
}

export function PipelineControls({
  holdings,
  runIngestPhase1,
  runIngestPhase2,
  studyHoldingAction,
  studyBatchHoldingsAction,
  sendDigestAction,
  deleteAllHoldingsAction,
  logOutAction,
  onRunComplete,
}: {
  holdings: { id: string, ticker: string }[]
  runIngestPhase1: (fd?: FormData) => Promise<{ success?: boolean, report?: any, error?: string }>
  runIngestPhase2: (fd: FormData) => Promise<any>
  studyHoldingAction: (fd: FormData) => Promise<any>
  studyBatchHoldingsAction: (fd: FormData) => Promise<any>
  sendDigestAction: (fd: FormData) => void | Promise<void>
  deleteAllHoldingsAction: (fd?: FormData) => Promise<{success?: boolean, error?: string}>
  logOutAction: (fd: FormData) => void | Promise<void>
  onRunComplete?: (results: HoldingRunResult[]) => void
}) {
  const [isPendingDigest, startTransitionDigest] = useTransition()
  const router = useRouter()
  
  const [pipelineState, setPipelineState] = useState<{ active: boolean, text: string, percent: number }>({ active: false, text: '', percent: 0 })
  const [runSummary, setRunSummary] = useState<RunSummary | null>(null)

  const isAnyPending = pipelineState.active || isPendingDigest

  const handleStudyAll = async () => {
    if (holdings.length === 0) return
    setPipelineState({ active: true, text: 'Preparing to study...', percent: 0 })
    
    const CHUNK_SIZE = 3
    const chunks = []
    for (let i = 0; i < holdings.length; i += CHUNK_SIZE) {
      chunks.push(holdings.slice(i, i + CHUNK_SIZE))
    }

    let completed = 0
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      setPipelineState({ active: true, text: `Studying Batch ${i + 1}/${chunks.length} (${completed + chunk.length}/${holdings.length})`, percent: Math.round((completed / holdings.length) * 100) })
      
      const fd = new FormData()
      fd.append('ids', JSON.stringify(chunk.map(h => h.id)))
      await studyBatchHoldingsAction(fd)
      
      completed += chunk.length
      setPipelineState({ active: true, text: `Studying Batch ${i + 1}/${chunks.length} (${completed}/${holdings.length})`, percent: Math.round((completed / holdings.length) * 100) })
      
      if (i < chunks.length - 1) {
        await new Promise(r => setTimeout(r, 1000))
      }
    }
    
    setPipelineState({ active: false, text: '', percent: 0 })
  }

  const handleIngest = async () => {
    if (holdings.length === 0) return
    setRunSummary(null)
    setPipelineState({ active: true, text: 'Fetching live news & gating...', percent: 5 })
    
    const CHUNK_SIZE = 3
    const chunks = []
    for (let i = 0; i < holdings.length; i += CHUNK_SIZE) {
      chunks.push(holdings.slice(i, i + CHUNK_SIZE))
    }

    // Accumulate results across all chunks
    const allHoldingResults: HoldingRunResult[] = []
    let totalProcessed = 0

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      setPipelineState({
        active: true,
        text: `Ingesting Batch ${i + 1}/${chunks.length} (${totalProcessed + chunk.length}/${holdings.length})`,
        percent: Math.round((totalProcessed / holdings.length) * 100)
      })
      
      const fd = new FormData()
      fd.append('ids', JSON.stringify(chunk.map(h => h.id)))
      if (holdings.length > 10) {
        fd.append('skipHeavyApis', 'true')
      }
      const phase1 = await runIngestPhase1(fd)
      
      if (phase1.error) {
        console.error("Ingest chunk error:", phase1.error)
        // Mark all holdings in this chunk as failed if we have a hard error
        if (phase1.error === 'LLM_QUOTA_EXHAUSTED') {
          chunk.forEach(h => allHoldingResults.push({ holdingId: h.id, ticker: h.ticker, status: 'failed', findingsAdded: 0, reason: 'LLM_QUOTA_EXHAUSTED' }))
        }
      } else {
        router.refresh()
        // Use server-reported results; fall back to optimistic if not present
        const serverResults: HoldingRunResult[] = phase1.report?.holdingResults || []
        if (serverResults.length > 0) {
          allHoldingResults.push(...serverResults)
          // Use actual processed count from server report for accurate progress
          totalProcessed += phase1.report?.totalHoldingsProcessed ?? chunk.length
        } else {
          totalProcessed += chunk.length
        }
      }
      
      setPipelineState({
        active: true,
        text: `Ingesting Batch ${i + 1}/${chunks.length} (${totalProcessed}/${holdings.length})`,
        percent: Math.round((totalProcessed / holdings.length) * 100)
      })
      
      if (i < chunks.length - 1) {
        await new Promise(r => setTimeout(r, 1000))
      }
    }

    setPipelineState({ active: false, text: '', percent: 0 })

    // Build and show summary
    const summary: RunSummary = { updated: [], quiet: [], failed: [], cached: [], findingsAdded: 0 }
    for (const r of allHoldingResults) {
      if (r.status === 'updated') { summary.updated.push(r.ticker); summary.findingsAdded += r.findingsAdded }
      else if (r.status === 'quiet') summary.quiet.push(r.ticker)
      else if (r.status === 'failed') summary.failed.push({ ticker: r.ticker, reason: r.reason })
      else if (r.status === 'cached') summary.cached.push(r.ticker)
    }
    setRunSummary(summary)

    // Notify parent so IntelRail can show per-holding chips
    onRunComplete?.(allHoldingResults)
  }

  const handleDeleteAll = async () => {
    if (holdings.length === 0) return
    const confirmed = window.confirm("Are you SURE you want to delete your entire portfolio? This will permanently wipe all your holdings, findings, and history. This action cannot be undone.")
    if (!confirmed) return

    setPipelineState({ active: true, text: 'Deleting portfolio...', percent: 50 })
    try {
      const res = await deleteAllHoldingsAction()
      if (res.error) { alert(res.error) }
    } catch (e: any) {
      alert("Failed to delete portfolio")
    }
    setPipelineState({ active: false, text: '', percent: 0 })
  }

  // Derive banner style from results
  const bannerColor = runSummary
    ? runSummary.failed.length > 0
      ? 'var(--bearish)'
      : runSummary.updated.length > 0
        ? 'var(--bullish)'
        : 'var(--text-secondary)'
    : null

  return (
    <>
      {/* Progress Bar pinned to top of screen */}
      <AnimatePresence>
        {isAnyPending && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{
              position: 'fixed',
              top: 0, left: 0, right: 0,
              zIndex: 9999,
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {pipelineState.active ? (
              <div style={{ background: 'var(--surface-elevated)', borderBottom: '1px solid var(--border)', padding: 'var(--sp-2) var(--sp-4)', display: 'flex', alignItems: 'center', gap: 'var(--sp-4)' }}>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 500, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '300px' }}>{pipelineState.text}</span>
                <div style={{ flex: 1, height: '4px', background: 'var(--surface-subtle)', borderRadius: '2px', overflow: 'hidden' }}>
                  <motion.div
                    animate={{ width: `${pipelineState.percent}%` }}
                    transition={{ ease: "easeOut", duration: 0.3 }}
                    style={{ height: '100%', background: 'var(--accent)' }}
                  />
                </div>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, fontFamily: 'var(--font-mono)', minWidth: '40px', textAlign: 'right' }}>{pipelineState.percent}%</span>
              </div>
            ) : (
              <div style={{ height: '4px', background: 'var(--surface-subtle)', overflow: 'hidden' }}>
                <motion.div
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                  style={{ width: '50%', height: '100%', background: 'linear-gradient(90deg, transparent, var(--accent), transparent)' }}
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>

        {/* Dismissible results banner */}
        <AnimatePresence>
          {runSummary && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{
                background: 'var(--surface)',
                border: `1px solid ${bannerColor}`,
                borderRadius: 'var(--radius-sm)',
                padding: 'var(--sp-3)',
                marginBottom: 'var(--sp-2)',
                fontSize: 'var(--text-xs)',
                fontFamily: 'var(--font-mono)',
                position: 'relative',
              }}>
                <button
                  onClick={() => setRunSummary(null)}
                  style={{ position: 'absolute', top: '6px', right: '8px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1, padding: 0 }}
                  aria-label="Dismiss"
                >×</button>

                {/* Updated */}
                {runSummary.updated.length > 0 && (
                  <div style={{ color: 'var(--bullish)', marginBottom: 'var(--sp-1)' }}>
                    ✓ {runSummary.updated.length} updated ({runSummary.updated.join(', ')}) · +{runSummary.findingsAdded} finding{runSummary.findingsAdded !== 1 ? 's' : ''}
                  </div>
                )}
                {/* Quiet */}
                {runSummary.quiet.length > 0 && (
                  <div style={{ color: 'var(--text-secondary)', marginBottom: 'var(--sp-1)' }}>
                    ○ {runSummary.quiet.length} quiet ({runSummary.quiet.join(', ')})
                  </div>
                )}
                {/* Cached */}
                {runSummary.cached.length > 0 && (
                  <div style={{ color: 'var(--text-muted)', marginBottom: 'var(--sp-1)' }}>
                    ⏸ {runSummary.cached.length} cached ({runSummary.cached.join(', ')})
                  </div>
                )}
                {/* Failed */}
                {runSummary.failed.length > 0 && (
                  <div style={{ color: 'var(--bearish)' }}>
                    ✕ {runSummary.failed.length} failed ({runSummary.failed.map(f => f.ticker).join(', ')})
                    {runSummary.failed[0]?.reason && (
                      <span style={{ opacity: 0.8 }}> · {runSummary.failed[0].reason.replace(/_/g, ' ')}</span>
                    )}
                  </div>
                )}
                {/* All quiet */}
                {runSummary.updated.length === 0 && runSummary.failed.length === 0 && runSummary.quiet.length === 0 && runSummary.cached.length === 0 && (
                  <div style={{ color: 'var(--text-muted)' }}>No holdings processed.</div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button 
          onClick={handleIngest}
          className="btn btn-secondary" 
          style={{ width: '100%', justifyContent: 'center' }}
          disabled={isAnyPending}
        >
          {pipelineState.active && pipelineState.text.includes('Ingesting') ? 'Running Pipeline...' : 'Run Ingest'}
        </button>
        
        <button 
          onClick={handleStudyAll}
          className="btn btn-secondary" 
          style={{ width: '100%', justifyContent: 'center' }}
          disabled={isAnyPending || holdings.length === 0}
        >
          {pipelineState.active && pipelineState.text.includes('Studying') ? 'Studying...' : 'Study All'}
        </button>

        <form action={fd => startTransitionDigest(() => sendDigestAction(fd))}>
          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', justifyContent: 'center' }}
            disabled={isAnyPending}
          >
            {isPendingDigest ? 'Sending...' : 'Send Digest'}
          </button>
        </form>

        <form action={logOutAction}>
          <button 
            type="submit" 
            className="btn" 
            style={{ width: '100%', justifyContent: 'center', color: 'var(--text-secondary)', marginTop: 'var(--sp-4)' }}
            disabled={isAnyPending}
          >
            Log Out
          </button>
        </form>

        <button 
          type="button" 
          onClick={handleDeleteAll}
          className="btn" 
          style={{ width: '100%', justifyContent: 'center', color: 'var(--bearish)', marginTop: 'var(--sp-2)' }}
          disabled={isAnyPending || holdings.length === 0}
        >
          Delete Entire Portfolio
        </button>
      </div>
    </>
  )
}
