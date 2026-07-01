'use client'

import { motion, MotionValue } from 'framer-motion'

export function ScrollProgressBar({ progress }: { progress: MotionValue<number> }) {
  return (
    <motion.div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '3px',
        zIndex: 60,
        pointerEvents: 'none',
        background: 'linear-gradient(90deg, var(--accent), var(--bullish))',
        scaleX: progress,
        transformOrigin: 'left',
        willChange: 'transform'
      }}
    />
  )
}
