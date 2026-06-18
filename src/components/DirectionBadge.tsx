/**
 * <DirectionBadge />
 *
 * Renders BULLISH / BEARISH / NEUTRAL with semantic color and a directional
 * arrow. Uses only design tokens — no magic hex values.
 *
 * Props:
 *   direction — 'BULLISH' | 'BEARISH' | 'NEUTRAL'
 *   size      — 'sm' | 'md' (default 'md')
 */
export function DirectionBadge({
  direction,
  size = 'md',
}: {
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | string
  size?: 'sm' | 'md'
}) {
  const upper = direction?.toUpperCase() || 'NEUTRAL'

  const config: Record<string, { color: string; bg: string; border: string; arrow: string }> = {
    BULLISH: {
      color:  'var(--tailwind-green)',
      bg:     'var(--tailwind-dim)',
      border: 'rgba(62,207,142,0.20)',
      arrow:  '↑',
    },
    BEARISH: {
      color:  'var(--threat)',
      bg:     'var(--threat-dim)',
      border: 'rgba(232,64,64,0.20)',
      arrow:  '↓',
    },
    NEUTRAL: {
      color:  'var(--text-muted)',
      bg:     'var(--base-2)',
      border: 'var(--border)',
      arrow:  '→',
    },
  }

  const c = config[upper] ?? config.NEUTRAL
  const fontSize = size === 'sm' ? 'var(--text-2xs)' : 'var(--text-xs)'

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        fontFamily: 'var(--font-mono)',
        fontSize,
        fontWeight: 600,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: c.color,
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 'var(--radius-sm)',
        padding: size === 'sm' ? '1px 6px' : '2px 8px',
        lineHeight: 1.4,
      }}
      aria-label={upper}
    >
      <span style={{ fontSize: '0.9em', lineHeight: 1 }}>{c.arrow}</span>
      {upper}
    </span>
  )
}
