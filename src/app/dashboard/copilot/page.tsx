'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Bot, Sparkles, TrendingUp, AlertTriangle } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { motion, AnimatePresence } from 'framer-motion'
import { PolygonMesh } from '@/components/ui/PolygonMesh'

export default function CopilotPage() {
  const [messages, setMessages] = useState<{ id: string, role: 'user' | 'assistant', text: string }[]>([
    { id: '1', role: 'assistant', text: 'Hello. I am Cora AI.\n\nI have full context of your portfolio holdings, recent news, and thesis health. What would you like to know?' }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const handleSend = async (text: string) => {
    if (!text.trim() || isLoading) return
    
    const userMessage = text.trim()
    setInput('')
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', text: userMessage }])
    setIsLoading(true)

    try {
      const res = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage })
      })
      const data = await res.json()
      
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', text: data.reply || 'Sorry, I encountered an error.' }])
    } catch (err) {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', text: 'Connection failed. Please try again later.' }])
    } finally {
      setIsLoading(false)
    }
  }

  const quickPrompts = [
    { icon: <AlertTriangle size={14} />, text: "What are the biggest threats?" },
    { icon: <TrendingUp size={14} />, text: "Are there any bullish signals?" },
    { icon: <Sparkles size={14} />, text: "Summarize my portfolio health." }
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', gap: 'var(--sp-4)', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
        <div>
          <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
            <Bot size={24} color="var(--accent)" /> Cora AI
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginTop: 'var(--sp-1)' }}>
            Elite market intelligence. Query your portfolio using natural language.
          </p>
        </div>
      </div>

      <div style={{ 
        flex: 1, 
        position: 'relative',
        background: 'var(--glass-bg)', 
        backdropFilter: 'blur(32px)', 
        border: '1px solid var(--border)', 
        borderRadius: 'var(--radius-lg)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-lg)'
      }}>
        {/* Background Mesh */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, opacity: 0.15, pointerEvents: 'none' }}>
          <PolygonMesh />
        </div>

        {/* Chat History */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--sp-6)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)', zIndex: 10 }}>
          <AnimatePresence initial={false}>
            {messages.map((m) => (
              <motion.div 
                key={m.id} 
                initial={{ opacity: 0, y: 15, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                style={{ 
                  display: 'flex', 
                  gap: 'var(--sp-4)', 
                  alignItems: 'flex-start',
                  flexDirection: m.role === 'user' ? 'row-reverse' : 'row'
                }}
              >
                <div style={{ 
                  width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                  background: m.role === 'assistant' ? 'var(--accent)' : 'var(--surface-subtle)',
                  boxShadow: m.role === 'assistant' ? '0 0 15px var(--accent-dim)' : 'none',
                  border: m.role === 'assistant' ? '1px solid var(--accent-border)' : '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: m.role === 'assistant' ? '#fff' : 'var(--text-secondary)'
                }}>
                  {m.role === 'assistant' ? <Bot size={20} /> : 'U'}
                </div>
                <div style={{
                  background: m.role === 'user' ? 'var(--surface-elevated)' : 'transparent',
                  border: m.role === 'assistant' ? 'none' : '1px solid var(--border)',
                  boxShadow: m.role === 'user' ? 'var(--shadow-sm)' : 'none',
                  padding: 'var(--sp-3) var(--sp-4)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--text-md)',
                  lineHeight: 1.6,
                  maxWidth: '85%',
                  overflowX: 'auto',
                  whiteSpace: 'pre-wrap'
                }}>
                  {m.role === 'assistant' ? (
                    <div style={{ padding: '0 var(--sp-2)' }}>
                      <ReactMarkdown
                        components={{
                          p: ({ node, ...props }) => <p style={{ marginBottom: 'var(--sp-3)' }} {...props} />,
                          ul: ({ node, ...props }) => <ul style={{ paddingLeft: 'var(--sp-4)', marginBottom: 'var(--sp-3)', listStyle: 'disc' }} {...props} />,
                          li: ({ node, ...props }) => <li style={{ marginBottom: 'var(--sp-1)' }} {...props} />,
                          strong: ({ node, ...props }) => <strong style={{ fontWeight: 600, color: 'var(--text-primary)' }} {...props} />,
                          code: ({ node, ...props }) => <code style={{ background: 'var(--surface-subtle)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'var(--font-mono)', fontSize: '0.9em' }} {...props} />
                        }}
                      >
                        {m.text}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    m.text
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Quick Prompts */}
          {messages.length === 1 && !isLoading && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              style={{ display: 'flex', gap: 'var(--sp-3)', paddingLeft: 'calc(36px + var(--sp-4))', flexWrap: 'wrap', marginTop: 'var(--sp-2)' }}
            >
              {quickPrompts.map((qp, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(qp.text)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--sp-2)',
                    background: 'var(--surface-overlay)',
                    border: '1px solid var(--border)',
                    padding: 'var(--sp-2) var(--sp-3)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-secondary)',
                    fontSize: 'var(--text-xs)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--accent)'
                    e.currentTarget.style.color = 'var(--accent)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border)'
                    e.currentTarget.style.color = 'var(--text-secondary)'
                  }}
                >
                  {qp.icon} {qp.text}
                </button>
              ))}
            </motion.div>
          )}

          {isLoading && (
            <motion.div 
              initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
              style={{ display: 'flex', gap: 'var(--sp-4)', alignItems: 'flex-start' }}
            >
              <motion.div 
                animate={{ boxShadow: ['0 0 0px var(--accent)', '0 0 20px var(--accent)', '0 0 0px var(--accent)'] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                style={{ 
                  width: '36px', height: '36px', borderRadius: '50%', background: 'var(--accent)', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                  border: '1px solid var(--accent-border)'
                }}
              >
                <Bot size={20} />
              </motion.div>
              <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-md)', padding: 'var(--sp-3) var(--sp-4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)' }}>ANALYZING</span>
                <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: 0 }} style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--accent)' }} />
                <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: 0.2 }} style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--accent)' }} />
                <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: 0.4 }} style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--accent)' }} />
              </div>
            </motion.div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ padding: 'var(--sp-4)', background: 'var(--surface-overlay)', borderTop: '1px solid var(--border)', zIndex: 10 }}>
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSend(input); }} 
            style={{ 
              display: 'flex', 
              gap: 'var(--sp-3)',
              background: 'var(--surface-elevated)',
              padding: 'var(--sp-2)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <input 
              type="text" 
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Query Cora AI..."
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                padding: 'var(--sp-2) var(--sp-4)',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-md)',
                outline: 'none',
                fontFamily: 'var(--font-ui)'
              }}
            />
            <button 
              type="submit" 
              disabled={isLoading || !input.trim()}
              style={{
                background: (isLoading || !input.trim()) ? 'var(--surface-subtle)' : 'var(--accent)',
                color: (isLoading || !input.trim()) ? 'var(--text-muted)' : '#fff',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                padding: '0 var(--sp-5)',
                cursor: (isLoading || !input.trim()) ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: (isLoading || !input.trim()) ? 'none' : '0 2px 10px var(--accent-dim)'
              }}
            >
              <Send size={18} style={{ transform: (isLoading || !input.trim()) ? 'none' : 'translateX(2px)', transition: 'transform 0.2s ease' }} />
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
