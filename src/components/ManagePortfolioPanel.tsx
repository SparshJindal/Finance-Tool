'use client'

import { useState, useTransition } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

type Holding = {
  id: string
  ticker: string
  company: string
  thesis: string
  directionLogic: string
  kind: string
}

export function ManagePortfolioPanel({
  holdings,
  updateAction,
  deleteAction
}: {
  holdings: Holding[]
  updateAction: (fd: FormData) => void | Promise<void>
  deleteAction: (fd: FormData) => void | Promise<void>
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Find the holding currently being edited
  const editingHolding = holdings.find(h => h.id === editingId)

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)} 
        className="btn btn-secondary"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
        Manage Portfolio
      </button>

      <AnimatePresence>
        {isOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', justifyContent: 'flex-end' }}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              style={{
                position: 'absolute', inset: 0,
                background: 'rgba(0, 0, 0, 0.4)',
                backdropFilter: 'blur(4px)',
                WebkitBackdropFilter: 'blur(4px)',
              }}
            />

            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              style={{
                position: 'relative',
                width: '480px',
                maxWidth: '100vw',
                height: '100%',
                background: 'var(--surface-elevated)',
                borderLeft: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: 'var(--shadow-xl)',
              }}
            >
              <div style={{ padding: 'var(--sp-6)', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-lg)', fontWeight: 600 }}>Manage Portfolio</h2>
                  <button onClick={() => setIsOpen(false)} style={{ color: 'var(--text-secondary)' }}>
                    ✕
                  </button>
                </div>
              </div>

              <div style={{ padding: 'var(--sp-6)', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
                {editingId && editingHolding ? (
                  <div style={{
                    background: 'var(--surface-subtle)',
                    border: '1px solid var(--border-hi)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--sp-4)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--sp-4)' }}>
                      <h3 style={{ fontWeight: 600, fontSize: 'var(--text-md)' }}>
                        Edit {editingHolding.ticker}
                      </h3>
                      <button onClick={() => setEditingId(null)} style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
                        Back to list
                      </button>
                    </div>

                    <form action={fd => {
                      startTransition(() => {
                        updateAction(fd)
                        setEditingId(null)
                      })
                    }} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
                      <input type="hidden" name="id" value={editingHolding.id} />
                      <input type="hidden" name="ticker" value={editingHolding.ticker} />
                      <input type="hidden" name="company" value={editingHolding.company} />
                      
                      <div>
                        <label className="label">Thesis</label>
                        <textarea
                          name="thesis"
                          defaultValue={editingHolding.thesis}
                          required
                          className="input"
                          style={{ minHeight: '120px', resize: 'vertical' }}
                        />
                      </div>

                      <div>
                        <label className="label">Direction</label>
                        <select name="directionLogic" defaultValue={editingHolding.directionLogic} className="input">
                          <option value="LONG">Long (Benefit from positive news)</option>
                          <option value="SHORT">Short (Benefit from negative news)</option>
                        </select>
                      </div>

                      <button type="submit" className="btn btn-primary" disabled={isPending}>
                        {isPending ? 'Saving...' : 'Save Changes'}
                      </button>
                    </form>

                    <div style={{ marginTop: 'var(--sp-6)', paddingTop: 'var(--sp-4)', borderTop: '1px solid var(--border)' }}>
                      <form action={fd => {
                        startTransition(() => {
                          deleteAction(fd)
                          setEditingId(null)
                        })
                      }}>
                        <input type="hidden" name="id" value={editingHolding.id} />
                        <button type="submit" className="btn" style={{ 
                          width: '100%', 
                          background: 'var(--bearish-dim)', 
                          color: 'var(--bearish)',
                          border: '1px solid var(--bearish-border)'
                        }} disabled={isPending}>
                          {isPending ? 'Deleting...' : 'Delete Holding'}
                        </button>
                      </form>
                    </div>
                  </div>
                ) : (
                  <>
                    {holdings.length === 0 ? (
                      <p style={{ color: 'var(--text-secondary)' }}>No holdings yet.</p>
                    ) : (
                      holdings.map(h => (
                        <div key={h.id} style={{
                          background: 'var(--surface-subtle)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          padding: 'var(--sp-4)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                              <div style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{h.ticker}</div>
                              {h.kind === 'WATCHLIST' && (
                                <span style={{ 
                                  fontSize: '10px', 
                                  background: 'var(--surface-overlay)', 
                                  border: '1px solid var(--border)', 
                                  padding: '1px 4px', 
                                  borderRadius: '2px', 
                                  color: 'var(--text-muted)' 
                                }}>
                                  WATCH
                                </span>
                              )}
                            </div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-xs)' }}>{h.company}</div>
                          </div>
                          <button 
                            onClick={() => setEditingId(h.id)}
                            className="btn btn-secondary"
                            style={{ padding: 'var(--sp-1) var(--sp-3)', fontSize: 'var(--text-xs)' }}
                          >
                            Edit
                          </button>
                        </div>
                      ))
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
