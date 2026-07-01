'use client'

import React, { useLayoutEffect, useState, useRef, useEffect } from 'react'
import { motion, MotionValue, useTransform, useReducedMotion } from 'framer-motion'
import { useLandingScroll } from './LandingScrollContext'

function buildCatmullRomPath(points: {x: number, y: number}[], tension = 0.5) {
  if (points.length === 0) return "M0,0"
  if (points.length === 1) return `M${points[0].x},${points[0].y}`
  
  let d = `M${points[0].x},${points[0].y} `
  
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i > 0 ? points[i - 1] : points[0]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = i < points.length - 2 ? points[i + 2] : p2

    const cp1x = p1.x + (p2.x - p0.x) * tension / 6
    const cp1y = p1.y + (p2.y - p0.y) * tension / 6
    const cp2x = p2.x - (p3.x - p1.x) * tension / 6
    const cp2y = p2.y - (p3.y - p1.y) * tension / 6

    d += `C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y} `
  }
  return d
}

export function SignalLine({ progress, containerRef }: { progress: MotionValue<number>, containerRef: React.RefObject<HTMLDivElement | null> }) {
  const prefersReducedMotion = useReducedMotion()
  const { elements, setElementFractions } = useLandingScroll()
  
  const [pathD, setPathD] = useState("M0,0")
  const [cometPoints, setCometPoints] = useState<{x: number, y: number}[]>([])
  const [firstFrac, setFirstFrac] = useState(0)
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
        let x = rect.left - containerRect.left + rect.width / 2
        let y = rect.top - containerRect.top + rect.height / 2
        
        if (item.waypointType === 'step') {
            x = (rect.left - containerRect.left) + 56
        } else if (item.waypointType === 'feature-heading') {
            points.push({
                x: (rect.left - containerRect.left) + 22,
                y: (rect.top - containerRect.top) + 8
            })
            x = (rect.left - containerRect.left) + 22
            y = (rect.bottom - containerRect.top) - 8
        } else if (item.waypointType === 'feature-left') {
            x = (rect.right - containerRect.left) - 40
        } else if (item.waypointType === 'feature-right') {
            x = (rect.left - containerRect.left) + 40
        } else if (item.waypointType === 'demo') {
            x = rect.left - containerRect.left + rect.width / 2
            y = (rect.top - containerRect.top) + 60
        } else if (item.waypointType === 'cta') {
            // use center
        }

        if (isMobile) {
          x = Math.max(20, Math.min(x, 60))
        }
        
        x = Math.max(16, Math.min(x, containerRect.width - 16))

        points.push({ x, y })
      }
    })

    points.push({ x: points.length > 0 ? points[points.length - 1].x : 40, y: containerRect.height })
    
    const newD = buildCatmullRomPath(points, 0.5)
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

    // Calculate element fractions based on actual scroll position
    if (!containerRef.current) return
    
    const totalScrollableHeight = document.documentElement.scrollHeight
    const viewportHeight = window.innerHeight
    
    const sorted = Array.from(elements.values()).sort((a, b) => a.order - b.order)
    const fractions = new Map<string, number>()
    
    let earliestFrac = 1

    sorted.forEach((item) => {
      if (item.ref.current) {
        const rect = item.ref.current.getBoundingClientRect()
        const anchorCenterY = rect.top + window.scrollY + rect.height / 2
        let frac = (anchorCenterY - viewportHeight / 2) / (totalScrollableHeight - viewportHeight)
        frac = Math.max(0, Math.min(1, frac))
        
        fractions.set(item.id, frac)
        if (item.waypointType === 'step' && frac < earliestFrac) {
            earliestFrac = frac
        }
      }
    })

    setElementFractions(fractions)
    if (earliestFrac < 1) setFirstFrac(earliestFrac)
  }, [pathD, elements, containerRef, setElementFractions])

  const draw = useTransform(progress, [Math.max(0, firstFrac - 0.02), 1], [0, 1], { clamp: true })

  const cx = useTransform(draw, v => {
    if (cometPoints.length === 0) return 0
    return cometPoints[Math.round(v * (cometPoints.length - 1))]?.x ?? 0
  })
  const cy = useTransform(draw, v => {
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
            style={{ pathLength: prefersReducedMotion ? 1 : draw, opacity: 0.55 }}
          />

          {/* Mid glow */}
          <motion.path
            d={pathD}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="5"
            strokeLinejoin="round"
            strokeLinecap="round"
            style={{ pathLength: prefersReducedMotion ? 1 : draw, opacity: 0.85 }}
          />
          
          {/* Hot core */}
          <motion.path
            d={pathD}
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="2.25"
            strokeLinejoin="round"
            strokeLinecap="round"
            style={{ pathLength: prefersReducedMotion ? 1 : draw, opacity: 1 }}
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
