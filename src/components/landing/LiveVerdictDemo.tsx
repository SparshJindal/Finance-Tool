'use client'

import { motion, useReducedMotion } from 'framer-motion'

import { ElementIlluminator } from './ElementIlluminator'

export function LiveVerdictDemo() {
  const prefersReducedMotion = useReducedMotion()

  const sparklinePath = "M0,50 L50,45 L100,55 L150,40 L200,45 L250,20 L300,25 L350,10 L400,15 L450,0 L500,5"

  return (
    <section style={{ padding: '120px 20px', width: '100%', maxWidth: '1000px', margin: '0 auto', position: 'relative', zIndex: 10 }}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-15% 0px' }}
        style={{ paddingLeft: 'clamp(20px, 8vw, 140px)', marginBottom: '60px' }}
      >
        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.875rem' }}>
          A LIVE VERDICT
        </span>
        <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '2.25rem', color: 'var(--text-primary)', margin: 'var(--sp-2) 0 0 0', fontWeight: 700 }}>
          This is what a holding looks like after coranto reads the news.
        </h2>
      </motion.div>

      <div style={{ paddingLeft: 'clamp(20px, 8vw, 140px)', display: 'flex', justifyContent: 'flex-start' }}>
        <ElementIlluminator id="demo-card" order={6} style={{ width: '100%', maxWidth: '560px', borderRadius: 'var(--radius-lg)' }}>
          <motion.div 
            className="card" 
            style={{ padding: 'var(--sp-5)', position: 'relative', overflow: 'hidden' }}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-15% 0px' }}
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.12 } }
            }}
          >
            {/* Header row */}
            <motion.div 
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', flexWrap: 'wrap', marginBottom: 'var(--sp-4)' }}
              variants={prefersReducedMotion ? {} : { hidden: { opacity: 0, x: -16 }, visible: { opacity: 1, x: 0 } }}
              initial={prefersReducedMotion ? { opacity: 1, x: 0 } : undefined}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                AVGO
              </span>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                Broadcom
              </span>
              <span
                className="label"
                style={{
                  background: 'var(--bullish-dim)',
                  color: 'var(--bullish)',
                  border: '1px solid var(--bullish-border)',
                  marginLeft: 'auto'
                }}
              >
                LONG
              </span>
            </motion.div>

            {/* Verdict Badge */}
            <motion.div 
              style={{ marginBottom: 'var(--sp-4)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <motion.span
                className="label"
                style={{
                  background: 'var(--bullish-dim)',
                  color: 'var(--bullish)',
                  border: '1px solid var(--bullish-border)',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  padding: '4px 8px'
                }}
                variants={prefersReducedMotion ? {} : { hidden: { opacity: 0, scale: 0.8 }, visible: { opacity: 1, scale: 1, transition: { type: 'spring', damping: 15 } } }}
                initial={prefersReducedMotion ? { opacity: 1, scale: 1 } : undefined}
              >
                🟢 Supports your thesis
              </motion.span>
              
              {/* Severity Meter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Max Sev
                </span>
                <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', height: '12px' }}>
                  {[1, 2, 3, 4, 5].map((i) => {
                    let color = 'var(--surface-overlay)'
                    if (i <= 3) color = 'var(--accent)'
                    if (i === 4) color = 'var(--sev-4)'
                    if (i === 5) color = 'var(--bearish)'
                    
                    const isLit = i <= 4
                    
                    return (
                      <motion.div 
                        key={i}
                        style={{ 
                          width: '4px', 
                          height: `${12 + i * 2}px`, 
                          backgroundColor: isLit ? color : 'var(--surface-overlay)',
                          borderRadius: '1px',
                          transformOrigin: 'bottom'
                        }}
                        variants={prefersReducedMotion ? {} : { 
                          hidden: { scaleY: 0 }, 
                          visible: { scaleY: 1, transition: { type: 'spring', damping: 20 } } 
                        }}
                        initial={prefersReducedMotion ? { scaleY: 1 } : undefined}
                      />
                    )
                  })}
                </div>
              </div>
            </motion.div>

            {/* Caption */}
            <motion.p
              style={{ fontSize: '1rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 var(--sp-6) 0' }}
              variants={prefersReducedMotion ? {} : { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}
              initial={prefersReducedMotion ? { opacity: 1, y: 0 } : undefined}
            >
              OpenAI's new custom AI chip, built with Broadcom, expands data-center demand — supports your long thesis.
            </motion.p>

            {/* Sparkline */}
            <div style={{ width: '100%', height: '60px', position: 'relative' }}>
              <svg width="100%" height="100%" viewBox="0 0 500 60" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
                <defs>
                  <linearGradient id="sparkGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="var(--bullish)" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="var(--bullish)" stopOpacity="1" />
                  </linearGradient>
                </defs>
                <motion.path
                  d={sparklinePath}
                  fill="none"
                  stroke="url(#sparkGrad)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  variants={prefersReducedMotion ? {} : { hidden: { pathLength: 0 }, visible: { pathLength: 1, transition: { duration: 1.5, ease: 'easeOut' } } }}
                  initial={prefersReducedMotion ? { pathLength: 1 } : undefined}
                  vectorEffect="non-scaling-stroke"
                />
                {!prefersReducedMotion && (
                  <motion.circle 
                    r="4" 
                    fill="var(--bullish)" 
                    variants={{
                      hidden: { opacity: 0 },
                      visible: { opacity: 1, transition: { delay: 1.4 } }
                    }}
                    style={{ offsetPath: `path("${sparklinePath}")`, offsetDistance: "100%" }}
                  />
                )}
              </svg>
            </div>
          </motion.div>
        </ElementIlluminator>
      </div>
    </section>
  )
}
