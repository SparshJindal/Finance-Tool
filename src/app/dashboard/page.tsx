import { prisma } from '@/lib/db'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { ThesisHealthPanel } from '@/components/portfolio/ThesisHealthPanel'
import { PulseFeedList } from '@/components/feed/PulseFeedList'
import { WeeklyFeed } from '@/components/feed/WeeklyFeed'
import { EarningsRadarList } from '@/components/ui/EarningsRadarList'
import { getWeeklyFeed } from '@/app/actions'
import { buildHoldingVerdicts } from '@/lib/verdict'

export const dynamic = 'force-dynamic'

export default async function PulsePage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  const userId = session.user.id

  const holdings = await prisma.holding.findMany({
    where: { userId },
    include: {
      earningsEvents: {
        orderBy: { reportDate: 'desc' },
        take: 5
      },
      falsifiers: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  const twoWeeksAgo = new Date()
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)

  const findingsRaw = await prisma.finding.findMany({
    where: { 
      holding: { userId },
      createdAt: { gte: twoWeeksAgo }
    },
    include: { article: true, holding: true, question: true },
    orderBy: { createdAt: 'desc' },
  })

  const findings = findingsRaw.map(f => ({
    id: f.id,
    holdingId: f.holdingId,
    ticker: f.holding.ticker,
    company: f.holding.company,
    severity: f.severity,
    summary: f.summary,
    sourceLink: f.article.url,
    sourceTitle: f.article.title,
    questionText: f.question?.text || null,
    feedback: f.feedback as 'up' | 'down' | null,
    direction: f.direction as 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'Supports' | 'Threatens' | 'Neutral' | null,
    confidence: f.confidence,
  }))

  const holdingVerdicts = buildHoldingVerdicts(
    holdings.map(h => ({
      id: h.id,
      ticker: h.ticker,
      company: h.company,
      directionLogic: h.directionLogic,
      thesis: h.thesis || '',
      verdictCaption: h.verdictCaption,
      earningsEvents: h.earningsEvents,
      falsifiers: h.falsifiers,
    })),
    findings
  )

  const weeklyFeedData = await getWeeklyFeed(userId)

  // Earnings Cards logic
  const earningsCardsData = []
  for (const h of holdings) {
    if (h.earningsEvents && h.earningsEvents.length > 0) {
      const e = h.earningsEvents[0]
      const rDate = new Date(e.reportDate)
      const isPast = rDate < new Date()
      const diffDays = Math.abs(Math.ceil((rDate.getTime() - new Date().getTime()) / (1000 * 3600 * 24)))
      const consensusEps = e.epsEstimate ? `$${e.epsEstimate.toFixed(2)}` : '--'
      const consensusRev = e.revenueEstimate ? `$${(e.revenueEstimate / 1e9).toFixed(2)}B` : '--'
      
      let relativeTime = ''
      if (diffDays === 0) relativeTime = 'Today'
      else if (isPast) relativeTime = `${diffDays} days ago`
      else relativeTime = `in ${diffDays} days`

      const dateStr = rDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const subtitle = `Reports ${relativeTime} · ${dateStr}`

      earningsCardsData.push({ holdingId: h.id, ticker: h.ticker, event: e, subtitle, consensusEps, consensusRev })
    }
  }

  const sortedHoldings = [...holdingVerdicts].sort((a, b) => {
    const scoreA = a.thesisHealth?.score ?? 100
    const scoreB = b.thesisHealth?.score ?? 100
    return scoreA - scoreB
  })

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 items-start">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
        <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--sp-4)', fontFamily: 'var(--font-ui)' }}>
          Portfolio Health Pulse
        </h2>
        
        {/* Render Thesis Health for all holdings */}
        <PulseFeedList holdings={sortedHoldings} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
        {weeklyFeedData && weeklyFeedData.length > 0 ? (
          <WeeklyFeed days={weeklyFeedData} />
        ) : (
          <div style={{ padding: 'var(--sp-6)', color: 'var(--text-muted)', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)' }}>
            No weekly feed data generated yet. The AI digests news every weekend.
          </div>
        )}
        
        {earningsCardsData.length > 0 && (
          <EarningsRadarList earningsCardsData={earningsCardsData} />
        )}
      </div>
    </div>
  )
}
