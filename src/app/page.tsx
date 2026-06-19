import Link from 'next/link';
import { PolygonMesh } from '@/components/PolygonMesh';

export const metadata = {
  title: 'Portfolio Disruption Radar | Financial Intelligence Without the Noise',
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
      }}>
        <h1 style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: 'clamp(2.5rem, 5vw, 3.5rem)',
          fontWeight: 700,
          fontStyle: 'italic',
          color: '#1F2937',
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
          marginBottom: 'var(--sp-4)',
        }}>
          Financial intelligence<br />without the noise.
        </h1>
        <p style={{
          fontFamily: 'var(--font-ui)',
          fontSize: 'var(--text-md)',
          color: '#6B7280',
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
            background: 'transparent',
            color: '#4B5563',
            border: '2px solid #4E342E',
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: 'var(--text-md)',
            fontWeight: 700,
            borderRadius: 'var(--radius-sm)',
            textDecoration: 'none',
            letterSpacing: '0.02em',
            transition: 'all 0.25s ease',
          }}
          className="hover:-translate-y-0.5 hover:opacity-80"
        >
          Get Started →
        </Link>
      </div>
    </div>
  );
}
