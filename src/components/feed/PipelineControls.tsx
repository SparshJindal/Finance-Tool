'use client'

import { useTransition, useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import type { HoldingRunResult } from '@/lib/pipeline'
import { NotificationCenter } from '@/components/layout/NotificationCenter'
import { Sun, Moon } from 'lucide-react'

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
  refreshEarningsAction,
  backfillFalsifiersAction,
  onRunComplete,
  userProfile,
  totalThreatened,
  totalSupported,
  totalQuietCount,
  profilePanel,
  importHoldingsPanel,
  pushManager,
  unreadFindings = [],
  markReadAction,
}: {
  holdings: { id: string, ticker: string }[]
  runIngestPhase1: (fd?: FormData) => Promise<{ success?: boolean, report?: any, error?: string }>
  runIngestPhase2: (fd: FormData) => Promise<any>
  studyHoldingAction: (fd: FormData) => Promise<any>
  studyBatchHoldingsAction: (fd: FormData) => Promise<any>
  sendDigestAction: (fd: FormData) => void | Promise<void>
  deleteAllHoldingsAction: (fd?: FormData) => Promise<{success?: boolean, error?: string}>
  logOutAction: (fd: FormData) => void | Promise<void>
  refreshEarningsAction: (ids?: string[]) => Promise<void>
  backfillFalsifiersAction: () => Promise<any>
  onRunComplete?: (results: HoldingRunResult[]) => void
  userProfile?: any
  totalThreatened?: number
  totalSupported?: number
  totalQuietCount?: number
  profilePanel?: React.ReactNode
  importHoldingsPanel?: React.ReactNode
  pushManager?: React.ReactNode
  unreadFindings?: any[]
  markReadAction?: (findingIds: string[]) => Promise<{ success?: boolean; error?: string }>
}) {
  const [isPendingDigest, startTransitionDigest] = useTransition()
  const [isPendingEarnings, startTransitionEarnings] = useTransition()
  const [isPendingFalsifiers, startTransitionFalsifiers] = useTransition()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  const router = useRouter()
  
  const [pipelineState, setPipelineState] = useState<{ active: boolean, text: string, percent: number }>({ active: false, text: '', percent: 0 })
  const [runSummary, setRunSummary] = useState<RunSummary | null>(null)
  
  const [toolsOpen, setToolsOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const toolsRef = useRef<HTMLDivElement>(null)
  const accountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) {
        setToolsOpen(false)
      }
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const isAnyPending = pipelineState.active || isPendingDigest || isPendingEarnings || isPendingFalsifiers

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
    
    const allHoldingResults: HoldingRunResult[] = []

    const fd = new FormData()
    fd.append('ids', JSON.stringify(holdings.map(h => h.id)))
    if (holdings.length > 10) {
      fd.append('skipHeavyApis', 'true')
    }

    const phase1 = await runIngestPhase1(fd)
    
    if (phase1.error) {
      console.error("Ingest error:", phase1.error)
      if (phase1.error === 'LLM_QUOTA_EXHAUSTED') {
        holdings.forEach(h => allHoldingResults.push({ holdingId: h.id, ticker: h.ticker, status: 'failed', findingsAdded: 0, reason: 'LLM_QUOTA_EXHAUSTED' }))
      }
    } else {
      router.refresh()
      const serverResults: HoldingRunResult[] = phase1.report?.holdingResults || []
      if (serverResults.length > 0) {
        allHoldingResults.push(...serverResults)
      }
    }
    
    setPipelineState({
      active: true,
      text: `Ingesting complete`,
      percent: 100
    })

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
              top: 'var(--sp-4)',
              left: '50%',
              transform: 'translateX(-50%)',
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

      {/* Top Command Bar */}
      <div style={{ 
        position: 'sticky', 
        top: 0, 
        zIndex: 40, 
        background: 'var(--glass-bg)', 
        backdropFilter: 'blur(var(--glass-blur))',
        WebkitBackdropFilter: 'blur(var(--glass-blur))',
        borderBottom: '1px solid var(--border)', 
        padding: 'var(--sp-4) var(--sp-6)', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        margin: '0 calc(-1 * var(--sp-4)) var(--sp-4) calc(-1 * var(--sp-4))'
      }}>
        {/* Left: Pulse Stats */}
        <div style={{ display: 'flex', gap: 'var(--sp-4)', fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)' }}>
          {(totalThreatened || 0) > 0 && <span style={{ color: 'var(--bearish)' }}>{(totalThreatened || 0)} under pressure</span>}
          {(totalThreatened || 0) > 0 && ((totalSupported || 0) > 0 || (totalQuietCount || 0) > 0) && <span style={{ color: 'var(--text-muted)' }}>·</span>}
          {(totalSupported || 0) > 0 && <span style={{ color: 'var(--bullish)' }}>{(totalSupported || 0)} supported</span>}
          {(totalSupported || 0) > 0 && (totalQuietCount || 0) > 0 && <span style={{ color: 'var(--text-muted)' }}>·</span>}
          {(totalQuietCount || 0) > 0 && <span style={{ color: 'var(--text-secondary)' }}>{(totalQuietCount || 0)} quiet</span>}
          {(totalThreatened || 0) === 0 && (totalSupported || 0) === 0 && (totalQuietCount || 0) === 0 && <span style={{ color: 'var(--text-secondary)' }}>Portfolio quiet</span>}
        </div>

        {/* Right: Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
          {markReadAction && (
            <NotificationCenter unreadFindings={unreadFindings} markReadAction={markReadAction} />
          )}

          <button onClick={handleIngest} className="btn btn-primary" disabled={isAnyPending}>
            {pipelineState.active && pipelineState.text.includes('Ingesting') ? 'Running Scan...' : 'Run Scan'}
          </button>

          <button
          onClick={toggleTheme}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: 'var(--sp-2)',
            borderRadius: 'var(--radius-sm)',
          }}
          title="Toggle Theme"
        >
          {mounted && (theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />)}
          {!mounted && <div style={{ width: 16, height: 16 }} />}
        </button>

          {/* Tools Menu */}
          <div style={{ position: 'relative' }} ref={toolsRef}>
            <button className="btn btn-secondary" onClick={() => { setToolsOpen(!toolsOpen); setAccountOpen(false) }}>Tools ▾</button>
            {toolsOpen && (
              <div className="dropdown-menu">
                <div style={{ padding: '4px' }}>
                  {importHoldingsPanel}
                </div>
                <div className="dropdown-divider" />
                <button className="dropdown-item" onClick={handleStudyAll} disabled={isAnyPending || holdings.length === 0}>Study All</button>
                <form action={fd => startTransitionDigest(() => sendDigestAction(fd))}>
                  <button type="submit" className="dropdown-item" disabled={isAnyPending}>Send Digest</button>
                </form>
                <button className="dropdown-item" onClick={() => startTransitionEarnings(() => refreshEarningsAction())} disabled={isAnyPending}>Refresh Earnings</button>
                <button className="dropdown-item" onClick={() => startTransitionFalsifiers(() => backfillFalsifiersAction())} disabled={isAnyPending}>Generate Falsifiers</button>
              </div>
            )}
          </div>

          {/* Account Menu */}
          <div style={{ position: 'relative' }} ref={accountRef}>
            <button 
              style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), #8A6D46)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)', border: 'none', cursor: 'pointer' }}
              onClick={() => { setAccountOpen(!accountOpen); setToolsOpen(false) }}
            >
              {userProfile?.name?.charAt(0).toUpperCase() || 'U'}
            </button>
            {accountOpen && (
              <div className="dropdown-menu">
                <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', marginBottom: '4px' }}>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{userProfile?.name || 'Investor'}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{userProfile?.email}</div>
                </div>
                
                <div style={{ padding: '4px 8px' }}>{profilePanel}</div>
                <div style={{ padding: '4px 12px' }}>{pushManager}</div>
                
                <div className="dropdown-divider" />
                
                <form action={logOutAction}>
                  <button type="submit" className="dropdown-item" disabled={isAnyPending}>Log Out</button>
                </form>
                
                <div className="dropdown-divider" />
                
                <button className="dropdown-item dropdown-danger" onClick={handleDeleteAll} disabled={isAnyPending || holdings.length === 0} style={{ color: 'var(--bearish)' }}>
                  Delete Entire Portfolio
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dismissible results banner (moved right under the command bar) */}
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
              marginBottom: 'var(--sp-4)',
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
                  ✓ {runSummary.updated.length} updated ({runSummary.updated.length <= 4 ? runSummary.updated.join(', ') : `${runSummary.updated.slice(0, 4).join(', ')} and ${runSummary.updated.length - 4} others`}) · +{runSummary.findingsAdded} finding{runSummary.findingsAdded !== 1 ? 's' : ''}
                </div>
              )}
              {/* Quiet */}
              {runSummary.quiet.length > 0 && (
                <div style={{ color: 'var(--text-secondary)', marginBottom: 'var(--sp-1)' }}>
                  ○ {runSummary.quiet.length} quiet ({runSummary.quiet.length <= 4 ? runSummary.quiet.join(', ') : `${runSummary.quiet.slice(0, 4).join(', ')} and ${runSummary.quiet.length - 4} others`})
                </div>
              )}
              {/* Cached */}
              {runSummary.cached.length > 0 && (
                <div style={{ color: 'var(--text-muted)', marginBottom: 'var(--sp-1)' }}>
                  ⏸ {runSummary.cached.length} cached ({runSummary.cached.length <= 4 ? runSummary.cached.join(', ') : `${runSummary.cached.slice(0, 4).join(', ')} and ${runSummary.cached.length - 4} others`})
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
    </>
  )
}
