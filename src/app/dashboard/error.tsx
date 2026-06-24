'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div style={{ padding: '2rem', color: 'red', fontFamily: 'monospace' }}>
      <h2>Dashboard Crashed (Global Catch)</h2>
      <p><strong>Error Message:</strong> {error.message || String(error)}</p>
      <p><strong>Digest:</strong> {error.digest}</p>
      <p><strong>Stack:</strong> {error.stack}</p>
      <button onClick={() => reset()} style={{ padding: '0.5rem 1rem', marginTop: '1rem' }}>
        Try again
      </button>
    </div>
  )
}
