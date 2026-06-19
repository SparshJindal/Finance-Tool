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

export function PolygonMesh() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointsRef = useRef<Point[]>([])
  const mouseRef = useRef({ x: -9999, y: -9999 })
  const rafRef = useRef<number>(0)
  const sizeRef = useRef({ w: 0, h: 0 })

  const COLS = 18
  const ROWS = 12
  const MOUSE_RADIUS = 140
  const SPRING = 0.03
  const DAMPING = 0.85
  const MOUSE_FORCE = 18

  const buildGrid = useCallback((w: number, h: number) => {
    const points: Point[] = []
    const spacingX = w / (COLS - 1)
    const spacingY = h / (ROWS - 1)

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        // Offset every other row for triangular tiling
        const offsetX = row % 2 === 1 ? spacingX * 0.5 : 0
        const x = col * spacingX + offsetX
        const y = row * spacingY
        points.push({ x, y, originX: x, originY: y, vx: 0, vy: 0 })
      }
    }
    return points
  }, [])

  const getTriangles = useCallback((): [number, number, number][] => {
    const tris: [number, number, number][] = []
    for (let row = 0; row < ROWS - 1; row++) {
      for (let col = 0; col < COLS - 1; col++) {
        const i = row * COLS + col
        const iRight = i + 1
        const iBelow = (row + 1) * COLS + col
        const iBelowRight = iBelow + 1

        if (row % 2 === 0) {
          // Even row: top-left triangle and bottom-right triangle
          tris.push([i, iRight, iBelow])
          tris.push([iRight, iBelowRight, iBelow])
        } else {
          // Odd row: different diagonal
          tris.push([i, iRight, iBelowRight])
          tris.push([i, iBelowRight, iBelow])
        }
      }
    }
    return tris
  }, [])

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
      pointsRef.current = buildGrid(rect.width, rect.height)
    }

    resize()
    window.addEventListener('resize', resize)

    const triangles = getTriangles()

    const animate = () => {
      const { w, h } = sizeRef.current
      const points = pointsRef.current
      const mouse = mouseRef.current
      const cx = w / 2
      const cy = h / 2
      const maxDist = Math.sqrt(cx * cx + cy * cy)

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

        // Spring back to origin
        p.vx += (p.originX - p.x) * SPRING
        p.vy += (p.originY - p.y) * SPRING

        // Damping
        p.vx *= DAMPING
        p.vy *= DAMPING

        // Integrate
        p.x += p.vx
        p.y += p.vy
      }

      // Draw
      ctx.clearRect(0, 0, w, h)

      for (const [a, b, c] of triangles) {
        const pa = points[a]
        const pb = points[b]
        const pc = points[c]
        if (!pa || !pb || !pc) continue

        // Triangle centroid for opacity calculation
        const centX = (pa.x + pb.x + pc.x) / 3
        const centY = (pa.y + pb.y + pc.y) / 3
        const distFromCenter = Math.sqrt((centX - cx) ** 2 + (centY - cy) ** 2)
        const opacity = Math.max(0, 1 - (distFromCenter / maxDist) * 1.3)

        // Fill triangle
        ctx.beginPath()
        ctx.moveTo(pa.x, pa.y)
        ctx.lineTo(pb.x, pb.y)
        ctx.lineTo(pc.x, pc.y)
        ctx.closePath()
        ctx.fillStyle = `rgba(78, 52, 46, ${opacity * 0.04})`
        ctx.fill()

        // Stroke edges (the "strings")
        ctx.strokeStyle = `rgba(78, 52, 46, ${opacity * 0.15})`
        ctx.lineWidth = 0.5
        ctx.stroke()
      }

      // Draw vertices as subtle dots
      for (const p of points) {
        const distFromCenter = Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2)
        const opacity = Math.max(0, 1 - (distFromCenter / maxDist) * 1.3)
        if (opacity <= 0) continue

        ctx.beginPath()
        ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(78, 52, 46, ${opacity * 0.3})`
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

    canvas.addEventListener('mousemove', handleMove)
    canvas.addEventListener('mouseleave', handleLeave)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
      canvas.removeEventListener('mousemove', handleMove)
      canvas.removeEventListener('mouseleave', handleLeave)
    }
  }, [buildGrid, getTriangles])

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
