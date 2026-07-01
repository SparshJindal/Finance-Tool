'use client'

import { motion } from 'framer-motion'

const features = [
  {
    icon: "🎯",
    title: "Thesis-first verdicts",
    body: "Every holding gets one badge: Supports, Threatens, Mixed, or Quiet — judged against your conviction, not generic sentiment."
  },
  {
    icon: "🔍",
    title: "Grounded summaries",
    body: "No hallucinations. Each finding leads with a verbatim quote or hard number pulled straight from the source."
  },
  {
    icon: "🧬",
    title: "Event de-duplication",
    body: "The same story from ten outlets collapses into one finding with its sources attached — no repetitive feed."
  },
  {
    icon: "📊",
    title: "Severity you can trust",
    body: "An anchored 1–5 rubric reserves the top scores for confirmed, quantified events. Rumor and analyst chatter stay low."
  },
  {
    icon: "📬",
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
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-15% 0px' }}
        style={{ paddingLeft: 'clamp(20px, 8vw, 140px)', marginBottom: '60px' }}
      >
        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.875rem' }}>
          WHAT MAKES IT DIFFERENT
        </span>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.25rem', color: 'var(--text-primary)', margin: 'var(--sp-2) 0 0 0', fontWeight: 600 }}>
          Built to earn your trust, not your attention.
        </h2>
      </motion.div>

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
          <motion.div 
            key={i} 
            variants={itemVariants}
            className="card card-lift"
            whileHover="hover"
            style={{ 
              padding: 'var(--sp-5)', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: 'var(--sp-3)',
              willChange: 'transform'
            }}
          >
            <motion.div 
              style={{ fontSize: '1.5rem', display: 'inline-block' }}
              variants={{ hover: { scale: 1.15 } }}
              transition={{ type: 'spring', stiffness: 400, damping: 10 }}
            >
              {f.icon}
            </motion.div>
            <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.25rem', color: 'var(--text-primary)', margin: 0, fontWeight: 600 }}>
              {f.title}
            </h3>
            <p style={{ fontFamily: 'var(--font-ui)', color: 'var(--text-secondary)', fontSize: '0.9375rem', lineHeight: 1.5, margin: 0 }}>
              {f.body}
            </p>
          </motion.div>
        ))}
      </motion.div>
    </section>
  )
}
