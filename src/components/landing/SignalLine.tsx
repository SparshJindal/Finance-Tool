'use client'

import { motion, MotionValue, useTransform, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'

export function SignalLine({ progress }: { progress: MotionValue<number> }) {
  const prefersReducedMotion = useReducedMotion()
  const [isMobile, setIsMobile] = useState(false)
  const [height, setHeight] = useState(1000)
  
  useEffect(() => {
    const checkSize = () => {
      setIsMobile(window.innerWidth < 768)
      setHeight(document.body.scrollHeight)
    }
    checkSize()
    window.addEventListener('resize', checkSize)
    return () => window.removeEventListener('resize', checkSize)
  }, [])

  // To prevent circle stretching, we don't use preserveAspectRatio="none".
  // Instead, we build the path to match the exact document height!
  // Height is usually ~4000-5000px.
  // The path starts top-left and steps down and right.
  const buildPath = (h: number) => {
    if (isMobile) return `M60,0 L60,${h}`
    // scale the Y coordinates based on total height
    const y = (pct: number) => (h * pct).toFixed(0)
    return `M20,0 L20,${y(0.24)} L45,${y(0.24)} L45,${y(0.44)} L70,${y(0.44)} L70,${y(0.64)} L95,${y(0.64)} L95,${y(0.86)} L60,${y(0.86)} L60,${h}`
  }
  
  const pathD = buildPath(height)
  const cometDistance = useTransform(progress, v => `${v * 100}%`)
  
  const nodes = [
    { t: 0.08, x: isMobile ? 60 : 20 },
    { t: 0.32, x: isMobile ? 60 : 45 },
    { t: 0.55, x: isMobile ? 60 : 70 },
    { t: 0.78, x: isMobile ? 60 : 95 },
    { t: 0.96, x: isMobile ? 60 : 60 },
  ]

  return (
    <div 
      style={{
        position: 'absolute',
        top: 0,
        left: isMobile ? '20px' : '40px',
        width: '120px',
        height: '100%',
        zIndex: 5,
        pointerEvents: 'none'
      }}
    >
      <svg 
        width="120" 
        height={height} 
        style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible' }}
      >
        <defs>
          <linearGradient id="signalGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="var(--bullish)" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Soft glow path (underneath) */}
        <motion.path
          d={pathD}
          fill="none"
          stroke="url(#signalGrad)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          style={{ pathLength: prefersReducedMotion ? 1 : progress, opacity: 0.4 }}
          filter="url(#glow)"
        />

        {/* Main sharp path */}
        <motion.path
          d={pathD}
          fill="none"
          stroke="url(#signalGrad)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          style={{ pathLength: prefersReducedMotion ? 1 : progress }}
        />
        
        {/* Comet dot riding the path */}
        {!prefersReducedMotion && (
          <motion.g style={{ offsetPath: `path("${pathD}")`, offsetDistance: cometDistance }}>
            {/* Halo pulse */}
            <motion.circle 
              r="10" 
              fill="var(--accent)" 
              opacity="0.25"
              animate={{ scale: [1, 1.6, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
            {/* Core dot */}
            <motion.circle r="4" fill="var(--accent)" />
          </motion.g>
        )}

        {/* Nodes */}
        {nodes.map((node, i) => {
          const threshold = node.t
          const scale = useTransform(progress, [threshold - 0.04, threshold], [0, 1])
          const opacity = useTransform(progress, [threshold - 0.04, threshold], [0, 1])
          const isTerminal = i === nodes.length - 1

          return (
            <motion.g 
              key={i} 
              transform={`translate(${node.x}, ${height * node.t})`}
              style={prefersReducedMotion ? undefined : { scale, opacity }}
            >
              {isTerminal && !prefersReducedMotion && (
                <motion.circle 
                  r="12" 
                  fill="var(--bullish)" 
                  opacity="0.2"
                  animate={{ scale: [1, 1.5, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />
              )}
              <motion.circle 
                r="6" 
                fill="var(--surface-elevated)" 
                stroke={isTerminal ? "var(--bullish)" : "var(--accent)"} 
                strokeWidth="2" 
              />
            </motion.g>
          )
        })}
      </svg>
    </div>
  )
}
