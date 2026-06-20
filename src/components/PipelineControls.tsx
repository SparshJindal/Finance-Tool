'use client'

import { useTransition, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export function PipelineControls({
  holdings,
  runIngestPhase1,
  runIngestPhase2,
  studyHoldingAction,
  sendDigestAction,
  logOutAction
}: {
  holdings: { id: string, ticker: string }[]
  runIngestPhase1: () => Promise<{ success?: boolean, candidates?: any[], error?: string }>
  runIngestPhase2: (fd: FormData) => Promise<any>
  studyHoldingAction: (fd: FormData) => Promise<any>
  sendDigestAction: (fd: FormData) => void | Promise<void>
  logOutAction: (fd: FormData) => void | Promise<void>
}) {
  const [isPendingDigest, startTransitionDigest] = useTransition()
  
  const [pipelineState, setPipelineState] = useState<{ active: boolean, text: string, percent: number }>({ active: false, text: '', percent: 0 })

  const isAnyPending = pipelineState.active || isPendingDigest

  const handleStudyAll = async () => {
    if (holdings.length === 0) return
    setPipelineState({ active: true, text: 'Preparing to study...', percent: 0 })
    
    let completed = 0
    for (const h of holdings) {
      setPipelineState({ active: true, text: `Studying ${h.ticker} (${completed + 1}/${holdings.length})`, percent: Math.round((completed / holdings.length) * 100) })
      
      const fd = new FormData()
      fd.append('id', h.id)
      await studyHoldingAction(fd)
      
      completed++
      setPipelineState({ active: true, text: `Studying ${h.ticker} (${completed}/${holdings.length})`, percent: Math.round((completed / holdings.length) * 100) })
    }
    
    setPipelineState({ active: false, text: '', percent: 0 })
  }

  const handleIngest = async () => {
    setPipelineState({ active: true, text: 'Fetching live news & gating...', percent: 10 })
    
    const phase1 = await runIngestPhase1()
    
    if (phase1.error || !phase1.candidates) {
      setPipelineState({ active: false, text: '', percent: 0 })
      alert("Ingest failed: " + (phase1.error || "Unknown error"))
      return
    }

    const candidates = phase1.candidates
    if (candidates.length === 0) {
      setPipelineState({ active: false, text: '', percent: 0 })
      return
    }

    // Phase 2: Loop and judge
    // The server currently sorts and slices the top 20 candidates in pipeline.ts
    // but the returned array might already be sliced. We'll just loop over what's returned.
    let completed = 0
    for (const candidate of candidates) {
      setPipelineState({ active: true, text: `Judging Threat ${completed + 1}/${candidates.length}`, percent: 10 + Math.round((completed / candidates.length) * 90) })
      
      const fd = new FormData()
      fd.append('candidate', JSON.stringify(candidate))
      await runIngestPhase2(fd)
      
      completed++
      setPipelineState({ active: true, text: `Judging Threat ${completed}/${candidates.length}`, percent: 10 + Math.round((completed / candidates.length) * 90) })
    }

    setPipelineState({ active: false, text: '', percent: 0 })
  }

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
              // True Percentage Bar
              <div style={{ background: 'var(--surface-elevated)', borderBottom: '1px solid var(--border)', padding: 'var(--sp-2) var(--sp-4)', display: 'flex', alignItems: 'center', gap: 'var(--sp-4)' }}>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 500, fontFamily: 'var(--font-mono)' }}>{pipelineState.text}</span>
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
              // Indeterminate Bar for others
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
        <button 
          onClick={handleIngest}
          className="btn btn-secondary" 
          style={{ width: '100%', justifyContent: 'center' }}
          disabled={isAnyPending}
        >
          {pipelineState.active && pipelineState.text.includes('Fetching') ? 'Running Pipeline...' : 'Run Ingest'}
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
      </div>
    </>
  )
}
