import React from 'react'

export default function DashboardLoading() {
  return (
    <div className="noise-bg" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      <div style={{ display: 'flex', flex: 1, position: 'relative', zIndex: 10 }}>
        
        {/* Left Sidebar Skeleton (IntelRail) */}
        <aside style={{ width: '220px', borderRight: '1px solid var(--border)', padding: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', background: 'var(--surface)' }} className="hidden md:flex">
          <div className="animate-pulse" style={{ height: '24px', width: '60%', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-sm)', marginBottom: 'var(--sp-4)' }} />
          {[...Array(6)].map((_, i) => (
            <div key={i} className="animate-pulse" style={{ height: '32px', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-sm)' }} />
          ))}
        </aside>

        {/* Main Feed Skeleton */}
        <main style={{ flex: 1, padding: 'var(--sp-8) var(--sp-4)' }}>
          <div style={{ maxWidth: '840px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--sp-8)' }}>
            
            {/* Top Bar Skeleton */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                <div className="animate-pulse" style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--surface-subtle)' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div className="animate-pulse" style={{ width: '100px', height: '16px', background: 'var(--surface-subtle)', borderRadius: '4px' }} />
                  <div className="animate-pulse" style={{ width: '140px', height: '12px', background: 'var(--surface-subtle)', borderRadius: '4px' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                <div className="animate-pulse" style={{ width: '120px', height: '36px', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)' }} />
                <div className="animate-pulse" style={{ width: '120px', height: '36px', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)' }} />
              </div>
            </div>

            {/* Findings Feed Skeletons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
              {[...Array(5)].map((_, i) => (
                <div key={i} className="card animate-pulse" style={{ padding: 'var(--sp-5)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', height: '140px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ width: '120px', height: '20px', background: 'var(--surface-subtle)', borderRadius: '4px' }} />
                    <div style={{ width: '60px', height: '20px', background: 'var(--surface-subtle)', borderRadius: '4px' }} />
                  </div>
                  <div style={{ width: '100%', height: '48px', background: 'var(--surface-subtle)', borderRadius: '4px' }} />
                  <div style={{ width: '200px', height: '12px', background: 'var(--surface-subtle)', borderRadius: '4px', marginTop: 'auto' }} />
                </div>
              ))}
            </div>
            
          </div>
        </main>
      </div>
    </div>
  )
}
