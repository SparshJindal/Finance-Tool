'use client'

import { useRef } from 'react'
import { useScroll, useSpring } from 'framer-motion'
import { ScrollProgressBar } from './ScrollProgressBar'
import { SignalLine } from './SignalLine'
import { HeroSection } from './HeroSection'
import { HowItWorksSection } from './HowItWorksSection'
import { FeaturesSection } from './FeaturesSection'
import { LiveVerdictDemo } from './LiveVerdictDemo'
import { FinalCtaSection } from './FinalCtaSection'

export function LandingExperience() {
  const containerRef = useRef<HTMLDivElement>(null)
  
  const { scrollYProgress } = useScroll({ 
    target: containerRef, 
    offset: ['start start', 'end end'] 
  })
  
  const smoothProgress = useSpring(scrollYProgress, { 
    stiffness: 90, 
    damping: 30, 
    restDelta: 0.001 
  })

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', backgroundColor: 'var(--surface)', overflow: 'hidden' }}>
      <ScrollProgressBar progress={smoothProgress} />
      <SignalLine progress={smoothProgress} />
      
      <HeroSection />
      <HowItWorksSection />
      <FeaturesSection />
      <LiveVerdictDemo />
      <FinalCtaSection />
    </div>
  )
}
