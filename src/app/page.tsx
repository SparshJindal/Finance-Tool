import { prisma } from '@/lib/db'
import {
  addHolding,
  studyAllHoldings,
  triggerNewsIngestion,
  triggerSendDigest,
} from '@/app/actions'
import { HoldingRow } from '@/components/HoldingRow'
import { PushManager } from '@/components/PushManager'
import ReactMarkdown from 'react-markdown'

/* ─── small server-component helpers ─── */

function TopBar() {
  return (
    <header style={{
      borderBottom: '1px solid var(--border)',
      padding: '0 var(--sp-8)',
      height: '52px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      background: 'var(--base-0)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
        {/* wordmark */}
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-xs)',
          fontWeight: 600,
          letterSpacing: '0.10em',
          textTransform: 'uppercase',
          color: 'var(--accent)',
        }}>
          Radar
        </span>
        <span style={{
          width: '1px',
          height: '14px',
          background: 'var(--border)',
        }} />
        <span style={{
          fontFamily: 'var(--font-ui)',
          fontSize: 'var(--text-xs)',
          color: 'var(--text-muted)',
          fontWeight: 400,
        }}>
          Portfolio Intelligence
        </span>
      </div>

      {/* timestamp */}
      <time style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text-2xs)',
        color: 'var(--text-muted)',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {new Date().toLocaleDateString('en-IN', {
          weekday: 'short',
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          timeZone: 'Asia/Kolkata',
        })}
      </time>
    </header>
  )
}

function SectionHeader({ label, count }: { label: string; count?: number }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'baseline',
      gap: 'var(--sp-3)',
      marginBottom: 'var(--sp-5)',
    }}>
      <h2 style={{
        fontFamily: 'var(--font-ui)',
        fontSize: 'var(--text-md)',
        fontWeight: 600,
        color: 'var(--text-primary)',
        margin: 0,
      }}>
        {label}
      </h2>
      {count !== undefined && (
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-xs)',
          color: 'var(--text-muted)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {count}
        </span>
      )}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{
      background: 'var(--base-1)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      padding: 'var(--sp-12) var(--sp-8)',
      textAlign: 'center',
    }}>
      <p style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text-xs)',
        color: 'var(--text-muted)',
        letterSpacing: '0.04em',
      }}>
        {message}
      </p>
    </div>
  )
}

/* ─── Add Holding collapsible form (client) ─── */
import { AddHoldingPanel } from '@/components/AddHoldingPanel'

/* ─── Page ─── */
export default async function Page() {
  const holdings = await prisma.holding.findMany({
    where: { userId: 'me' },
    orderBy: { createdAt: 'desc' },
    include: { competitors: true, questions: true },
  })

  const latestBrief = await prisma.dailyBrief.findFirst({
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--base-0)' }}>
      <TopBar />

      <main style={{
        maxWidth: '880px',
        margin: '0 auto',
        padding: 'var(--sp-10) var(--sp-6)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--sp-12)',
      }}>

        {/* ── Controls row ── */}
        <section>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 'var(--sp-4)',
            flexWrap: 'wrap',
            marginBottom: 'var(--sp-5)',
          }}>
            <div>
              <h1 style={{
                fontFamily: 'var(--font-ui)',
                fontSize: 'var(--text-xl)',
                fontWeight: 600,
                color: 'var(--text-primary)',
                margin: 0,
                letterSpacing: '-0.02em',
              }}>
                Portfolio Holdings
              </h1>
              <p style={{
                fontFamily: 'var(--font-ui)',
                fontSize: 'var(--text-xs)',
                color: 'var(--text-muted)',
                marginTop: 'var(--sp-1)',
              }}>
                {holdings.length} position{holdings.length !== 1 ? 's' : ''} monitored
              </p>
            </div>

            {holdings.length > 0 && (
              <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
                <form action={triggerNewsIngestion as unknown as (fd: FormData) => void}>
                  <button type="submit" className="btn btn-secondary">
                    Run Ingest
                  </button>
                </form>
                <form action={studyAllHoldings as unknown as (fd: FormData) => void}>
                  <button type="submit" className="btn btn-secondary">
                    Study All
                  </button>
                </form>
                <form action={triggerSendDigest as unknown as (fd: FormData) => void}>
                  <button type="submit" className="btn btn-primary">
                    Send Digest
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Push alerts + add holding — in a row */}
          <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '280px' }}>
              <PushManager vapidPublicKey={process.env.VAPID_PUBLIC_KEY || ''} />
            </div>
          </div>
        </section>

        {/* ── Holdings list ── */}
        <section>
          <SectionHeader label="Positions" count={holdings.length} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            {holdings.map(h => (
              <HoldingRow key={h.id} holding={h} />
            ))}
            {holdings.length === 0 && (
              <EmptyState message="No positions. Add your first holding below." />
            )}
          </div>
        </section>

        {/* ── Add Holding (collapsible) ── */}
        <section>
          <AddHoldingPanel action={addHolding as unknown as (fd: FormData) => void | Promise<void>} />
        </section>

        {/* ── Daily Brief ── */}
        <section>
          <SectionHeader label="Daily Intelligence Brief" />

          {latestBrief ? (
            <div style={{
              background: 'var(--base-1)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--sp-8)',
            }}>
              {/* Brief meta */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: 'var(--sp-5)',
                marginBottom: 'var(--sp-5)',
                borderBottom: '1px solid var(--border)',
              }}>
                <span className="section-label">Intelligence Brief</span>
                <time style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-2xs)',
                  color: 'var(--text-muted)',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {new Date(latestBrief.createdAt).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'Asia/Kolkata',
                  })} IST
                </time>
              </div>

              <div className="brief-prose">
                <ReactMarkdown>{latestBrief.content}</ReactMarkdown>
              </div>
            </div>
          ) : (
            <EmptyState message="No brief yet — run the ingest pipeline to generate your first report." />
          )}
        </section>

      </main>
    </div>
  )
}
