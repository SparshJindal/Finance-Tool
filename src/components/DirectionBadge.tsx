/**
 * <DirectionBadge />
 *
 * Renders OPPORTUNITY / RISK / NEUTRAL with semantic color and a directional
 * arrow. Uses only design tokens.
 */
export function DirectionBadge({
  direction,
  size = 'md',
}: {
  direction: 'OPPORTUNITY' | 'RISK' | 'NEUTRAL' | string
  size?: 'sm' | 'md'
}) {
  const upper = direction?.toUpperCase() || 'NEUTRAL'

  const config: Record<string, { color: string; bg: string; border: string; arrow: string }> = {
    OPPORTUNITY: {
      color:  'var(--bullish)',
      bg:     'var(--bullish-dim)',
      border: 'var(--bullish-border)',
      arrow:  '↑',
    },
    RISK: {
      color:  'var(--bearish)',
      bg:     'var(--bearish-dim)',
      border: 'var(--bearish-border)',
      arrow:  '↓',
    },
    NEUTRAL: {
      color:  'var(--text-muted)',
      bg:     'var(--neutral-dir-dim)',
      border: 'var(--neutral-dir-border)',
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
