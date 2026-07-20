import { prisma } from '@/lib/db'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { ManagePortfolioPanel } from '@/components/ManagePortfolioPanel'
import { AddHoldingPanel } from '@/components/AddHoldingPanel'
import { ImportHoldingsPanel } from '@/components/ImportHoldingsPanel'
import { updateHolding, deleteHolding, addHolding } from '@/app/actions'

export const dynamic = 'force-dynamic'

export default async function PositionsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  const userId = session.user.id

  const holdings = await prisma.holding.findMany({
    where: { userId },
    include: {
      questions: { select: { id: true } },
      falsifiers: { orderBy: { createdAt: 'desc' } }
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-8)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>
            Positions Management
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
            Manage your tracked holdings, investment theses, and falsifier criteria.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--sp-4)' }}>
          <AddHoldingPanel action={addHolding as unknown as (fd: FormData) => void} />
          <ImportHoldingsPanel />
        </div>
      </div>

      <div style={{ background: 'var(--surface-elevated)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: 'var(--sp-6)' }}>
        <ManagePortfolioPanel 
          holdings={holdings} 
          updateAction={updateHolding as unknown as (fd: FormData) => void} 
          deleteAction={deleteHolding as unknown as (fd: FormData) => void} 
        />
      </div>
    </div>
  )
}
