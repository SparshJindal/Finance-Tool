import { prisma } from '@/lib/db'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import {
  addHolding,
  studyAllHoldings,
  triggerNewsIngestion,
  triggerSendDigest,
  logOut,
} from '@/app/actions'
import { PushManager } from '@/components/PushManager'
import { DashboardShell } from '@/components/DashboardShell'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  const userId = session.user.id

  const holdings = await prisma.holding.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })

  const findingsRaw = await prisma.finding.findMany({
    where: { holding: { userId } },
    include: {
      article: true,
      holding: true,
      question: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  // Format findings for the client
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
  }))

  const tickerItems = findings
    .filter(f => f.severity >= 3)
    .slice(0, 10)
    .map(f => ({
      id: f.id,
      ticker: f.ticker,
      title: f.sourceTitle || f.summary.substring(0, 50) + '...',
      severity: f.severity,
    }))

  const totalThreats = findings.filter(f => f.severity >= 4).length
  const maxPortfolioSeverity = findings.length > 0 ? Math.max(...findings.map(f => f.severity)) : 1

  const lastScanAt = findingsRaw.length > 0 
    ? findingsRaw[0].article.publishedAt?.toISOString() || findingsRaw[0].createdAt.toISOString() 
    : null

  // Build the pipeline controls
  const controls = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      <PushManager vapidPublicKey={process.env.VAPID_PUBLIC_KEY || ''} />
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
        <form action={triggerNewsIngestion as unknown as (fd: FormData) => void}>
          <button type="submit" className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
            Run Ingest
          </button>
        </form>
        <form action={studyAllHoldings as unknown as (fd: FormData) => void}>
          <button type="submit" className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
            Study All
          </button>
        </form>
        <form action={triggerSendDigest as unknown as (fd: FormData) => void}>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
            Send Digest
          </button>
        </form>
        <form action={logOut as unknown as (fd: FormData) => void}>
          <button type="submit" className="btn" style={{ width: '100%', justifyContent: 'center', color: 'var(--text-secondary)', marginTop: 'var(--sp-4)' }}>
            Log Out
          </button>
        </form>
      </div>
    </div>
  )

  return (
    <DashboardShell
      holdings={holdings}
      findings={findings}
      tickerItems={tickerItems}
      lastScanAt={lastScanAt}
      totalThreats={totalThreats}
      maxPortfolioSeverity={maxPortfolioSeverity}
      addHoldingAction={addHolding as unknown as (fd: FormData) => void | Promise<void>}
      controls={controls}
    />
  )
}
