import { LandingExperience } from '@/components/landing/LandingExperience'

export const metadata = {
  title: 'coranto · Portfolio Disruption Radar',
  description: 'Financial intelligence without the noise. coranto runs autonomous AI agents that watch your portfolio and judge every headline against your thesis.',
}

export default function Page() {
  return (
    <main>
      <LandingExperience />
    </main>
  )
}
