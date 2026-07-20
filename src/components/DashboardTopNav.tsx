'use client'

import { createContext, useContext, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Activity, LayoutGrid, Server, Bot } from 'lucide-react'

// Dashboard Context to share activeHolding across tabs
export const DashboardContext = createContext<{
  activeHolding: string | null;
  setActiveHolding: (id: string | null) => void;
}>({ activeHolding: null, setActiveHolding: () => {} })

export function useDashboard() {
  return useContext(DashboardContext)
}

export function DashboardTopNav() {
  const pathname = usePathname()

  const tabs = [
    { name: 'Pulse', href: '/dashboard', icon: <Activity size={16} />, exact: true },
    { name: 'Intel Feed', href: '/dashboard/intel', icon: <Server size={16} /> },
    { name: 'Positions', href: '/dashboard/positions', icon: <LayoutGrid size={16} /> },
    { name: 'Copilot', href: '/dashboard/copilot', icon: <Bot size={16} /> },
  ]

  return (
    <div style={{ 
      display: 'flex', 
      gap: 'var(--sp-2)', 
      borderBottom: '1px solid var(--border)',
      paddingBottom: 'var(--sp-3)',
      marginBottom: 'var(--sp-2)'
    }}>
      {tabs.map(tab => {
        const isActive = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href)
        return (
          <Link 
            key={tab.name} 
            href={tab.href}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--sp-2)',
              padding: 'var(--sp-2) var(--sp-4)',
              borderRadius: 'var(--radius-md)',
              background: isActive ? 'var(--surface-subtle)' : 'transparent',
              color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: 'var(--text-sm)',
              fontWeight: isActive ? 600 : 500,
              textDecoration: 'none',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.color = 'var(--text-primary)'
                e.currentTarget.style.background = 'var(--surface-elevated)'
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.color = 'var(--text-muted)'
                e.currentTarget.style.background = 'transparent'
              }
            }}
          >
            {tab.icon}
            {tab.name}
          </Link>
        )
      })}
    </div>
  )
}
