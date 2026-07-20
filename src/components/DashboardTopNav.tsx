'use client'

import React, { createContext, useContext, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bot, LineChart, Target, Rss, Layers } from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'

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
    { name: 'Pulse', href: '/dashboard', icon: <Rss size={16} />, exact: true },
    { name: 'Positions', href: '/dashboard/positions', icon: <Layers size={16} /> },
    { name: 'Intel', href: '/dashboard/intel', icon: <Target size={16} /> },
    { name: 'Cora AI', href: '/dashboard/copilot', icon: <Bot size={16} /> },
  ]

  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'space-between',
      borderBottom: '1px solid var(--border)',
      paddingBottom: 'var(--sp-2)',
      marginBottom: 'var(--sp-6)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
        {tabs.map((t) => {
          const isActive = t.exact ? pathname === t.href : pathname.startsWith(t.href)
          return (
            <Link
              key={t.name}
              href={t.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--sp-2)',
                padding: 'var(--sp-2) var(--sp-4)',
                borderRadius: 'var(--radius-md)',
                background: isActive ? 'var(--surface-subtle)' : 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: isActive ? 600 : 500,
                fontSize: 'var(--text-sm)',
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
                  e.currentTarget.style.color = 'var(--text-secondary)'
                  e.currentTarget.style.background = 'transparent'
                }
              }}
            >
              <span style={{ opacity: isActive ? 1 : 0.6 }}>{t.icon}</span>
              {t.name}
            </Link>
          )
        })}
      </div>
      <div>
        <ThemeToggle />
      </div>
    </div>
  )
}
