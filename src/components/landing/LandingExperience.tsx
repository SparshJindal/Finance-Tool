'use client'

import { useRef } from 'react'
import { useScroll } from 'framer-motion'
import { ScrollProgressBar } from './ScrollProgressBar'
import { SignalLine } from './SignalLine'
import { HeroSection } from './HeroSection'
import { HowItWorksSection } from './HowItWorksSection'
import { FeaturesSection } from './FeaturesSection'
import { LiveVerdictDemo } from './LiveVerdictDemo'
import { FinalCtaSection } from './FinalCtaSection'
import { PolygonMesh } from '@/components/PolygonMesh'

export function LandingExperience() {
  const containerRef = useRef<HTMLDivElement>(null)
  
  const { scrollYProgress } = useScroll({ 
    target: containerRef, 
    offset: ['start start', 'end end'] 
  })

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', backgroundColor: 'var(--surface)', overflow: 'hidden' }}>
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <PolygonMesh />
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at center, transparent 0%, var(--surface) 100%)',
          pointerEvents: 'none'
        }} />
      </div>

      <ScrollProgressBar progress={scrollYProgress} />
      <SignalLine progress={scrollYProgress} />
      
      <HeroSection />
      <HowItWorksSection />
      <FeaturesSection />
      <LiveVerdictDemo />
      <FinalCtaSection />
    </div>
  )
}
