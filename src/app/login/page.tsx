'use client'

import { useState } from 'react'
import { signIn } from "next-auth/react"
import { PolygonMesh } from "@/components/PolygonMesh"
import { CorantoLogo } from "@/components/CorantoLogo"
import { signUp } from '@/app/actions'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMsg(null)
    
    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    if (!email || !password) {
      setErrorMsg("Email and password are required")
      setIsLoading(false)
      return
    }

    if (mode === 'signUp') {
      try {
        const res = await signUp(formData)
        if (res?.error) {
          setErrorMsg(res.error)
          setIsLoading(false)
          return
        }
        
        // Auto login after sign up
        const signInRes = await signIn("credentials", { email, password, redirect: false })
        if (signInRes?.error) {
          setErrorMsg("Account created, but failed to log in automatically.")
          setIsLoading(false)
          return
        }
        
        // Use hard redirect to ensure cookies are sent and router cache is cleared
        window.location.href = '/dashboard'
        return
      } catch (err: any) {
        setErrorMsg("Server crashed while trying to sign up. Check logs.")
        setIsLoading(false)
        return
      }
    }

    // Sign In logic
    const signInRes = await signIn("credentials", { email, password, redirect: false })
    if (signInRes?.error) {
      setErrorMsg("Invalid email or password.")
      setIsLoading(false)
      return
    }
    
    // Use hard redirect to ensure cookies are sent and router cache is cleared
    window.location.href = '/dashboard'
  }

  const handleMagicLink = async () => {
    const emailInput = document.querySelector('input[name="email"]') as HTMLInputElement
    const email = emailInput?.value
    if (!email) {
      setErrorMsg("Please enter your email for the magic link.")
      return
    }
    setIsLoading(true)
    setErrorMsg(null)
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
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(var(--glass-blur))',
        WebkitBackdropFilter: 'blur(var(--glass-blur))',
        border: '1px solid var(--border)',
        borderTop: '2px solid var(--accent)',
        boxShadow: 'var(--shadow-lg)',
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
          {mode === 'signIn' ? 'Sign In' : 'Create Account'}
        </h1>

        <p style={{
          color: 'var(--text-secondary)',
          marginBottom: 'var(--sp-6)',
          fontSize: 'var(--text-sm)',
          lineHeight: 1.5,
        }}>
          {mode === 'signIn' ? 'Welcome back to your portfolio dashboard.' : 'Sign up to start monitoring your portfolio.'}
        </p>

        {errorMsg && (
          <div style={{
            background: 'var(--bearish-dim)',
            border: '1px solid var(--bearish-border)',
            color: 'var(--bearish)',
            padding: 'var(--sp-3)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 'var(--text-sm)',
            marginBottom: 'var(--sp-4)',
          }}>
            {errorMsg}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}
        >
          <div>
            <label className="section-label" style={{ display: 'block', marginBottom: 'var(--sp-2)' }}>Email</label>
            <input
              type="email"
              name="email"
              placeholder="investor@example.com"
              required
              className="input"
              style={{
                width: '100%',
                background: 'var(--surface)',
                color: 'var(--text-primary)',
                borderColor: 'var(--border-hi)',
              }}
            />
          </div>
          <div>
            <label className="section-label" style={{ display: 'block', marginBottom: 'var(--sp-2)' }}>Password</label>
            <input
              type="password"
              name="password"
              placeholder="••••••••"
              required
              minLength={8}
              className="input"
              style={{
                width: '100%',
                background: 'var(--surface)',
                color: 'var(--text-primary)',
                borderColor: 'var(--border-hi)',
              }}
            />
          </div>

          <div style={{ marginTop: 'var(--sp-2)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            <button
              type="submit"
              disabled={isLoading}
              className="btn"
              style={{
                width: '100%',
                justifyContent: 'center',
                height: '44px',
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontSize: 'var(--text-md)',
                fontWeight: 600,
                letterSpacing: '0.04em',
                background: 'linear-gradient(135deg, var(--accent), #8A6D46)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.7 : 1,
                transition: 'opacity 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease',
                boxShadow: '0 4px 14px rgba(160, 132, 92, 0.4)',
              }}
            >
              {isLoading ? 'Please wait...' : (mode === 'signIn' ? 'Sign In' : 'Create Account')}
            </button>
            
            {mode === 'signIn' && (
              <button
                type="button"
                onClick={handleMagicLink}
                disabled={isLoading}
                className="btn btn-secondary"
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  height: '44px',
                }}
              >
                Send Magic Link Instead
              </button>
            )}
          </div>
        </form>

        <div style={{ marginTop: 'var(--sp-6)', textAlign: 'center' }}>
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'signIn' ? 'signUp' : 'signIn')
              setErrorMsg(null)
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: 'var(--text-sm)',
              cursor: 'pointer',
              textDecoration: 'underline',
              fontFamily: 'var(--font-ui)',
            }}
          >
            {mode === 'signIn' ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  )
}
