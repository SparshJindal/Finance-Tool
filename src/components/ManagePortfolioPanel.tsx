'use client'

import { useState, useTransition } from 'react'
import { CompanyLogo } from './CompanyLogo'

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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Find the holding currently being edited
  const editingHolding = holdings.find(h => h.id === editingId)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--sp-4)' }}>
              {holdings.map(h => (
                <div key={h.id} style={{
                  background: 'var(--surface-subtle)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: 'var(--sp-4)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--sp-2)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                      <CompanyLogo ticker={h.ticker} size={32} />
                      <div>
                        <div style={{ fontWeight: 600 }}>{h.ticker}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{h.company}</div>
                      </div>
                    </div>
                    <button onClick={() => setEditingId(h.id)} className="btn">
                      Edit
                    </button>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: 'var(--sp-2)' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Thesis:</span> {h.thesis || 'No thesis added yet.'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
