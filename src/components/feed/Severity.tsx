'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useReducedMotion } from '@/hooks/useReducedMotion'

const legend = {
  1: 'Noise',
  2: 'Minor',
  3: 'Notable',
  4: 'Significant',
  5: 'Thesis-critical'
}


export function Severity({
  value,
  size = 'md',
  label = true,
}: {
  value: number
  size?: 'sm' | 'md'
  label?: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const clamped = Math.min(5, Math.max(1, Math.round(value)))

  // Per-level color tokens
  const activeColor = [
    'var(--sev-1)',
    'var(--sev-2)',
    'var(--sev-3)',
    'var(--sev-4)',
    'var(--sev-5)',
  ][clamped - 1]

  const segW = size === 'sm' ? 3 : 4
  const segH = size === 'sm' ? 10 : 14
  const gap  = 2
  const reduced = useReducedMotion()

  return (
    <motion.span
      animate={!reduced && clamped >= 4 ? { opacity: [1, 0.6, 1] } : undefined}
      transition={!reduced && clamped >= 4 ? { repeat: Infinity, duration: 2.2, ease: "easeInOut" } : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: `${gap + 4}px`,
        fontFamily: 'var(--font-mono)',
        fontVariantNumeric: 'tabular-nums',
        position: 'relative',
        cursor: 'help',
      }}
      aria-label={`Severity ${clamped} of 5: ${legend[clamped as 1|2|3|4|5]}`}
      title={`Severity ${clamped}/5: ${legend[clamped as 1|2|3|4|5]}`}
    >
      {hovered && (
        <span style={{
          position: 'absolute',
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%) translateY(-6px)',
          background: 'var(--surface-elevated)',
          border: '1px solid var(--border)',
          color: 'var(--text-primary)',
          padding: '4px 8px',
          borderRadius: 'var(--radius-sm)',
          fontSize: '9px',
          fontFamily: 'var(--font-mono)',
          whiteSpace: 'nowrap',
          zIndex: 999,
          pointerEvents: 'none',
          boxShadow: 'var(--shadow-md)',
          lineHeight: 1,
        }}>
          {clamped} · {legend[clamped as 1|2|3|4|5]}
        </span>
      )}
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
                background: active ? activeColor : 'var(--surface-subtle)',
                boxShadow: active && clamped >= 4 ? `0 0 4px ${activeColor}` : 'none',
                transition: 'background 0.2s ease, box-shadow 0.2s ease',
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
    </motion.span>
  )
}
