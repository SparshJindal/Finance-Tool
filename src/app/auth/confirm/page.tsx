'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PolygonMesh } from '@/components/PolygonMesh'

function ConfirmSignInContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    setToken(searchParams.get('token'))
    setEmail(searchParams.get('email'))
  }, [searchParams])

  const handleConfirm = () => {
    if (token && email) {
      // Reconstruct the NextAuth callback URL securely in the browser
      // This ensures email bots can't scrape and trigger it
      const nextAuthUrl = `/api/auth/callback/resend?callbackUrl=${encodeURIComponent('/dashboard')}&token=${token}&email=${encodeURIComponent(email)}`
      window.location.href = nextAuthUrl
    } else {
      router.push('/login')
    }
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
        textAlign: 'center',
      }}>
        <h1 style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: 'var(--text-xl)',
          fontWeight: 600,
          marginBottom: 'var(--sp-2)',
          color: 'var(--text-primary)',
          lineHeight: 1.2,
        }}>
          Secure Access
        </h1>

        <p style={{
          color: 'var(--text-secondary)',
          marginBottom: 'var(--sp-8)',
          fontSize: 'var(--text-sm)',
          lineHeight: 1.6,
        }}>
          You are about to sign in to coranto. Click the button below to complete the secure authentication process.
        </p>

        <button
          onClick={handleConfirm}
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
            cursor: 'pointer',
            transition: 'opacity 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease',
            boxShadow: '0 4px 14px rgba(160, 132, 92, 0.4)',
          }}
        >
          Complete Sign In
        </button>
      </div>
    </div>
  )
}

export default function ConfirmSignInPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmSignInContent />
    </Suspense>
  )
}
