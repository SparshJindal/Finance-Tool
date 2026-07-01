'use client'

import { motion, useReducedMotion } from 'framer-motion'
import Link from 'next/link'
import { useState } from 'react'

export function FinalCtaSection() {
  const prefersReducedMotion = useReducedMotion()
  const [btnOffset, setBtnOffset] = useState({ x: 0, y: 0 })

  const handleMouseMove = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (prefersReducedMotion) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left - rect.width / 2
    const y = e.clientY - rect.top - rect.height / 2
    setBtnOffset({
      x: Math.max(-6, Math.min(6, x * 0.15)),
      y: Math.max(-6, Math.min(6, y * 0.15))
    })
  }

  const handleMouseLeave = () => setBtnOffset({ x: 0, y: 0 })

  return (
    <section style={{ padding: '160px 20px 80px 20px', width: '100%', maxWidth: '1000px', margin: '0 auto', position: 'relative', zIndex: 10, textAlign: 'center' }}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-15% 0px' }}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
      >
        <h2 style={{ 
          fontFamily: "'Cormorant Garamond', Georgia, serif", 
          fontSize: 'clamp(2rem, 5vw, 3rem)', 
          fontWeight: 700, 
          fontStyle: 'italic',
          color: 'var(--text-primary)', 
          margin: '0 0 var(--sp-4) 0', 
          maxWidth: '720px', 
          lineHeight: 1.1,
          letterSpacing: '-0.02em'
        }}>
          See your portfolio through the lens of your own thesis.
        </h2>
        
        <p style={{ fontFamily: 'var(--font-ui)', color: 'var(--text-secondary)', fontSize: '1.125rem', maxWidth: '560px', lineHeight: 1.6, margin: '0 0 var(--sp-8) 0' }}>
          Set up your holdings in minutes. coranto watches the news so you don't have to.
        </p>

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
              Get started free →
            </motion.span>
          </Link>
        </motion.div>
      </motion.div>

      {/* Footer strip */}
      <div style={{ 
        marginTop: '120px', 
        paddingTop: 'var(--sp-6)', 
        borderTop: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.75rem',
        color: 'var(--text-muted)',
        flexWrap: 'wrap',
        gap: 'var(--sp-4)'
      }}>
        <span>coranto · Portfolio Disruption Radar</span>
        <Link href="/dashboard" style={{ color: 'inherit', textDecoration: 'none' }}>
          Dashboard
        </Link>
      </div>
    </section>
  )
}
