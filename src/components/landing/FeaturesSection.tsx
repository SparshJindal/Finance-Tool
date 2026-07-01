'use client'

import { motion } from 'framer-motion'

import { ElementIlluminator } from './ElementIlluminator'

const IconTarget = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
const IconSearch = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
const IconFilter = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
const IconActivity = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
const IconMail = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>

const features = [
  {
    icon: <IconTarget />,
    title: "Thesis-first verdicts",
    body: "Every holding gets one badge: Supports, Threatens, Mixed, or Quiet — judged against your conviction, not generic sentiment."
  },
  {
    icon: <IconSearch />,
    title: "Grounded summaries",
    body: "No hallucinations. Each finding leads with a verbatim quote or hard number pulled straight from the source."
  },
  {
    icon: <IconFilter />,
    title: "Event de-duplication",
    body: "The same story from ten outlets collapses into one finding with its sources attached — no repetitive feed."
  },
  {
    icon: <IconActivity />,
    title: "Severity you can trust",
    body: "An anchored 1–5 rubric reserves the top scores for confirmed, quantified events. Rumor and analyst chatter stay low."
  },
  {
    icon: <IconMail />,
    title: "Daily brief + alerts",
    body: "A thesis-first digest by email and push — the portfolio headline, movers, then a quiet list — so you can skim in 30 seconds."
  }
]

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08 }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
}

export function FeaturesSection() {
  return (
    <section style={{ padding: '120px 20px', width: '100%', maxWidth: '1000px', margin: '0 auto', position: 'relative', zIndex: 10 }}>
      <ElementIlluminator id="features-heading" order={5} waypointType="feature-heading" style={{ display: 'inline-block', padding: 'var(--sp-4)', borderRadius: 'var(--radius-lg)', marginLeft: 'clamp(4px, 8vw, 124px)', marginBottom: '60px' }}>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-15% 0px' }}
        >
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.875rem' }}>
            WHAT MAKES IT DIFFERENT
          </span>
          <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '2.25rem', color: 'var(--text-primary)', margin: 'var(--sp-2) 0 0 0', fontWeight: 700 }}>
            Built to earn your trust, not your attention.
          </h2>
        </motion.div>
      </ElementIlluminator>

      <motion.div 
        className="features-grid"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-10% 0px' }}
        style={{ 
          paddingLeft: 'clamp(20px, 8vw, 140px)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '20px'
        }}
      >
        {features.map((f, i) => (
          <ElementIlluminator 
            key={i} 
            id={`feature-${i}`} 
            order={6 + i} 
            waypointType={i % 2 === 0 ? 'feature-left' : 'feature-right'}
            style={{ display: 'flex' }}
          >
            <motion.div 
              variants={itemVariants}
              className="card card-lift"
              whileHover="hover"
              style={{ 
                padding: 'var(--sp-5)', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: 'var(--sp-3)',
                willChange: 'transform',
                width: '100%'
              }}
            >
              <motion.div 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  width: '40px', 
                  height: '40px', 
                  borderRadius: 'var(--radius)', 
                  background: 'var(--surface-subtle)', 
                  color: 'var(--accent)',
                  border: '1px solid var(--border)'
                }}
                variants={{ hover: { scale: 1.1, rotate: [-2, 2, 0] } }}
                transition={{ type: 'spring', stiffness: 400, damping: 10 }}
              >
                {f.icon}
              </motion.div>
              <h3 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.25rem', color: 'var(--text-primary)', margin: 0, fontWeight: 700 }}>
                {f.title}
              </h3>
              <p style={{ fontFamily: 'var(--font-ui)', color: 'var(--text-secondary)', fontSize: '0.9375rem', lineHeight: 1.5, margin: 0 }}>
                {f.body}
              </p>
            </motion.div>
          </ElementIlluminator>
        ))}
      </motion.div>
    </section>
  )
}
