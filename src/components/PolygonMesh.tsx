'use client'

import { useRef, useEffect, useCallback } from 'react'

interface Point {
  x: number
  y: number
  originX: number
  originY: number
  vx: number
  vy: number
}

export function PolygonMesh({
  density = 1,
  distortion = 1,
  fadeMode = 'radial',
  intensity = 0.5
}: {
  density?: number
  distortion?: number
  fadeMode?: 'radial' | 'right-to-left' | 'full' | 'edges'
  intensity?: number
} = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointsRef = useRef<Point[]>([])
  const trisRef = useRef<[number, number, number][]>([])
  const mouseRef = useRef({ x: -9999, y: -9999 })
  const rafRef = useRef<number>(0)
  const sizeRef = useRef({ w: 0, h: 0 })

  const MOUSE_RADIUS = 140
  const SPRING = 0.03
  const DAMPING = 0.85
  const MOUSE_FORCE = 18 * distortion

  const buildGrid = useCallback((w: number, h: number) => {
    const spacingX = 80 / density
    const spacingY = spacingX * (Math.sqrt(3) / 2)
    const cols = Math.ceil(w / spacingX) + 2
    const rows = Math.ceil(h / spacingY) + 2

    const points: Point[] = []
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const offsetX = row % 2 === 1 ? spacingX * 0.5 : 0
        const x = col * spacingX + offsetX - spacingX // Pad left to hide edges
        const y = row * spacingY - spacingY // Pad top to hide edges
        points.push({ x, y, originX: x, originY: y, vx: 0, vy: 0 })
      }
    }

    const tris: [number, number, number][] = []
    for (let row = 0; row < rows - 1; row++) {
      for (let col = 0; col < cols - 1; col++) {
        const i = row * cols + col
        const iRight = i + 1
        const iBelow = (row + 1) * cols + col
        const iBelowRight = iBelow + 1

        if (row % 2 === 0) {
          tris.push([i, iRight, iBelow])
          tris.push([iRight, iBelowRight, iBelow])
        } else {
          tris.push([i, iRight, iBelowRight])
          tris.push([i, iBelowRight, iBelow])
        }
      }
    }

    pointsRef.current = points
    trisRef.current = tris
  }, [density])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.parentElement!.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      sizeRef.current = { w: rect.width, h: rect.height }
      buildGrid(rect.width, rect.height)
    }

    resize()
    window.addEventListener('resize', resize)

    window.addEventListener('resize', resize)

    const animate = () => {
      const { w, h } = sizeRef.current
      const points = pointsRef.current
      const mouse = mouseRef.current
      const cx = w / 2
      const cy = h / 2
      const maxDist = Math.sqrt(cx * cx + cy * cy)

      const time = performance.now() * 0.0015

      // Physics update
      for (const p of points) {
        // Mouse repulsion
        const dx = p.x - mouse.x
        const dy = p.y - mouse.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < MOUSE_RADIUS && dist > 0) {
          const force = (1 - dist / MOUSE_RADIUS) * MOUSE_FORCE
          p.vx += (dx / dist) * force
          p.vy += (dy / dist) * force
        }

        // Passive ripple effect based on distance from center
        const distFromCenter = Math.sqrt((p.originX - cx) ** 2 + (p.originY - cy) ** 2)
        const ripplePhase = time - distFromCenter * 0.012
        const targetX = p.originX + Math.sin(ripplePhase) * 6
        const targetY = p.originY + Math.cos(ripplePhase * 1.1) * 6

        // Spring back to rippled origin
        p.vx += (targetX - p.x) * SPRING
        p.vy += (targetY - p.y) * SPRING

        // Damping
        p.vx *= DAMPING
        p.vy *= DAMPING

        // Integrate
        p.x += p.vx
        p.y += p.vy
      }

      // Draw
      ctx.clearRect(0, 0, w, h)

      const triangles = trisRef.current
      for (let ti = 0; ti < triangles.length; ti++) {
        const [a, b, c] = triangles[ti]
        const pa = points[a]
        const pb = points[b]
        const pc = points[c]
        if (!pa || !pb || !pc) continue

        // Triangle centroid for opacity calculation
        const centroidX = (pa.x + pb.x + pc.x) / 3
        const centroidY = (pa.y + pb.y + pc.y) / 3

        let opacity = 1
        if (fadeMode === 'radial') {
          const distFromCenter = Math.sqrt((cx - centroidX) ** 2 + (cy - centroidY) ** 2)
          opacity = Math.max(0, 1 - (distFromCenter / maxDist) * 1.3)
        } else if (fadeMode === 'right-to-left') {
          const fadeStart = w
          const fadeEnd = 0
          opacity = Math.max(0, Math.min(1, (centroidX - fadeEnd) / (fadeStart - fadeEnd)))
        } else if (fadeMode === 'full') {
          opacity = 1
        } else if (fadeMode === 'edges') {
          // Fade out entirely in the center, max opacity at left and right edges
          opacity = Math.max(0, Math.min(1, Math.abs(cx - centroidX) / (cx * 0.8)))
        }

        if (opacity <= 0) continue

        // Alternate fill color: every 5th triangle gets a warm amber tint
        const isAmber = ti % 5 === 0

        const fillR = isAmber ? 160 : 255
        const fillG = isAmber ? 132 : 255
        const fillB = isAmber ? 92 : 255

        // Fill triangle
        ctx.beginPath()
        ctx.moveTo(pa.x, pa.y)
        ctx.lineTo(pb.x, pb.y)
        ctx.lineTo(pc.x, pc.y)
        ctx.closePath()
        ctx.fillStyle = `rgba(${fillR}, ${fillG}, ${fillB}, ${opacity * (isAmber ? 0.08 : 0.03) * intensity})`
        ctx.fill()

        // Stroke edges (the "strings")
        ctx.strokeStyle = `rgba(160, 132, 92, ${opacity * 0.15 * intensity})`
        ctx.lineWidth = 0.5
        ctx.stroke()
      }

      // Draw vertices as subtle dots
      for (const p of points) {
        const distFromCenter = Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2)
        let opacity = 1
        if (fadeMode === 'radial') {
           opacity = Math.max(0, 1 - (distFromCenter / maxDist) * 1.3)
        } else if (fadeMode === 'right-to-left') {
           opacity = Math.max(0, Math.min(1, (p.x - 0) / (w - 0)))
        } else if (fadeMode === 'full') {
           opacity = 1
        } else if (fadeMode === 'edges') {
           opacity = Math.max(0, Math.min(1, Math.abs(cx - p.x) / (cx * 0.8)))
        }
        
        if (opacity <= 0) continue

        ctx.beginPath()
        ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(160, 132, 92, ${opacity * 0.4 * intensity})`
        ctx.fill()
      }

      rafRef.current = requestAnimationFrame(animate)
    }

    rafRef.current = requestAnimationFrame(animate)

    const handleMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }

    const handleLeave = () => {
      mouseRef.current = { x: -9999, y: -9999 }
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseleave', handleLeave)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseleave', handleLeave)
    }
  }, [buildGrid])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'auto',
        zIndex: 0,
      }}
    />
  )
}
