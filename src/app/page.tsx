import Link from 'next/link';
import { PolygonMesh } from '@/components/PolygonMesh';
import { CorantoLogo } from '@/components/CorantoLogo';

export const metadata = {
  title: 'coranto | Market Intelligence Dispatch',
};

export default function LandingPage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 var(--sp-6)',
      textAlign: 'center' as const,
      position: 'relative' as const,
      overflow: 'hidden',
    }}>
      {/* Interactive polygon mesh background */}
      <PolygonMesh />

      {/* Content layer */}
      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>
        <CorantoLogo width={80} height={80} className="mb-6" />
        <h1 style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: 'clamp(2.5rem, 5vw, 3.5rem)',
          fontWeight: 700,
          fontStyle: 'italic',
          color: 'var(--text-primary)',
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
          marginBottom: 'var(--sp-4)',
        }}>
          Financial intelligence<br />without the noise.
        </h1>
        {/* Decorative warm accent divider */}
        <div style={{
          width: '40px',
          height: '2px',
          background: 'var(--accent)',
          margin: 'var(--sp-4) auto var(--sp-2)',
          borderRadius: '1px',
        }} />
        <p style={{
          fontFamily: 'var(--font-ui)',
          fontSize: 'var(--text-md)',
          color: 'var(--text-secondary)',
          lineHeight: 1.7,
          marginBottom: 'var(--sp-10)',
          maxWidth: '520px',
          marginInline: 'auto',
        }}>
          Autonomous AI agents that monitor your portfolio, read the news, and distill market noise into thesis&#8209;driven findings.
        </p>
        <Link 
          href="/dashboard"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '48px',
            padding: '0 var(--sp-8)',
            background: 'linear-gradient(135deg, var(--accent), #8A6D46)',
            color: '#FFFFFF',
            border: 'none',
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: 'var(--text-md)',
            fontWeight: 700,
            borderRadius: 'var(--radius-sm)',
            textDecoration: 'none',
            letterSpacing: '0.02em',
            boxShadow: '0 4px 14px rgba(160, 132, 92, 0.4)',
            transition: 'all 0.25s ease',
          }}
          className="hover:-translate-y-0.5 hover:shadow-lg hover:brightness-110"
        >
          Get Started →
        </Link>
      </div>
    </div>
  );
}
