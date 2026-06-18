'use client'

import { useState } from 'react'

export function AddHoldingPanel({ action }: { action: (fd: FormData) => void | Promise<void> }) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{
      background: 'var(--base-1)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
      transition: 'border-color 0.15s ease',
    }}>
      {/* Toggle header */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--sp-4) var(--sp-5)',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          gap: 'var(--sp-4)',
        }}
        aria-expanded={open}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '18px',
            height: '18px',
            borderRadius: '50%',
            background: 'var(--accent-dim)',
            border: '1px solid var(--accent-border)',
            color: 'var(--accent)',
            fontSize: '12px',
            fontWeight: 700,
            lineHeight: 1,
            flexShrink: 0,
            transition: 'transform 0.2s ease',
            transform: open ? 'rotate(45deg)' : 'none',
          }}>
            +
          </span>
          <span style={{
            fontFamily: 'var(--font-ui)',
            fontSize: 'var(--text-sm)',
            fontWeight: 500,
            color: open ? 'var(--text-primary)' : 'var(--text-secondary)',
            transition: 'color 0.15s ease',
          }}>
            Add New Position
          </span>
        </div>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-2xs)',
          color: 'var(--text-muted)',
          letterSpacing: '0.06em',
        }}>
          {open ? 'COLLAPSE' : 'EXPAND'}
        </span>
      </button>

      {/* Collapsible body */}
      {open && (
        <form
          action={action}
          style={{
            padding: 'var(--sp-5)',
            paddingTop: 0,
            borderTop: '1px solid var(--border)',
          }}
        >
          <div style={{ height: 'var(--sp-5)' }} />

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 'var(--sp-4)',
            marginBottom: 'var(--sp-4)',
          }}>
            <div>
              <label className="section-label" style={{ display: 'block', marginBottom: 'var(--sp-2)' }}>
                Ticker
              </label>
              <input
                name="ticker"
                required
                className="input"
                placeholder="AAPL"
                style={{ fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}
              />
            </div>
            <div>
              <label className="section-label" style={{ display: 'block', marginBottom: 'var(--sp-2)' }}>
                Company
              </label>
              <input name="company" required className="input" placeholder="Apple Inc." />
            </div>
          </div>

          <div style={{ marginBottom: 'var(--sp-4)' }}>
            <label className="section-label" style={{ display: 'block', marginBottom: 'var(--sp-2)' }}>
              Investment Thesis
            </label>
            <textarea
              name="thesis"
              required
              rows={3}
              className="input"
              placeholder="Describe your investment rationale and key catalysts..."
              style={{ resize: 'vertical' }}
            />
          </div>

          <div style={{ marginBottom: 'var(--sp-5)' }}>
            <label className="section-label" style={{ display: 'block', marginBottom: 'var(--sp-2)' }}>
              Direction
            </label>
            <select name="directionLogic" className="input" style={{ width: '160px' }}>
              <option value="LONG">LONG</option>
              <option value="SHORT">SHORT</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
            <button type="submit" className="btn btn-primary">
              Add Position
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
