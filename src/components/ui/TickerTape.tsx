'use client'

import { RelevanceBadge } from '@/components/feed/RelevanceBadge'

type TickerItem = {
  id: string
  ticker: string
  title: string
  severity: number
}

export function TickerTape({ items }: { items: TickerItem[] }) {
  if (!items || items.length === 0) return null

  // Duplicate items for seamless marquee loop (enough to overflow typical screens)
  const duplicated = [...items, ...items, ...items, ...items]

  return (
    <div
      style={{
        width: '100%',
        background: 'var(--base-0)',
        borderBottom: '1px solid var(--border)',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        display: 'flex',
        alignItems: 'center',
        padding: '8px 0',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <div className="ticker-tape-track" style={{ gap: 'var(--sp-8)', paddingLeft: 'var(--sp-8)' }}>
        {duplicated.map((item, i) => (
          <div key={`${item.id}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-primary)' }}>
              {item.ticker}
            </span>
            <RelevanceBadge severity={item.severity} size="sm" />
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
              {item.title}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
