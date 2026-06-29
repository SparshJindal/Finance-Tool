'use client'

import { useState, useEffect } from 'react'

type MarketTicker = { symbol: string, company: string }

export function AddHoldingPanel({ action }: { action: (fd: FormData) => void | Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<MarketTicker[]>([])
  const [selectedTicker, setSelectedTicker] = useState<MarketTicker | null>(null)

  useEffect(() => {
    if (!searchQuery || selectedTicker) {
      setSearchResults([])
      return
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/tickers/search?q=${encodeURIComponent(searchQuery)}`)
        const data = await res.json()
        setSearchResults(data.tickers || [])
      } catch (err) {
        console.error(err)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, selectedTicker])

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

          <div style={{ height: 'var(--sp-5)' }} />

          <div style={{ marginBottom: 'var(--sp-4)', position: 'relative' }}>
            <label className="section-label" style={{ display: 'block', marginBottom: 'var(--sp-2)' }}>
              Search Stocks
            </label>
            <input
              type="text"
              className="input"
              placeholder="Start typing a ticker or company name (US or Indian)..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                if (selectedTicker) setSelectedTicker(null)
              }}
              autoComplete="off"
            />
            
            {/* Hidden fields for the form action */}
            <input type="hidden" name="ticker" value={selectedTicker?.symbol || searchQuery.toUpperCase()} />
            <input type="hidden" name="company" value={selectedTicker?.company || searchQuery} />

            {/* Dropdown Results */}
            {searchResults.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: '4px',
                background: 'var(--base-1)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-lg)',
                zIndex: 10,
                maxHeight: '250px',
                overflowY: 'auto',
              }}>
                {searchResults.map((ticker) => (
                  <button
                    key={ticker.symbol}
                    type="button"
                    onClick={() => {
                      setSelectedTicker(ticker)
                      setSearchQuery(`${ticker.symbol} - ${ticker.company}`)
                      setSearchResults([])
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      padding: 'var(--sp-3) var(--sp-4)',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      alignItems: 'flex-start',
                    }}
                  >
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent)' }}>
                      {ticker.symbol}
                    </span>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.3 }}>
                      {ticker.company}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 'var(--sp-6)', marginBottom: 'var(--sp-4)' }}>
            <div>
              <label className="section-label" style={{ display: 'block', marginBottom: 'var(--sp-2)' }}>
                Exchange
              </label>
              <select name="exchange" className="input" defaultValue="US" style={{ width: '160px' }}>
                <option value="US">US (NYSE/NASDAQ)</option>
                <option value="NSE">India (NSE)</option>
                <option value="BSE">India (BSE)</option>
              </select>
            </div>
            <div>
              <label className="section-label" style={{ display: 'block', marginBottom: 'var(--sp-2)' }}>
                Type
              </label>
              <div style={{ display: 'flex', gap: 'var(--sp-4)', alignItems: 'center', height: '40px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', cursor: 'pointer' }}>
                  <input type="radio" name="kind" value="PORTFOLIO" defaultChecked />
                  <span style={{ fontSize: 'var(--text-sm)' }}>Portfolio</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', cursor: 'pointer' }}>
                  <input type="radio" name="kind" value="WATCHLIST" />
                  <span style={{ fontSize: 'var(--text-sm)' }}>Watchlist</span>
                </label>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 'var(--sp-4)' }}>
            <label className="section-label" style={{ display: 'block', marginBottom: 'var(--sp-2)' }}>
              Investment Thesis / Why I'm Watching
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
