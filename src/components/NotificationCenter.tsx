'use client'

import React, { useState, useRef, useEffect, useTransition } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, Check, ExternalLink } from 'lucide-react'
import type { FindingData } from './FindingCard'

type NotificationCenterProps = {
  unreadFindings: FindingData[]
  markReadAction: (findingIds: string[]) => Promise<{ success?: boolean; error?: string }>
}

export function NotificationCenter({ unreadFindings, markReadAction }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [optimisticUnread, setOptimisticUnread] = useState(unreadFindings)
  const menuRef = useRef<HTMLDivElement>(null)

  // Update optimistic state if props change (e.g. new findings arrive via polling or refresh)
  useEffect(() => {
    setOptimisticUnread(unreadFindings)
  }, [unreadFindings])

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleMarkAllRead = () => {
    if (optimisticUnread.length === 0) return
    const ids = optimisticUnread.map(f => f.id)
    setOptimisticUnread([])
    startTransition(() => {
      markReadAction(ids)
    })
  }

  const handleMarkSingleRead = (id: string) => {
    setOptimisticUnread(prev => prev.filter(f => f.id !== id))
    startTransition(() => {
      markReadAction([id])
    })
  }

  const unreadCount = optimisticUnread.length

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-[var(--surface-overlay)] transition-colors flex items-center justify-center"
        aria-label="Notifications"
      >
        <Bell size={20} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors" />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute top-1 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border border-[var(--surface-elevated)]"
          />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 sm:w-96 bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--border-hi)] rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
              <h3 className="font-ui text-sm font-semibold text-[var(--text-primary)]">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  disabled={isPending}
                  className="text-xs text-[var(--accent)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1 font-medium"
                >
                  <Check size={14} />
                  Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-[400px] overflow-y-auto">
              {unreadCount === 0 ? (
                <div className="px-4 py-8 text-center text-[var(--text-muted)] text-sm">
                  You're all caught up!
                </div>
              ) : (
                <div className="flex flex-col">
                  {optimisticUnread.map(finding => {
                    const isThreat = finding.direction === 'BEARISH' || finding.direction === 'Threatens'
                    return (
                      <div
                        key={finding.id}
                        className="px-4 py-3 border-b border-[var(--border)] hover:bg-[var(--surface-subtle)] transition-colors relative group"
                      >
                        <div className="flex justify-between items-start gap-3">
                          <div className="flex-1 flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-[var(--text-primary)]">
                                {finding.ticker}
                              </span>
                              <span
                                className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded-sm"
                                style={{
                                  background: isThreat ? 'var(--bearish-dim)' : 'var(--accent-dim)',
                                  color: isThreat ? 'var(--bearish)' : 'var(--accent)'
                                }}
                              >
                                {isThreat ? 'Threat' : 'Alert'}
                              </span>
                            </div>
                            <p className="text-xs text-[var(--text-secondary)] line-clamp-3">
                              {finding.summary}
                            </p>
                            <div className="flex items-center gap-3 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <a
                                href={finding.sourceLink}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] flex items-center gap-1 text-[var(--accent)] hover:underline"
                              >
                                Source <ExternalLink size={10} />
                              </a>
                              <button
                                onClick={() => handleMarkSingleRead(finding.id)}
                                className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                              >
                                Mark read
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
