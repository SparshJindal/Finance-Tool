import { prisma } from '@/lib/db'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { HoldingVerdictCard } from '@/components/portfolio/HoldingVerdictCard'
import { buildHoldingVerdicts } from '@/lib/verdict'

export const dynamic = 'force-dynamic'

export default async function IntelFeedPage({ searchParams }: { searchParams: Promise<{ holding?: string }> }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  const userId = session.user.id
  
  const resolvedParams = await searchParams;
  const activeHolding = resolvedParams?.holding || null

  const holdings = await prisma.holding.findMany({
    where: { userId },
    include: {
      questions: { select: { id: true } },
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
    additionalSources: f.additionalSources,
  }))

  const holdingVerdicts = buildHoldingVerdicts(
    holdings.map(h => ({
      id: h.id,
      ticker: h.ticker,
      company: h.company,
      directionLogic: h.directionLogic,
      thesis: h.thesis || '',
      verdictCaption: h.verdictCaption,
      earningsEvents: [],
    })),
    findings
  )

  let filteredVerdicts = holdingVerdicts
  if (activeHolding) {
    filteredVerdicts = holdingVerdicts.filter(v => v.holdingId === activeHolding)
  }

  const movers = filteredVerdicts.filter(v => !v.isQuiet)
  const quiet = filteredVerdicts.filter(v => v.isQuiet)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>
          Intelligence Feed
        </h2>
      </div>
      
      {movers.length > 0 ? (
        movers.map(v => (
          <HoldingVerdictCard key={v.holdingId} verdict={v} defaultExpanded={v.holdingId === activeHolding} />
        ))
      ) : (
        <div style={{ padding: 'var(--sp-6)', color: 'var(--text-muted)', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)' }}>
          No active intelligence or material findings.
        </div>
      )}

      {quiet.length > 0 && (
        <div style={{ marginTop: 'var(--sp-8)' }}>
          <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 'var(--sp-4)' }}>
            Quiet Holdings ({quiet.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
            {quiet.map(v => (
              <HoldingVerdictCard key={v.holdingId} verdict={v} defaultExpanded={v.holdingId === activeHolding} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
