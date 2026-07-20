'use client'

import { useState } from 'react'

export function CompanyLogo({ ticker, size = 32 }: { ticker: string, size?: number }) {
  const [error, setError] = useState(false)
  const baseTicker = ticker.split('.')[0]

  if (error) {
    return (
      <div 
        style={{ 
          width: size, 
          height: size, 
          borderRadius: '50%', 
          background: 'var(--surface-subtle)', 
          border: '1px solid var(--border)',
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          fontSize: size * 0.4,
          fontWeight: 600,
          color: 'var(--text-muted)'
        }}
      >
        {baseTicker.charAt(0)}
      </div>
    )
  }

  return (
    <img 
      src={`https://financialmodelingprep.com/image-stock/${baseTicker}.png`}
      alt={`${ticker} logo`}
      width={size}
      height={size}
      onError={() => setError(true)}
      style={{ 
        width: size, 
        height: size, 
        borderRadius: '50%', 
        objectFit: 'cover',
        background: '#fff', // Many logos have transparent backgrounds and expect white
        border: '1px solid var(--border)'
      }}
    />
  )
}
