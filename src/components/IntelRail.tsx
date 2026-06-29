'use client'

import { useState, useEffect } from 'react'
import { Severity } from '@/components/Severity'
import { CorantoLogo } from '@/components/CorantoLogo'
import { motion } from 'framer-motion'
import { useReducedMotion } from '@/hooks/useReducedMotion'

type HoldingNav = {
  id: string
  ticker: string
  maxSeverity: number
  findingCount: number
  lastIngestedAt?: string | null
  lastRunStatus?: 'updated' | 'quiet' | 'failed' | 'cached' | null
  isStudied?: boolean
}

function formatRelativeTime(dateStr?: string | null) {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}


export function IntelRail({
  holdings,
  lastScanAt,
  totalThreats,
  maxPortfolioSeverity,
  activeHolding,
  onHoldingClick,
  controls,
}: {
  holdings: HoldingNav[]
  lastScanAt: string | null
  totalThreats: number
  maxPortfolioSeverity: number
  activeHolding: string | null
  onHoldingClick: (id: string | null) => void
  controls?: React.ReactNode
}) {
  const [clock, setClock] = useState('')
  const [syncAgo, setSyncAgo] = useState('')

  // IST clock
  useEffect(() => {
    function tick() {
      setClock(
        new Date().toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      )
    }
    tick()
    const i = setInterval(tick, 1000)
    return () => clearInterval(i)
  }, [])

  // Sync-ago counter
  useEffect(() => {
    function update() {
      if (!lastScanAt) { setSyncAgo('never'); return }
      const diff = Math.floor((Date.now() - new Date(lastScanAt).getTime()) / 1000)
      if (diff < 60) setSyncAgo(`${diff}s ago`)
      else if (diff < 3600) setSyncAgo(`${Math.floor(diff / 60)}m ago`)
      else setSyncAgo(`${Math.floor(diff / 3600)}h ago`)
    }
    update()
    const i = setInterval(update, 10000)
    return () => clearInterval(i)
  }, [lastScanAt])

  return (
    <>
      {/* Desktop rail */}
      <aside
        style={{
          width: '220px',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(var(--glass-blur))',
          WebkitBackdropFilter: 'blur(var(--glass-blur))',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 40,
          overflowY: 'auto',
        }}
        className="hidden md:flex"
      >
        <RailContent
          clock={clock}
          syncAgo={syncAgo}
          totalThreats={totalThreats}
          maxPortfolioSeverity={maxPortfolioSeverity}
          holdings={holdings}
          activeHolding={activeHolding}
          onHoldingClick={onHoldingClick}
          controls={controls}
        />
      </aside>

      {/* Mobile top sheet */}
      <div
        style={{
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(var(--glass-blur))',
          WebkitBackdropFilter: 'blur(var(--glass-blur))',
          borderBottom: '1px solid var(--border)',
          padding: 'var(--sp-3) var(--sp-4)',
        }}
        className="flex md:hidden"
      >
        <MobileRail
          clock={clock}
          syncAgo={syncAgo}
          totalThreats={totalThreats}
          holdings={holdings}
          activeHolding={activeHolding}
          onHoldingClick={onHoldingClick}
        />
      </div>
    </>
  )
}

/* ────── Desktop Rail Internals ────── */
function RailContent({
  clock,
  syncAgo,
  totalThreats,
  maxPortfolioSeverity,
  holdings,
  activeHolding,
  onHoldingClick,
  controls,
}: {
  clock: string
  syncAgo: string
  totalThreats: number
  maxPortfolioSeverity: number
  holdings: HoldingNav[]
  activeHolding: string | null
  onHoldingClick: (id: string | null) => void
  controls?: React.ReactNode
}) {
  const reduced = useReducedMotion()

  const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.05
      }
    }
  }

  const itemVariants = {
    hidden: { x: 20, opacity: 0 },
    visible: { x: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } }
  }

  return (
    <>
      {/* Status block */}
      <div style={{ padding: 'var(--sp-4) var(--sp-4) var(--sp-3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-3)' }}>
          <span style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: 'var(--bullish)',
            boxShadow: '0 0 8px var(--bullish)',
            flexShrink: 0,
          }} />
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            color: 'var(--accent)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}>
            CORANTO
          </span>
        </div>

        {/* Clock */}
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-lg)',
          fontWeight: 600,
          color: 'var(--text-primary)',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
          marginBottom: 'var(--sp-1)',
        }}>
          {clock}
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-2xs)',
          color: 'var(--text-muted)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          IST · synced {syncAgo}
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '9px',
          color: 'var(--text-secondary)',
          marginTop: 'var(--sp-2)',
          borderTop: '1px dashed var(--border)',
          paddingTop: 'var(--sp-2)',
          lineHeight: 1.4,
        }}>
          Last scan: {syncAgo} · LLM: Groq · {totalThreats} findings
        </div>
      </div>

      <div style={{ height: '1px', background: 'var(--border)', margin: '0 var(--sp-4)' }} />

      {/* Threat gauge */}
      <div style={{ padding: 'var(--sp-4)' }}>
        <p className="section-label" style={{ marginBottom: 'var(--sp-2)' }}>
          Threat Level
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
          <Severity value={maxPortfolioSeverity || 1} size="md" />
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-2xs)',
            color: 'var(--text-muted)',
          }}>
            <CountUp target={totalThreats} /> finding{totalThreats !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <div style={{ height: '1px', background: 'var(--border)', margin: '0 var(--sp-4)' }} />

      {/* Holdings nav */}
      <motion.div style={{ padding: 'var(--sp-3) 0', flex: 1 }} variants={reduced ? undefined : containerVariants} initial={reduced ? undefined : "hidden"} animate={reduced ? undefined : "visible"}>
        <p className="section-label" style={{ padding: '0 var(--sp-4)', marginBottom: 'var(--sp-2)' }}>
          Holdings
        </p>

        <motion.button
          variants={reduced ? undefined : itemVariants}
          onClick={() => onHoldingClick(null)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--sp-2) var(--sp-4)',
            background: activeHolding === null ? 'var(--surface-overlay)' : 'transparent',
            border: 'none',
            borderLeft: activeHolding === null ? '2px solid var(--accent)' : '2px solid transparent',
            cursor: 'pointer',
            transition: 'background 0.15s ease',
          }}
        >
          <span style={{
            fontFamily: 'var(--font-ui)',
            fontSize: 'var(--text-xs)',
            fontWeight: 500,
            color: activeHolding === null ? 'var(--text-primary)' : 'var(--text-secondary)',
          }}>
            All
          </span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-2xs)',
            color: 'var(--text-muted)',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {holdings.reduce((s, h) => s + h.findingCount, 0)}
          </span>
        </motion.button>

        {holdings.map(h => (
          <motion.button
            key={h.id}
            variants={reduced ? undefined : itemVariants}
            onClick={() => onHoldingClick(h.id)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--sp-2)',
              padding: 'var(--sp-2) var(--sp-4)',
              background: activeHolding === h.id ? 'var(--surface-overlay)' : 'transparent',
              border: 'none',
              borderLeft: activeHolding === h.id ? '2px solid var(--accent)' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0, gap: '2px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', minWidth: 0 }}>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 600,
                  color: activeHolding === h.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {h.ticker}
                </span>
                {h.maxSeverity > 0 && <Severity value={h.maxSeverity} size="sm" label={false} />}
              </div>
              
              {/* Study Coverage & Scan Status indicators */}
              <div style={{
                fontSize: '9.5px',
                fontFamily: 'var(--font-mono)',
                lineHeight: 1.3,
                color: 'var(--text-muted)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1px',
                marginTop: '1.5px'
              }}>
                <span style={{ 
                  color: h.isStudied ? 'var(--accent)' : 'var(--bearish)', 
                  fontWeight: 500,
                  fontSize: '9px'
                }}>
                  {h.isStudied ? '✓ Studied' : '⚠️ Not studied'}
                </span>
                
                {h.lastRunStatus ? (
                  <span style={{
                    fontSize: '9px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: h.lastRunStatus === 'updated' 
                      ? 'var(--bullish)' 
                      : h.lastRunStatus === 'failed' 
                        ? 'var(--bearish)' 
                        : 'var(--text-muted)'
                  }}>
                    {h.lastRunStatus === 'updated' && `● Updated ${formatRelativeTime(h.lastIngestedAt)}`}
                    {h.lastRunStatus === 'quiet' && `○ Quiet ${formatRelativeTime(h.lastIngestedAt)}`}
                    {h.lastRunStatus === 'failed' && `✕ Run failed`}
                    {h.lastRunStatus === 'cached' && `⏸ Cached`}
                  </span>
                ) : (
                  <span>
                    {h.lastIngestedAt ? `scan: ${formatRelativeTime(h.lastIngestedAt)}` : 'never scanned'}
                  </span>
                )}
              </div>
            </div>
            
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-2xs)',
              color: 'var(--text-muted)',
              fontVariantNumeric: 'tabular-nums',
              flexShrink: 0,
            }}>
              {h.findingCount}
            </span>
          </motion.button>
        ))}
      </motion.div>

      {controls && (
        <div style={{ padding: 'var(--sp-4)', borderTop: '1px solid var(--border)' }}>
          {controls}
        </div>
      )}
    </>
  )
}

/* ────── Mobile rail ────── */
function MobileRail({
  clock,
  syncAgo,
  totalThreats,
  holdings,
  activeHolding,
  onHoldingClick,
}: {
  clock: string
  syncAgo: string
  totalThreats: number
  holdings: HoldingNav[]
  activeHolding: string | null
  onHoldingClick: (id: string | null) => void
}) {
  return (
    <div style={{ width: '100%' }}>
      {/* Top line: status */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 'var(--sp-2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
          <span style={{
            width: '5px', height: '5px', borderRadius: '50%',
            background: 'var(--bullish)',
            boxShadow: '0 0 6px var(--bullish)',
          }} />
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-2xs)',
            fontWeight: 600,
            color: 'var(--accent)',
            letterSpacing: '0.08em',
          }}>
            CORANTO
          </span>
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-2xs)',
          color: 'var(--text-muted)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {clock} IST · {syncAgo} · {totalThreats} finding{totalThreats !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Horizontal holding filter */}
      <div style={{
        display: 'flex',
        gap: 'var(--sp-1)',
        overflowX: 'auto',
        paddingBottom: '2px',
      }}>
        <FilterChip
          label="All"
          active={activeHolding === null}
          onClick={() => onHoldingClick(null)}
        />
        {holdings.map(h => (
          <FilterChip
            key={h.id}
            label={h.ticker}
            active={activeHolding === h.id}
            onClick={() => onHoldingClick(h.id)}
          />
        ))}
      </div>
    </div>
  )
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text-2xs)',
        fontWeight: 600,
        letterSpacing: '0.04em',
        padding: '3px 10px',
        borderRadius: 'var(--radius-sm)',
        border: active ? '1px solid var(--accent-border)' : '1px solid var(--border)',
        background: active ? 'var(--accent-dim)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-muted)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'all 0.15s ease',
      }}
    >
      {label}
    </button>
  )
}

/* ────── Count-up animation ────── */
function CountUp({ target }: { target: number }) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (target <= 0) return
    const steps = Math.min(target, 20)
    const inc = Math.ceil(target / steps)
    let current = 0
    const i = setInterval(() => {
      current = Math.min(current + inc, target)
      setVal(current)
      if (current >= target) clearInterval(i)
    }, 50)
    return () => clearInterval(i)
  }, [target])
  return <>{val}</>
}
