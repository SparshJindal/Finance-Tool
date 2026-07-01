'use client'

import React, { useLayoutEffect, useState, useRef, useEffect } from 'react'
import { motion, MotionValue, useTransform, useReducedMotion } from 'framer-motion'
import { useLandingScroll } from './LandingScrollContext'

function buildSmoothPath(points: {x: number, y: number}[]) {
  if (points.length === 0) return "M0,0"
  let d = `M${points[0].x},${points[0].y} `
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const c1x = prev.x
    const c1y = prev.y + (curr.y - prev.y) * 0.5
    const c2x = curr.x
    const c2y = curr.y - (curr.y - prev.y) * 0.5
    d += `C${c1x},${c1y} ${c2x},${c2y} ${curr.x},${curr.y} `
  }
  return d
}

export function SignalLine({ progress, containerRef }: { progress: MotionValue<number>, containerRef: React.RefObject<HTMLDivElement | null> }) {
  const prefersReducedMotion = useReducedMotion()
  const { elements, setElementFractions } = useLandingScroll()
  
  const [pathD, setPathD] = useState("M0,0")
  const [cometPoints, setCometPoints] = useState<{x: number, y: number}[]>([])
  const pathRef = useRef<SVGPathElement>(null)

  const recompute = () => {
    if (!containerRef.current) return
    const containerRect = containerRef.current.getBoundingClientRect()
    const isMobile = window.innerWidth <= 768
    
    // Convert map to array and sort by order
    const sorted = Array.from(elements.values()).sort((a, b) => a.order - b.order)
    
    const points: {x: number, y: number}[] = []
    
    // Start point at top
    points.push({ x: isMobile ? 20 : 40, y: 0 })

    sorted.forEach((item) => {
      if (item.ref.current) {
        const rect = item.ref.current.getBoundingClientRect()
        // Center relative to container
        const y = rect.top - containerRect.top + rect.height / 2
        // X center relative to container
        let x = rect.left - containerRect.left + rect.width / 2
        
        // On mobile, just make it a gentle wave or stick to the left if it's too chaotic
        if (isMobile) {
          x = Math.max(20, Math.min(x, 60))
        }
        
        points.push({ x, y })
      }
    })

    // End point at bottom
    points.push({ x: points.length > 0 ? points[points.length - 1].x : 40, y: containerRect.height })
    
    const newD = buildSmoothPath(points)
    setPathD(newD)
  }

  // Effect to recompute path when elements change or window resizes
  useEffect(() => {
    recompute()
    window.addEventListener('resize', recompute)
    if (document.fonts) {
      document.fonts.ready.then(recompute)
    }
    
    const container = containerRef.current
    if (!container) return
    const ro = new ResizeObserver(recompute)
    ro.observe(container)
    return () => {
      window.removeEventListener('resize', recompute)
      ro.disconnect()
    }
  }, [elements, containerRef])

  // Effect to sample points and calculate fractions after path changes
  useLayoutEffect(() => {
    if (!pathRef.current) return
    const len = pathRef.current.getTotalLength()
    if (len === 0) return

    // Sample comet points
    const samples = 240
    const pts: {x: number, y: number}[] = []
    for (let i = 0; i <= samples; i++) {
      const p = pathRef.current.getPointAtLength((i / samples) * len)
      pts.push({ x: p.x, y: p.y })
    }
    setCometPoints(pts)

    // Calculate element fractions
    if (!containerRef.current) return
    const containerRect = containerRef.current.getBoundingClientRect()
    const sorted = Array.from(elements.values()).sort((a, b) => a.order - b.order)
    const fractions = new Map<string, number>()

    sorted.forEach((item) => {
      if (item.ref.current) {
        const rect = item.ref.current.getBoundingClientRect()
        const targetY = rect.top - containerRect.top + rect.height / 2
        
        // Find approximate point along the path that matches this Y
        // Binary search or linear scan
        let closestFrac = 0
        let minDiff = Infinity
        for (let i = 0; i <= samples; i++) {
          const pt = pts[i]
          const diff = Math.abs(pt.y - targetY)
          if (diff < minDiff) {
            minDiff = diff
            closestFrac = i / samples
          }
        }
        fractions.set(item.id, closestFrac)
      }
    })

    setElementFractions(fractions)
  }, [pathD, elements, containerRef, setElementFractions])

  const cx = useTransform(progress, v => {
    if (cometPoints.length === 0) return 0
    return cometPoints[Math.round(v * (cometPoints.length - 1))]?.x ?? 0
  })
  const cy = useTransform(progress, v => {
    if (cometPoints.length === 0) return 0
    return cometPoints[Math.round(v * (cometPoints.length - 1))]?.y ?? 0
  })

  return (
    <div 
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 40,
        pointerEvents: 'none',
        willChange: 'transform',
        contain: 'paint'
      }}
    >
      <svg 
        width="100%" 
        height="100%" 
        style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible' }}
      >
        {/* We keep an invisible path to measure it reliably */}
        <path ref={pathRef} d={pathD} fill="none" stroke="none" />

        <motion.g style={{ filter: 'drop-shadow(0 0 6px rgba(160,132,92,0.65))' }}>
          {/* Glow halo */}
          <motion.path
            d={pathD}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="9"
            strokeLinejoin="round"
            strokeLinecap="round"
            style={{ pathLength: prefersReducedMotion ? 1 : progress, opacity: 0.55 }}
          />

          {/* Mid glow */}
          <motion.path
            d={pathD}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="5"
            strokeLinejoin="round"
            strokeLinecap="round"
            style={{ pathLength: prefersReducedMotion ? 1 : progress, opacity: 0.85 }}
          />
          
          {/* Hot core */}
          <motion.path
            d={pathD}
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="2.25"
            strokeLinejoin="round"
            strokeLinecap="round"
            style={{ pathLength: prefersReducedMotion ? 1 : progress, opacity: 1 }}
          />

          {/* Comet */}
          {!prefersReducedMotion && cometPoints.length > 0 && (
            <motion.g style={{ x: cx, y: cy }}>
              {/* Halo */}
              <motion.circle 
                r="9" 
                fill="var(--accent)" 
                opacity="0.3"
                animate={{ scale: [1, 1.5, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
              <circle r="4" fill="#FFFFFF" />
            </motion.g>
          )}
        </motion.g>
      </svg>
    </div>
  )
}
