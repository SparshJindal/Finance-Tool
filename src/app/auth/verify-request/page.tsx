import Link from "next/link"
import { PolygonMesh } from "@/components/ui/PolygonMesh"

export default function VerifyRequestPage() {
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
        textAlign: 'center' as const,
      }}>
        {/* Mail icon */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 'var(--sp-5)',
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(160, 132, 92, 0.12), rgba(160, 132, 92, 0.06))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#A0845C"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="M22 4L12 13L2 4" />
            </svg>
          </div>
        </div>

        {/* Heading */}
        <h1 style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: 'var(--text-xl)',
          fontWeight: 600,
          marginBottom: 'var(--sp-2)',
          color: 'var(--text-primary)',
          lineHeight: 1.2,
        }}>
          Check your email
        </h1>

        {/* Subtitle */}
        <p style={{
          color: 'var(--text-secondary)',
          marginBottom: 'var(--sp-6)',
          fontSize: 'var(--text-sm)',
          lineHeight: 1.6,
          maxWidth: '320px',
          marginLeft: 'auto',
          marginRight: 'auto',
        }}>
          We&apos;ve sent a magic link to your inbox. Click the link in the email to securely access your portfolio.
        </p>

        {/* Divider */}
        <div style={{
          width: '48px',
          height: '1px',
          background: 'linear-gradient(90deg, transparent, #A0845C, transparent)',
          margin: '0 auto var(--sp-5)',
        }} />

        {/* Spam note */}
        <p style={{
          color: 'var(--text-muted)',
          fontSize: 'var(--text-xs, 0.75rem)',
          lineHeight: 1.5,
          marginBottom: 'var(--sp-5)',
        }}>
          Didn&apos;t receive it? Check your spam folder or try again.
        </p>

        {/* Back to Sign In link */}
        <Link
          href="/login"
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            color: 'var(--accent)',
            textDecoration: 'none',
            letterSpacing: '0.02em',
            transition: 'opacity 0.2s ease',
          }}
        >
          ← Back to Sign In
        </Link>
      </div>
    </div>
  )
}
