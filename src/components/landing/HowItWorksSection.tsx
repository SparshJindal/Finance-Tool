'use client'

import { motion } from 'framer-motion'

import { ElementIlluminator } from './ElementIlluminator'

const steps = [
  {
    num: "01",
    title: "Track your holdings",
    body: "Add each position with the thesis behind it — long or short. coranto learns what you actually believe, not just what you own."
  },
  {
    num: "02",
    title: "Sweep the news",
    body: "Every cycle it pulls fresh, catalyst-focused coverage across US and Indian markets from quality-tiered sources — filtering out content farms and noise."
  },
  {
    num: "03",
    title: "Judge against your thesis",
    body: "An LLM reads each story and rules whether it SUPPORTS or THREATENS your specific thesis, grounded in a verbatim quote — never a vague buy/sell call."
  },
  {
    num: "04",
    title: "Deliver the verdict",
    body: "Findings are deduplicated by event, scored 1–5 for severity, and rolled up into one clear per-holding verdict, pushed to your dashboard and daily brief."
  }
]

export function HowItWorksSection() {
  return (
    <section id="how-it-works" style={{ padding: '120px 20px', width: '100%', maxWidth: '1000px', margin: '0 auto', position: 'relative', zIndex: 10 }}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-15% 0px' }}
        style={{ paddingLeft: 'clamp(20px, 8vw, 140px)', marginBottom: '80px' }}
      >
        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.875rem' }}>
          HOW IT WORKS
        </span>
        <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '2.25rem', color: 'var(--text-primary)', margin: 'var(--sp-2) 0 0 0', fontWeight: 700 }}>
          From market noise to a verdict on your thesis.
        </h2>
      </motion.div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '120px', paddingLeft: 'clamp(20px, 8vw, 140px)' }}>
        {steps.map((step, i) => {
          // Highlight special words in step 3
          let bodyNode: React.ReactNode = step.body
          if (step.num === "03") {
            const parts = step.body.split(/(SUPPORTS|THREATENS)/g)
            bodyNode = parts.map((part, j) => {
              if (part === "SUPPORTS") {
                return <span key={j} style={{ color: 'var(--bullish)', fontFamily: 'var(--font-mono)', fontVariant: 'small-caps', fontWeight: 600 }}>SUPPORTS</span>
              }
              if (part === "THREATENS") {
                return <span key={j} style={{ color: 'var(--bearish)', fontFamily: 'var(--font-mono)', fontVariant: 'small-caps', fontWeight: 600 }}>THREATENS</span>
              }
              return part
            })
          }

          return (
            <ElementIlluminator key={step.num} id={`step-${i}`} order={i + 1} waypointType="step" style={{ padding: 'var(--sp-4)', borderRadius: 'var(--radius-lg)' }}>
              <motion.div 
                initial={{ opacity: 0, x: -32 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-20% 0px' }}
                transition={{ type: "spring", stiffness: 120, damping: 20 }}
                style={{ display: 'flex', gap: 'var(--sp-6)', alignItems: 'flex-start' }}
              >
                <div style={{ 
                  fontFamily: "'Cormorant Garamond', Georgia, serif", 
                  fontSize: '3rem', 
                  color: 'var(--accent)', 
                  opacity: 0.5,
                  lineHeight: 1,
                  fontWeight: 700,
                  marginTop: '-0.2em'
                }}>
                  {step.num}
                </div>
                <div>
                  <h3 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.4rem', color: 'var(--text-primary)', margin: '0 0 var(--sp-2) 0', fontWeight: 700 }}>
                    {step.title}
                  </h3>
                  <p style={{ fontFamily: 'var(--font-ui)', color: 'var(--text-secondary)', maxWidth: '520px', lineHeight: 1.6, margin: 0 }}>
                    {bodyNode}
                  </p>
                </div>
              </motion.div>
            </ElementIlluminator>
          )
        })}
      </div>
    </section>
  )
}
