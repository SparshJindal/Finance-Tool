'use client'

import React, { useEffect, useRef, useState } from 'react'
import { motion, useTransform, useReducedMotion, useMotionTemplate } from 'framer-motion'
import { useLandingScroll } from './LandingScrollContext'

export function ElementIlluminator({ 
  id, 
  order, 
  children,
  className = '',
  style = {}
}: { 
  id: string
  order: number
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  const { register, unregister, elementFractions, progress } = useLandingScroll()
  const ref = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = useReducedMotion()
  
  // Track size for the SVG border trace
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    register(id, ref, order)
    return () => unregister(id)
  }, [id, order, register, unregister])

  useEffect(() => {
    if (!ref.current) return
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setSize({ 
          width: entry.contentRect.width, 
          height: entry.contentRect.height 
        })
      }
    })
    resizeObserver.observe(ref.current)
    return () => resizeObserver.disconnect()
  }, [])

  const frac = elementFractions.get(id) || 0

  // Only animate if frac is > 0 and we are not in reduced motion
  const active = frac > 0 && !prefersReducedMotion

  // act ramps from 0 to 1 and stays 1
  const act = useTransform(progress, [Math.max(0, frac - 0.04), frac], [0, 1], { clamp: true })
  
  // pulse peaks at 1 and settles at 0.35
  const pulse = useTransform(progress, [Math.max(0, frac - 0.04), frac, Math.min(1, frac + 0.06)], [0, 1, 0.35])

  const y = useTransform(act, [0, 1], [0, -6])
  const scale = useTransform(act, [0, 1], [1, 1.02])
  
  const filter = useMotionTemplate`brightness(${useTransform(pulse, p => 1 + p * 0.08)})`
  
  const boxShadow = useMotionTemplate`0 0 0 1px rgba(160,132,92,${useTransform(pulse, p => 0.2 + p * 0.5)}), 0 0 ${useTransform(pulse, p => 18 * p + 6)}px rgba(160,132,92,${useTransform(pulse, p => 0.15 + p * 0.45)})`

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{
        ...style,
        position: 'relative',
        willChange: 'transform, filter, box-shadow',
        ...(active ? { y, scale, filter, boxShadow } : {})
      }}
    >
      {/* Animated SVG Border Trace */}
      {active && size.width > 0 && size.height > 0 && (
        <svg 
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10, borderRadius: 'var(--radius-lg)' }} 
          width="100%" 
          height="100%"
        >
          {/* Inner faint white trace */}
          <motion.rect 
            x={1} y={1} 
            width={size.width - 2} 
            height={size.height - 2} 
            rx={12} 
            fill="none" 
            stroke="#FFFFFF" 
            strokeWidth="1.5" 
            opacity="0.6"
            style={{ pathLength: act }}
          />
          {/* Outer glowing trace */}
          <motion.rect 
            x={1} y={1} 
            width={size.width - 2} 
            height={size.height - 2} 
            rx={12} 
            fill="none" 
            stroke="var(--accent)" 
            strokeWidth="1.5"
            style={{ pathLength: act }}
          />
        </svg>
      )}
      
      {/* Inner content */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </div>
    </motion.div>
  )
}
