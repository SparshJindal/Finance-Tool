'use client'

import { useState, useRef } from 'react'
import Papa from 'papaparse'
import { importHoldings } from '@/app/actions'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'

type ParsedRow = {
  id: string
  ticker: string
  company: string
  quantity: string
  selected: boolean
}

export function ImportHoldingsPanel() {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [isImporting, setIsImporting] = useState(false)
  const [resultMsg, setResultMsg] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const shouldReduceMotion = useReducedMotion()

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (!results.meta.fields) return

        // Find matching columns case-insensitively
        const tickerKey = results.meta.fields.find(f => ['symbol', 'instrument', 'ticker', 'stock'].includes(f.toLowerCase().trim()))
        const companyKey = results.meta.fields.find(f => ['company', 'name', 'company name'].includes(f.toLowerCase().trim()))
        const qtyKey = results.meta.fields.find(f => ['quantity', 'qty', 'volume'].includes(f.toLowerCase().trim()))

        const parsedRows: ParsedRow[] = []

        for (let i = 0; i < results.data.length; i++) {
          const row: any = results.data[i]
          const ticker = tickerKey ? row[tickerKey]?.toString().trim() : ''
          const company = companyKey ? row[companyKey]?.toString().trim() : ''
          const quantity = qtyKey ? row[qtyKey]?.toString().trim() : ''

          if (ticker) {
            parsedRows.push({
              id: `${i}-${ticker}`,
              ticker,
              company: company || ticker,
              quantity: quantity || '-',
              selected: true
            })
          }
        }

        setRows(parsedRows)
        setResultMsg(null)
      }
    })
  }

  const toggleRow = (id: string) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, selected: !r.selected } : r))
  }

  const toggleAll = () => {
    const allSelected = rows.every(r => r.selected)
    setRows(prev => prev.map(r => ({ ...r, selected: !allSelected })))
  }

  const handleImport = async () => {
    const selected = rows.filter(r => r.selected)
    if (selected.length === 0) return

    setIsImporting(true)
    try {
      const res = await importHoldings(selected.map(r => ({ ticker: r.ticker, company: r.company })))
      setResultMsg(`Successfully imported ${res.imported} positions. Skipped ${res.skipped} duplicates.`)
      setRows([])
      if (fileInputRef.current) fileInputRef.current.value = ''
      
      // Auto close after 3s on success
      setTimeout(() => {
        setOpen(false)
        setResultMsg(null)
      }, 3000)
      
    } catch (err) {
      console.error(err)
      setResultMsg("An error occurred during import.")
    }
    setIsImporting(false)
  }

  return (
    <div style={{
      background: 'var(--base-1)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
      transition: 'border-color 0.15s ease',
      marginLeft: 'var(--sp-2)'
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--sp-4) var(--sp-5)',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          gap: 'var(--sp-3)',
          fontFamily: 'var(--font-ui)',
          fontSize: 'var(--text-sm)',
          fontWeight: 500,
          color: 'var(--text-primary)',
        }}
        aria-expanded={open}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          Import CSV
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={shouldReduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '0 var(--sp-5) var(--sp-5) var(--sp-5)', borderTop: '1px solid var(--border-subtle)' }}>
              
              {!rows.length && !resultMsg && (
                <div style={{
                  marginTop: 'var(--sp-4)',
                  padding: 'var(--sp-8)',
                  border: '2px dashed var(--border-hi)',
                  borderRadius: 'var(--radius-sm)',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: 'var(--surface)',
                }}
                onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    type="file"
                    accept=".csv"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    onChange={handleFileUpload}
                  />
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                    Click to select your broker's CSV file.<br/>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>(Zerodha, Groww, Upstox supported)</span>
                  </p>
                </div>
              )}

              {resultMsg && (
                <div style={{ marginTop: 'var(--sp-4)', padding: 'var(--sp-4)', background: 'var(--surface-elevated)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-sm)', color: 'var(--text-primary)', textAlign: 'center' }}>
                  {resultMsg}
                </div>
              )}

              {rows.length > 0 && (
                <div style={{ marginTop: 'var(--sp-4)' }}>
                  <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: 'var(--sp-4)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)' }}>
                      <thead style={{ position: 'sticky', top: 0, background: 'var(--surface-elevated)', borderBottom: '1px solid var(--border)' }}>
                        <tr>
                          <th style={{ padding: 'var(--sp-2)', textAlign: 'left', width: '40px' }}>
                            <input 
                              type="checkbox" 
                              checked={rows.length > 0 && rows.every(r => r.selected)}
                              onChange={toggleAll}
                              style={{ cursor: 'pointer' }}
                            />
                          </th>
                          <th style={{ padding: 'var(--sp-2)', textAlign: 'left', color: 'var(--text-secondary)' }}>Symbol</th>
                          <th style={{ padding: 'var(--sp-2)', textAlign: 'left', color: 'var(--text-secondary)' }}>Company</th>
                          <th style={{ padding: 'var(--sp-2)', textAlign: 'right', color: 'var(--text-secondary)' }}>Qty</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map(r => (
                          <tr key={r.id} style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--base-0)' }}>
                            <td style={{ padding: 'var(--sp-2)' }}>
                              <input 
                                type="checkbox" 
                                checked={r.selected} 
                                onChange={() => toggleRow(r.id)} 
                                style={{ cursor: 'pointer' }}
                              />
                            </td>
                            <td style={{ padding: 'var(--sp-2)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{r.ticker}</td>
                            <td style={{ padding: 'var(--sp-2)', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }}>{r.company}</td>
                            <td style={{ padding: 'var(--sp-2)', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{r.quantity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--sp-3)' }}>
                    <button
                      className="btn btn-secondary"
                      onClick={() => { setRows([]); setResultMsg(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                      disabled={isImporting}
                    >
                      Cancel
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={handleImport}
                      disabled={isImporting || !rows.some(r => r.selected)}
                      style={{ background: 'linear-gradient(135deg, var(--accent), #8A6D46)', color: '#fff', border: 'none' }}
                    >
                      {isImporting ? 'Importing...' : `Import ${rows.filter(r => r.selected).length} Holdings`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
