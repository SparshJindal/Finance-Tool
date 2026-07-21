import React from 'react'
import { CorantoLogo } from '@/components/ui/CorantoLogo'

export function CorantoWordmark({ 
  height = 32, 
  showWordmark = true, 
  className = "" 
}: { 
  height?: number, 
  showWordmark?: boolean, 
  className?: string 
}) {
  return (
    <div 
      className={className} 
      style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: `${height * 0.28}px` 
      }}
    >
      <CorantoLogo width={height} height={height} />
      
      {showWordmark && (
        <span style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontWeight: 600,
          color: 'var(--text-primary)',
          fontSize: `${height * 0.7}px`,
          lineHeight: 1,
          letterSpacing: '0.01em',
          textTransform: 'lowercase'
        }}>
          coranto
        </span>
      )}
    </div>
  )
}
