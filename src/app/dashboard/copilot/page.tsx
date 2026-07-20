'use client'

import { useState } from 'react'
import { Send, Bot } from 'lucide-react'

export default function CopilotPage() {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', text: string }[]>([
    { role: 'assistant', text: 'Hello. I am Coranto Copilot. I have full context of your portfolio holdings, recent news, and thesis health. What would you like to know?' }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    
    const userMessage = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: userMessage }])
    setIsLoading(true)

    try {
      const res = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage })
      })
      const data = await res.json()
      
      setMessages(prev => [...prev, { role: 'assistant', text: data.reply || 'Sorry, I encountered an error.' }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Connection failed. Please try again later.' }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 180px)', gap: 'var(--sp-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>
            Coranto Copilot
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
            Query your portfolio intelligence using natural language.
          </p>
        </div>
      </div>

      <div style={{ 
        flex: 1, 
        background: 'var(--glass-bg)', 
        backdropFilter: 'blur(var(--glass-blur))', 
        border: '1px solid var(--border)', 
        borderRadius: 'var(--radius-lg)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Chat History */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--sp-6)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          {messages.map((m, i) => (
            <div key={i} style={{ 
              display: 'flex', 
              gap: 'var(--sp-4)', 
              alignItems: 'flex-start',
              flexDirection: m.role === 'user' ? 'row-reverse' : 'row'
            }}>
              <div style={{ 
                width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                background: m.role === 'assistant' ? 'var(--accent)' : 'var(--surface-subtle)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff'
              }}>
                {m.role === 'assistant' ? <Bot size={18} /> : 'U'}
              </div>
              <div style={{
                background: m.role === 'user' ? 'var(--surface-subtle)' : 'transparent',
                border: m.role === 'assistant' ? 'none' : '1px solid var(--border)',
                padding: 'var(--sp-3) var(--sp-4)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-md)',
                lineHeight: 1.6,
                maxWidth: '80%'
              }}>
                {m.text}
              </div>
            </div>
          ))}
          {isLoading && (
            <div style={{ display: 'flex', gap: 'var(--sp-4)', alignItems: 'flex-start' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                <Bot size={18} />
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-md)', padding: 'var(--sp-3) var(--sp-4)' }}>
                Thinking...
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div style={{ padding: 'var(--sp-4)', borderTop: '1px solid var(--border)' }}>
          <form onSubmit={handleSend} style={{ display: 'flex', gap: 'var(--sp-2)' }}>
            <input 
              type="text" 
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask about threats to your portfolio..."
              style={{
                flex: 1,
                background: 'var(--surface-subtle)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--sp-3) var(--sp-4)',
                color: 'var(--text-primary)',
                outline: 'none'
              }}
            />
            <button 
              type="submit" 
              disabled={isLoading || !input.trim()}
              style={{
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                padding: '0 var(--sp-6)',
                cursor: 'pointer',
                opacity: (isLoading || !input.trim()) ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
