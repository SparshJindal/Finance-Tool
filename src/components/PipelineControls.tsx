'use client'

import { useTransition } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export function PipelineControls({
  runIngestAction,
  studyAllAction,
  sendDigestAction,
  logOutAction
}: {
  runIngestAction: (fd: FormData) => void | Promise<void>
  studyAllAction: (fd: FormData) => void | Promise<void>
  sendDigestAction: (fd: FormData) => void | Promise<void>
  logOutAction: (fd: FormData) => void | Promise<void>
}) {
  const [isPendingIngest, startTransitionIngest] = useTransition()
  const [isPendingStudy, startTransitionStudy] = useTransition()
  const [isPendingDigest, startTransitionDigest] = useTransition()

  const isAnyPending = isPendingIngest || isPendingStudy || isPendingDigest

  return (
    <>
      {/* Animated Progress Bar pinned to top of screen */}
      <AnimatePresence>
        {isAnyPending && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              height: '4px',
              background: 'var(--surface-subtle)',
              zIndex: 9999,
              overflow: 'hidden'
            }}
          >
            <motion.div
              animate={{
                x: ['-100%', '200%']
              }}
              transition={{
                repeat: Infinity,
                duration: 1.5,
                ease: 'linear'
              }}
              style={{
                width: '50%',
                height: '100%',
                background: 'linear-gradient(90deg, transparent, var(--accent), transparent)'
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
        <form action={fd => startTransitionIngest(() => runIngestAction(fd))}>
          <button 
            type="submit" 
            className="btn btn-secondary" 
            style={{ width: '100%', justifyContent: 'center' }}
            disabled={isAnyPending}
          >
            {isPendingIngest ? 'Running Pipeline...' : 'Run Ingest'}
          </button>
        </form>
        
        <form action={fd => startTransitionStudy(() => studyAllAction(fd))}>
          <button 
            type="submit" 
            className="btn btn-secondary" 
            style={{ width: '100%', justifyContent: 'center' }}
            disabled={isAnyPending}
          >
            {isPendingStudy ? 'Studying...' : 'Study All'}
          </button>
        </form>

        <form action={fd => startTransitionDigest(() => sendDigestAction(fd))}>
          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', justifyContent: 'center' }}
            disabled={isAnyPending}
          >
            {isPendingDigest ? 'Sending...' : 'Send Digest'}
          </button>
        </form>

        <form action={logOutAction}>
          <button 
            type="submit" 
            className="btn" 
            style={{ width: '100%', justifyContent: 'center', color: 'var(--text-secondary)', marginTop: 'var(--sp-4)' }}
            disabled={isAnyPending}
          >
            Log Out
          </button>
        </form>
      </div>
    </>
  )
}
