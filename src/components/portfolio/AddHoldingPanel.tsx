'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'

type MarketTicker = { symbol: string, company: string }

export function AddHoldingPanel({ action }: { action: (fd: FormData) => void | Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<MarketTicker[]>([])
  const [selectedTicker, setSelectedTicker] = useState<MarketTicker | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!searchQuery || selectedTicker) {
      setSearchResults([])
      setIsLoading(false)
      setErrorMsg('')
      setDebugInfo(null)
      return
    }
    
    setIsLoading(true)
    setErrorMsg('')
    setDebugInfo(null)
    
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/tickers/search?q=${encodeURIComponent(searchQuery)}`, {
          cache: 'no-store',
          headers: {
            'Pragma': 'no-cache',
            'Cache-Control': 'no-cache'
          }
        })
        if (!res.ok) {
          const text = await res.text()
          throw new Error(`API returned ${res.status}: ${text.slice(0, 50)}`)
        }
        const data = await res.json()
        if (data.debug) setDebugInfo(data.debug)
        setSearchResults(data.tickers || [])
      } catch (err: any) {
        console.error('Search API error:', err)
        setErrorMsg(err.message || 'Unknown error occurred')
      } finally {
        setIsLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, selectedTicker])

  const modalContent = (
    <AnimatePresence>
      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0, 0, 0, 0.4)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
            }}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '600px',
              maxHeight: '90vh',
              background: 'var(--surface-elevated)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: 'var(--shadow-xl)',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: 'var(--sp-5) var(--sp-6)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface)' }}>
              <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-lg)', fontWeight: 600 }}>Add New Position</h2>
              <button onClick={() => setOpen(false)} style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }}>
                ✕
              </button>
            </div>

            <form
              action={fd => {
                action(fd)
                setOpen(false)
              }}
              style={{ padding: 'var(--sp-6)', overflowY: 'auto' }}
            >
              <div style={{ marginBottom: 'var(--sp-5)' }}>
                <label className="section-label" style={{ display: 'block', marginBottom: 'var(--sp-2)' }}>
                  Search Stocks
                </label>
                <div style={{ position: 'relative' }}>
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
                  
                  <input type="hidden" name="ticker" value={selectedTicker?.symbol || searchQuery.toUpperCase()} />
                  <input type="hidden" name="company" value={selectedTicker?.company || searchQuery} />

                  {(searchResults.length > 0 || searchQuery.length > 0) && !selectedTicker && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px',
                      background: 'var(--base-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                      boxShadow: 'var(--shadow-lg)', zIndex: 50, maxHeight: '250px', overflowY: 'auto',
                    }}>
                      {isLoading ? (
                        <div style={{ padding: 'var(--sp-3) var(--sp-4)', color: 'var(--text-muted)' }}>Searching...</div>
                      ) : errorMsg ? (
                        <div style={{ padding: 'var(--sp-3) var(--sp-4)', color: 'var(--error)' }}>{errorMsg}</div>
                      ) : searchResults.length === 0 ? (
                        <div style={{ padding: 'var(--sp-3) var(--sp-4)', color: 'var(--text-muted)' }}>
                          No results found for "{searchQuery}"
                          {debugInfo && (
                            <div style={{ marginTop: '8px', padding: '4px', background: 'var(--bg-card)', fontSize: '10px', color: 'var(--text-secondary)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                              DEBUG: {JSON.stringify(debugInfo)}
                            </div>
                          )}
                        </div>
                      ) : searchResults.map((ticker) => (
                        <button
                          key={ticker.symbol}
                          type="button"
                          onClick={() => {
                            setSelectedTicker(ticker)
                            setSearchQuery(`${ticker.symbol} - ${ticker.company}`)
                            setSearchResults([])
                          }}
                          style={{
                            width: '100%', display: 'flex', flexDirection: 'column', gap: '4px',
                            padding: 'var(--sp-3) var(--sp-4)', background: 'transparent', border: 'none',
                            borderBottom: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left', alignItems: 'flex-start',
                          }}
                        >
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent)' }}>{ticker.symbol}</span>
                          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.3 }}>{ticker.company}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 'var(--sp-6)', marginBottom: 'var(--sp-5)' }}>
                <div style={{ flex: 1 }}>
                  <label className="section-label" style={{ display: 'block', marginBottom: 'var(--sp-2)' }}>Exchange</label>
                  <select name="exchange" className="input" defaultValue="US" style={{ width: '100%' }}>
                    <option value="US">US (NYSE/NASDAQ)</option>
                    <option value="NSE">India (NSE)</option>
                    <option value="BSE">India (BSE)</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label className="section-label" style={{ display: 'block', marginBottom: 'var(--sp-2)' }}>Type</label>
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

              <div style={{ marginBottom: 'var(--sp-5)' }}>
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

              <div style={{ marginBottom: 'var(--sp-6)' }}>
                <label className="section-label" style={{ display: 'block', marginBottom: 'var(--sp-2)' }}>Direction</label>
                <select name="directionLogic" className="input" style={{ width: '100%' }}>
                  <option value="LONG">LONG</option>
                  <option value="SHORT">SHORT</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: 'var(--sp-3)', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: 'var(--sp-5)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Add Position
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )

  return (
    <>
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        + Add New Position
      </button>
      {mounted && createPortal(modalContent, document.body)}
    </>
  )
}
