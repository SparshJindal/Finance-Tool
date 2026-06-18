/**
 * <Severity />
 *
 * A 5-segment bar chip rendered in JetBrains Mono.
 * Each segment lights up to the level, dimming remaining ones.
 * No emoji. No dots. Pure signal.
 *
 * Props:
 *   value  — integer 1–5
 *   size   — 'sm' | 'md' (default 'md')
 *   label  — show the numeric label alongside (default true)
 */
export function Severity({
  value,
  size = 'md',
  label = true,
}: {
  value: number
  size?: 'sm' | 'md'
  label?: boolean
}) {
  const clamped = Math.min(5, Math.max(1, Math.round(value)))

  // Per-level color tokens
  const activeColor = [
    'var(--sev-1)',
    'var(--sev-2)',
    'var(--sev-3)',
    'var(--sev-4)',
    'var(--sev-5)',
  ][clamped - 1]

  const segW = size === 'sm' ? 4 : 5
  const segH = size === 'sm' ? 10 : 14
  const gap  = 2

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: `${gap + 4}px`,
        fontFamily: 'var(--font-mono)',
        fontVariantNumeric: 'tabular-nums',
      }}
      aria-label={`Severity ${clamped} of 5`}
      title={`Severity ${clamped}/5`}
    >
      {/* Segment bar */}
      <span style={{ display: 'inline-flex', alignItems: 'flex-end', gap: `${gap}px` }}>
        {Array.from({ length: 5 }, (_, i) => {
          const active = i < clamped
          return (
            <span
              key={i}
              style={{
                display: 'block',
                width: `${segW}px`,
                // Progressive height: each segment slightly taller
                height: `${segH - (4 - i) * 1.5}px`,
                borderRadius: '1px',
                background: active ? activeColor : 'var(--base-3)',
                transition: 'background 0.2s ease',
              }}
            />
          )
        })}
      </span>

      {/* Numeric label */}
      {label && (
        <span
          style={{
            fontSize: size === 'sm' ? 'var(--text-2xs)' : 'var(--text-xs)',
            fontWeight: 600,
            color: activeColor,
            lineHeight: 1,
          }}
        >
          {clamped}
        </span>
      )}
    </span>
  )
}
