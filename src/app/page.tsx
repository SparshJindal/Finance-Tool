import Link from 'next/link';

export const metadata = {
  title: 'Portfolio Disruption Radar | Financial Intelligence Without the Noise',
};

export default function LandingPage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 var(--sp-6)',
      textAlign: 'center',
    }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h1 style={{
          fontFamily: 'var(--font-ui)',
          fontSize: 'var(--text-2xl)',
          fontWeight: 600,
          color: 'var(--text-primary)',
          letterSpacing: '-0.03em',
          lineHeight: 1.1,
          marginBottom: 'var(--sp-4)',
        }}>
          Financial intelligence without the noise.
        </h1>
        <p style={{
          fontFamily: 'var(--font-ui)',
          fontSize: 'var(--text-lg)',
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
          marginBottom: 'var(--sp-10)',
          maxWidth: '600px',
          marginInline: 'auto',
        }}>
          Autonomous AI agents that actively monitor your portfolio, read the news, and distill market noise into actionable, thesis-driven findings.
        </p>
        <Link 
          href="/dashboard"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '48px',
            padding: '0 var(--sp-8)',
            background: 'var(--text-primary)',
            color: 'var(--base-0)',
            fontFamily: 'var(--font-ui)',
            fontSize: 'var(--text-sm)',
            fontWeight: 500,
            borderRadius: 'var(--radius-sm)',
            textDecoration: 'none',
            letterSpacing: '0.01em',
            transition: 'transform 0.15s ease, opacity 0.15s ease',
          }}
          className="hover:-translate-y-0.5 hover:opacity-90"
        >
          Get Started
        </Link>
      </div>

      {/* Decorative subtle lines */}
      <div style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: '10%',
        width: '1px',
        background: 'var(--border)',
        zIndex: -1,
      }} />
      <div style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        right: '10%',
        width: '1px',
        background: 'var(--border)',
        zIndex: -1,
      }} />
    </div>
  );
}
