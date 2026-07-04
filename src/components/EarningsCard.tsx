import React from 'react';
import type { EarningsEvent } from '@prisma/client';

type Props = {
  ticker: string;
  event: EarningsEvent | undefined;
};

export function EarningsCard({ ticker, event }: Props) {
  if (!event) return null;

  const isUpcoming = event.status === "UPCOMING";
  const sourceTag = event.source === "news" ? (
    <span style={{ fontSize: '10px', color: 'var(--text-muted)', border: '1px solid var(--border)', padding: '2px 6px', borderRadius: '4px', marginLeft: 'auto' }}>
      via news
    </span>
  ) : null;

  const formatDate = (d: Date) => {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getDaysUntil = (d: Date) => {
    const diff = d.getTime() - new Date().getTime();
    return Math.ceil(diff / (1000 * 3600 * 24));
  };

  const renderSurpriseChip = (pct: number | null | undefined) => {
    if (pct == null) return null;
    const isBeat = pct >= 0;
    const color = isBeat ? 'var(--bullish)' : 'var(--bearish)';
    const bg = isBeat ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)';
    return (
      <span style={{
        background: bg,
        color: color,
        padding: '2px 6px',
        borderRadius: '4px',
        fontSize: '11px',
        fontWeight: 600,
        marginLeft: '6px'
      }}>
        {isBeat ? '+' : ''}{pct.toFixed(1)}%
      </span>
    );
  };

  const formatNumber = (num: number | null | undefined) => {
    if (num == null) return 'N/A';
    if (Math.abs(num) >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (Math.abs(num) >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    return `$${num.toFixed(2)}`;
  };

  const getVerdictColor = (verdict: string | null) => {
    switch (verdict?.toUpperCase()) {
      case 'SUPPORTS': return 'var(--bullish)';
      case 'THREATENS': return 'var(--bearish)';
      case 'MIXED': return 'var(--warning)';
      default: return 'var(--text-secondary)';
    }
  };

  const getVerdictIcon = (verdict: string | null) => {
    switch (verdict?.toUpperCase()) {
      case 'SUPPORTS': return '🟢';
      case 'THREATENS': return '🔴';
      case 'MIXED': return '🟡';
      default: return '⚪';
    }
  };

  return (
    <div className="card" style={{ padding: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 'var(--sp-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
          <div style={{
            background: 'var(--surface-subtle)',
            color: 'var(--text-primary)',
            fontSize: '11px',
            fontWeight: 700,
            padding: '4px 8px',
            borderRadius: '4px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            {ticker} {event.fiscalPeriod || 'Earnings'}
          </div>
          {isUpcoming ? (
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>
              Reports in {getDaysUntil(event.reportDate)} days &middot; {formatDate(event.reportDate)} {event.reportWhen || ''}
            </span>
          ) : (
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>
              Reported {formatDate(event.reportDate)}
            </span>
          )}
        </div>
        {sourceTag}
      </div>

      {/* Body */}
      {isUpcoming ? (
        <div style={{ display: 'flex', gap: 'var(--sp-6)', color: 'var(--text-secondary)' }}>
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Consensus EPS</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)' }}>{formatNumber(event.epsEstimate)}</div>
          </div>
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Consensus Rev</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)' }}>{formatNumber(event.revenueEstimate)}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', marginLeft: 'auto', fontStyle: 'italic', fontSize: '13px' }}>
            Awaiting results...
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          <div style={{ display: 'flex', gap: 'var(--sp-6)' }}>
            <div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px', color: 'var(--text-secondary)' }}>EPS Actual</div>
              <div style={{ display: 'flex', alignItems: 'baseline' }}>
                <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)' }}>{formatNumber(event.epsActual)}</span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '6px' }}>(Est: {formatNumber(event.epsEstimate)})</span>
                {renderSurpriseChip(event.epsSurprisePct)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px', color: 'var(--text-secondary)' }}>Rev Actual</div>
              <div style={{ display: 'flex', alignItems: 'baseline' }}>
                <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)' }}>{formatNumber(event.revenueActual)}</span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '6px' }}>(Est: {formatNumber(event.revenueEstimate)})</span>
                {renderSurpriseChip(event.revenueSurprisePct)}
              </div>
            </div>
          </div>

          {event.guidance && (
            <div style={{ background: 'var(--surface-subtle)', padding: 'var(--sp-2)', borderRadius: 'var(--radius-sm)', fontSize: '13px', fontStyle: 'italic', color: 'var(--text-secondary)', borderLeft: '2px solid var(--accent)' }}>
              &quot;{event.guidance}&quot;
            </div>
          )}

          {event.thesisVerdict && event.thesisSummary && (
            <div style={{ marginTop: 'var(--sp-2)', padding: 'var(--sp-3)', background: 'var(--surface-highlight)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '16px' }}>{getVerdictIcon(event.thesisVerdict)}</span>
                <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: getVerdictColor(event.thesisVerdict) }}>
                  {event.thesisVerdict} Thesis
                </span>
              </div>
              <div style={{ fontSize: '14px', lineHeight: 1.5, color: 'var(--text)' }}>
                {event.thesisSummary}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
