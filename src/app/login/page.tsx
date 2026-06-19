'use client'

import { useState } from 'react'
import { signIn } from "next-auth/react"
import { PolygonMesh } from "@/components/PolygonMesh"
import { CorantoLogo } from "@/components/CorantoLogo"

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    
    await signIn("resend", { email, callbackUrl: "/dashboard", redirect: true })
    setIsLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--base-0)',
      padding: 'var(--sp-6)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Animated polygon mesh background */}
      <PolygonMesh />

      <div style={{
        width: '100%',
        maxWidth: '420px',
        padding: 'var(--sp-10)',
        borderRadius: 'var(--radius-md)',
        background: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid var(--border)',
        borderTop: '2px solid #A0845C',
        boxShadow: '0 8px 32px rgba(93, 64, 37, 0.10), 0 1.5px 6px rgba(0,0,0,0.04)',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Branded Logo */}
        <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 'var(--sp-4)' }}>
          <CorantoLogo width={40} height={40} />
        </div>

        <h1 style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: 'var(--text-xl)',
          fontWeight: 600,
          marginBottom: 'var(--sp-2)',
          color: 'var(--text-primary)',
          lineHeight: 1.2,
        }}>
          Sign In
        </h1>

        <p style={{
          color: 'var(--text-secondary)',
          marginBottom: 'var(--sp-6)',
          fontSize: 'var(--text-sm)',
          lineHeight: 1.5,
        }}>
          Enter your email to receive a magic link to your portfolio.
        </p>

        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}
        >
          <input
            type="email"
            name="email"
            placeholder="investor@example.com"
            required
            className="input"
            style={{
              background: 'rgba(255, 255, 255, 0.7)',
              color: 'var(--text-primary)',
              borderColor: 'var(--border)',
            }}
          />
          <button
            type="submit"
            disabled={isLoading}
            className="btn"
            style={{
              justifyContent: 'center',
              height: '44px',
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: 'var(--text-md)',
              fontWeight: 600,
              letterSpacing: '0.04em',
              background: 'linear-gradient(135deg, #5D4037, #4E342E)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.7 : 1,
              transition: 'opacity 0.2s ease, box-shadow 0.2s ease',
              boxShadow: '0 2px 8px rgba(93, 64, 37, 0.18)',
            }}
          >
            {isLoading ? 'Sending...' : 'Send Magic Link'}
          </button>
        </form>
      </div>
    </div>
  )
}
