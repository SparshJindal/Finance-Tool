import { prisma } from '@/lib/db'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import {
  addHolding,
  updateHolding,
  deleteHolding,
  deleteAllHoldings,
  studyAllHoldings,
  studyHolding,
  studyBatchHoldings,
  triggerNewsIngestionPhase1,
  triggerNewsIngestionPhase2,
  triggerSendDigest,
  logOut,
  updateProfile,
} from '@/app/actions'
import { PushManager } from '@/components/PushManager'
import { PipelineControls } from '@/components/PipelineControls'
import { DashboardShell } from '@/components/DashboardShell'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  const userId = session.user.id

  let userProfile = {
    name: session.user.name || 'Investor',
    email: session.user.email || 'investor@coranto.ai',
    firstName: null as string | null,
    lastName: null as string | null,
    phone: null as string | null,
    nationality: null as string | null,
    image: session.user.image || null,
  }

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, name: true, email: true, phone: true, nationality: true, image: true }
    })
    
    if (dbUser) {
      userProfile = {
        name: dbUser.name || userProfile.name,
        email: dbUser.email || userProfile.email,
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
        phone: dbUser.phone,
        nationality: dbUser.nationality,
        image: dbUser.image || userProfile.image,
      }
    }

    const holdings = await prisma.holding.findMany({
      where: { userId },
      include: {
        questions: {
          select: { id: true }
        }
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
    include: {
      article: true,
      holding: true,
      question: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
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
    direction: f.direction as 'BULLISH' | 'BEARISH' | 'NEUTRAL' | null,
    confidence: f.confidence,
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
      
      <PipelineControls 
        holdings={holdings}
        runIngestPhase1={triggerNewsIngestionPhase1 as unknown as () => Promise<any>}
        runIngestPhase2={triggerNewsIngestionPhase2 as unknown as (fd: FormData) => Promise<any>}
        studyHoldingAction={studyHolding as unknown as (fd: FormData) => Promise<any>}
        studyBatchHoldingsAction={studyBatchHoldings as unknown as (fd: FormData) => Promise<any>}
        sendDigestAction={triggerSendDigest as unknown as (fd: FormData) => void}
        deleteAllHoldingsAction={deleteAllHoldings as unknown as (fd?: FormData) => Promise<{success?: boolean, error?: string}>}
        logOutAction={logOut as unknown as (fd: FormData) => void}
      />
    </div>
  )

  return (
    <DashboardShell
      userProfile={userProfile}
      holdings={holdings}
      findings={findings}
      tickerItems={tickerItems}
      lastScanAt={lastScanAt}
      totalThreats={totalThreats}
      maxPortfolioSeverity={maxPortfolioSeverity}
      addHoldingAction={addHolding as unknown as (fd: FormData) => void}
      updateHoldingAction={updateHolding as unknown as (fd: FormData) => void}
      deleteHoldingAction={deleteHolding as unknown as (fd: FormData) => void}
      updateProfileAction={updateProfile as unknown as (fd: FormData) => Promise<any>}
      controls={controls}
    />
  )
  } catch (error: any) {
    return (
      <div style={{ padding: '2rem', color: 'red', fontFamily: 'monospace' }}>
        <h2>Dashboard Crashed</h2>
        <p><strong>Error Message:</strong> {error?.message || String(error)}</p>
        <p><strong>Stack Trace:</strong> {error?.stack}</p>
      </div>
    )
  }
}
