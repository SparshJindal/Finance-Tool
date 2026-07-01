'use client'

import { motion, useReducedMotion } from 'framer-motion'
import Link from 'next/link'
import { PolygonMesh } from '@/components/PolygonMesh'
import { CorantoLogo } from '@/components/CorantoLogo'
import { useState } from 'react'

import { ElementIlluminator } from './ElementIlluminator'

export function HeroSection() {
  const prefersReducedMotion = useReducedMotion()
  const [btnOffset, setBtnOffset] = useState({ x: 0, y: 0 })

  const handleMouseMove = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (prefersReducedMotion) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left - rect.width / 2
    const y = e.clientY - rect.top - rect.height / 2
    // Cap displacement at ±6px
    setBtnOffset({
      x: Math.max(-6, Math.min(6, x * 0.15)),
      y: Math.max(-6, Math.min(6, y * 0.15))
    })
  }

  const handleMouseLeave = () => setBtnOffset({ x: 0, y: 0 })

  const titleWords = "Financial intelligence\nwithout the noise.".split('\n')

  return (
    <section 
      style={{ 
        position: 'relative', 
        width: '100%', 
        height: '100vh', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: '0 20px',
        overflow: 'hidden',
        zIndex: 10
      }}
    >
      {/* Content */}
      <ElementIlluminator 
        id="hero" 
        order={0} 
        style={{ maxWidth: '760px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: 'var(--sp-4)' }}
      >
        <motion.div
          animate={prefersReducedMotion ? {} : { y: [0, -6, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          style={{ marginBottom: 'var(--sp-6)' }}
        >
          <CorantoLogo width={72} height={72} />
        </motion.div>

        <h1 style={{ 
          fontFamily: "'Cormorant Garamond', Georgia, serif", 
          fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', 
          fontWeight: 700, 
          fontStyle: 'italic',
          color: 'var(--text-primary)', 
          lineHeight: 1.1,
          letterSpacing: '-0.02em',
          margin: 0
        }}>
          {titleWords.map((line, i) => (
            <span key={i} style={{ display: 'block', overflow: 'hidden' }}>
              {line.split(' ').map((word, j) => (
                <motion.span
                  key={j}
                  style={{ display: 'inline-block', marginRight: '0.25em', filter: 'blur(0px)' }}
                  initial={{ opacity: 0, y: 24, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{ delay: (i * 3 + j) * 0.08, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                >
                  {word}
                </motion.span>
              ))}
            </span>
          ))}
        </h1>

        <motion.div 
          style={{ height: '1px', background: 'var(--accent)', marginTop: 'var(--sp-6)', marginBottom: 'var(--sp-6)' }}
          initial={{ width: 0 }}
          animate={{ width: '72px' }}
          transition={{ delay: 0.8, duration: 0.8, ease: "easeOut" }}
        />

        <motion.p
          style={{
            fontFamily: 'var(--font-ui)',
            color: 'var(--text-secondary)',
            fontSize: '1.125rem',
            maxWidth: '560px',
            lineHeight: 1.6,
            margin: '0 0 var(--sp-8) 0'
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.8 }}
        >
          coranto runs autonomous AI agents that watch your portfolio, read the day's news, and judge every headline against YOUR thesis — so you only see what actually moves your conviction.
        </motion.p>

        <motion.div 
          style={{ display: 'flex', gap: 'var(--sp-4)', flexWrap: 'wrap', justifyContent: 'center' }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 0.6 }}
        >
          <motion.div
            animate={{ x: btnOffset.x, y: btnOffset.y }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            style={{ display: 'inline-block' }}
          >
            <Link 
              href="/dashboard" 
              className="btn btn-primary"
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '48px',
                padding: '0 var(--sp-8)',
                background: 'linear-gradient(135deg, var(--accent), #8A6D46)',
                color: '#FFFFFF',
                border: 'none',
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontSize: 'var(--text-md)',
                fontWeight: 700,
                borderRadius: 'var(--radius-sm)',
                textDecoration: 'none',
                letterSpacing: '0.02em',
                boxShadow: '0 4px 14px rgba(160, 132, 92, 0.4)'
              }}
            >
              <motion.span
                whileHover={prefersReducedMotion ? {} : { scale: 1.03 }}
                whileTap={prefersReducedMotion ? {} : { scale: 0.98 }}
                style={{ display: 'inline-block' }}
              >
                Launch the dashboard →
              </motion.span>
            </Link>
          </motion.div>

          <a href="#how-it-works" className="btn btn-secondary" style={{ fontSize: '1rem', padding: '0.75rem 1.5rem' }}>
            See how it works
          </a>
        </motion.div>
      </ElementIlluminator>

      {/* Scroll Cue */}
      <motion.div
        style={{
          position: 'absolute',
          bottom: 'var(--sp-8)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--sp-2)'
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.8, duration: 1 }}
      >
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
          SCROLL
        </span>
        <motion.div
          animate={prefersReducedMotion ? {} : { y: [0, 8, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </motion.div>
      </motion.div>
    </section>
  )
}
