export function CorantoLogo({ width = 48, height = 48, className = "" }: { width?: number, height?: number, className?: string }) {
  return (
    <svg 
      width={width} 
      height={height} 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Outer translucent swoops (Gold/Beige/Brown) */}
      <path 
        d="M 75 25 A 35 35 0 1 0 75 75" 
        stroke="#A0845C" 
        strokeWidth="14" 
        strokeLinecap="round" 
        opacity="0.25"
      />
      <path 
        d="M 80 30 A 35 35 0 1 0 70 80" 
        stroke="#C9A675" 
        strokeWidth="12" 
        strokeLinecap="round" 
        opacity="0.35"
      />
      <path 
        d="M 70 20 A 35 35 0 1 0 80 70" 
        stroke="#E2C597" 
        strokeWidth="10" 
        strokeLinecap="round" 
        opacity="0.4"
      />
      
      {/* Crisp Electric Blue Highlight Arc */}
      <path 
        d="M 68 28 A 28 28 0 0 0 25 55" 
        stroke="var(--accent-blue)" 
        strokeWidth="3.5" 
        strokeLinecap="round" 
      />
    </svg>
  );
}
