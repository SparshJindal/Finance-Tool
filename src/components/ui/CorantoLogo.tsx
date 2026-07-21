import React from 'react'

export function CorantoLogo({ width = 80, height = 80, className = "" }: { width?: number, height?: number, className?: string }) {
  const idSuffix = React.useId().replace(/:/g, '')
  const gradientId = `corantoAmber-${idSuffix}`

  return (
    <svg 
      width={width} 
      height={height} 
      viewBox="0 0 100 100" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="coranto"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#B9975B"/>
          <stop offset="100%" stopColor="#8C6E45"/>
        </linearGradient>
      </defs>
      {/* faint radar ring (optional depth) */}
      <circle cx="50" cy="50" r="17" fill="none" stroke="#A0845C" strokeOpacity="0.22" strokeWidth="2"/>
      {/* the C / sweep */}
      <path d="M69.5 22.2 A34 34 0 1 0 69.5 77.8" fill="none"
            stroke={`url(#${gradientId})`} strokeWidth="9" strokeLinecap="round"/>
      {/* signal blip node at the sweep tip */}
      <circle cx="69.5" cy="22.2" r="6.5" fill={`url(#${gradientId})`}/>
    </svg>
  )
}
