/**
 * <RelevanceBadge />
 *
 * Renders HIGH RELEVANCE / RELEVANT with semantic color.
 */
export function RelevanceBadge({
  severity,
  size = 'md',
}: {
  severity: number
  size?: 'sm' | 'md'
}) {
  const isHigh = severity >= 4

  const config = isHigh ? {
    color:  'var(--bullish)', // we can reuse these colors as "high/low" or create new ones, wait, red is usually for risk. 
    bg:     'var(--bullish-dim)',
    border: 'var(--bullish-border)',
    text: 'HIGH RELEVANCE'
  } : {
    color:  'var(--text-muted)',
    bg:     'var(--neutral-dir-dim)',
    border: 'var(--neutral-dir-border)',
    text: 'RELEVANT'
  }

  const fontSize = size === 'sm' ? 'var(--text-2xs)' : 'var(--text-xs)'

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--sp-1)',
        padding: size === 'sm' ? '2px 6px' : '4px 8px',
        borderRadius: 'var(--radius-sm)',
        background: config.bg,
        border: `1px solid ${config.border}`,
        color: config.color,
        fontFamily: 'var(--font-mono)',
        fontSize,
        fontWeight: 600,
        letterSpacing: '0.04em',
        whiteSpace: 'nowrap',
      }}
    >
      <span>{config.text}</span>
    </div>
  )
}
