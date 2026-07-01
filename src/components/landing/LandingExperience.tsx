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
import { LandingScrollProvider } from './LandingScrollContext'

export function LandingExperience() {
  const containerRef = useRef<HTMLDivElement>(null)
  
  const { scrollYProgress } = useScroll({ 
    target: containerRef, 
    offset: ['start start', 'end end'] 
  })

  return (
    <LandingScrollProvider progress={scrollYProgress}>
      <div ref={containerRef} style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
        <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
          <PolygonMesh />
        </div>
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1,
          background: 'linear-gradient(180deg, rgba(250,250,250,0.55), rgba(250,250,250,0.75))',
          pointerEvents: 'none'
        }} />

        <ScrollProgressBar progress={scrollYProgress} />
        <SignalLine progress={scrollYProgress} containerRef={containerRef} />
        
        <HeroSection />
        <HowItWorksSection />
        <FeaturesSection />
        <LiveVerdictDemo />
        <FinalCtaSection />
      </div>
    </LandingScrollProvider>
  )
}
