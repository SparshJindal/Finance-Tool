'use client'

import { useState, useTransition } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

type UserProfile = {
  name: string
  email: string
  firstName: string | null
  lastName: string | null
  phone: string | null
  nationality: string | null
  image: string | null
}

export function ProfilePanel({
  userProfile,
  updateAction
}: {
  userProfile: UserProfile
  updateAction: (fd: FormData) => Promise<{ success?: boolean; error?: string }>
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMsg(null)
    const fd = new FormData(e.currentTarget)
    
    startTransition(async () => {
      const res = await updateAction(fd)
      if (res?.error) {
        setErrorMsg(res.error)
      } else {
        setIsEditing(false)
      }
    })
  }

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)} 
        className="btn btn-secondary"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
        Profile
      </button>

      <AnimatePresence>
        {isOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', justifyContent: 'flex-end' }}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }}
            />
            
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              style={{ 
                position: 'relative', 
                width: '100%', 
                maxWidth: '400px', 
                background: 'var(--base-0)', 
                borderLeft: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '-8px 0 24px rgba(0,0,0,0.2)'
              }}
            >
              <div style={{ padding: 'var(--sp-6)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--text-primary)' }}>
                  User Profile
                </h2>
                <button onClick={() => setIsOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>

              <div style={{ padding: 'var(--sp-6)', flex: 1, overflowY: 'auto' }}>
                {errorMsg && (
                  <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--bearish)', padding: 'var(--sp-3)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-sm)', marginBottom: 'var(--sp-4)' }}>
                    {errorMsg}
                  </div>
                )}

                {isEditing ? (
                  <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)' }}>
                      <div>
                        <label className="section-label" style={{ display: 'block', marginBottom: 'var(--sp-2)' }}>First Name</label>
                        <input type="text" name="firstName" defaultValue={userProfile.firstName || ''} required className="input" style={{ width: '100%', background: 'var(--surface)', color: 'var(--text-primary)', borderColor: 'var(--border-hi)' }} />
                      </div>
                      <div>
                        <label className="section-label" style={{ display: 'block', marginBottom: 'var(--sp-2)' }}>Last Name</label>
                        <input type="text" name="lastName" defaultValue={userProfile.lastName || ''} required className="input" style={{ width: '100%', background: 'var(--surface)', color: 'var(--text-primary)', borderColor: 'var(--border-hi)' }} />
                      </div>
                    </div>

                    <div>
                      <label className="section-label" style={{ display: 'block', marginBottom: 'var(--sp-2)' }}>Phone</label>
                      <input type="tel" name="phone" defaultValue={userProfile.phone || ''} className="input" style={{ width: '100%', background: 'var(--surface)', color: 'var(--text-primary)', borderColor: 'var(--border-hi)' }} />
                    </div>

                    <div>
                      <label className="section-label" style={{ display: 'block', marginBottom: 'var(--sp-2)' }}>Nationality</label>
                      <select name="nationality" defaultValue={userProfile.nationality || ''} className="input" style={{ width: '100%', appearance: 'auto', background: 'var(--surface)', color: 'var(--text-primary)', borderColor: 'var(--border-hi)' }}>
                        <option value="">Select a country...</option>
                        <option value="India">India</option>
                        <option value="United States">United States</option>
                        <option value="United Kingdom">United Kingdom</option>
                        <option value="Canada">Canada</option>
                        <option value="Australia">Australia</option>
                        <option value="Singapore">Singapore</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div style={{ display: 'flex', gap: 'var(--sp-3)', marginTop: 'var(--sp-4)' }}>
                      <button type="button" onClick={() => setIsEditing(false)} className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Cancel</button>
                      <button type="submit" disabled={isPending} className="btn" style={{ flex: 1, justifyContent: 'center' }}>
                        {isPending ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
                    <div>
                      <label className="section-label" style={{ display: 'block', marginBottom: 'var(--sp-1)' }}>Email</label>
                      <div style={{ color: 'var(--text-primary)' }}>{userProfile.email}</div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)' }}>
                      <div>
                        <label className="section-label" style={{ display: 'block', marginBottom: 'var(--sp-1)' }}>First Name</label>
                        <div style={{ color: 'var(--text-primary)' }}>{userProfile.firstName || '—'}</div>
                      </div>
                      <div>
                        <label className="section-label" style={{ display: 'block', marginBottom: 'var(--sp-1)' }}>Last Name</label>
                        <div style={{ color: 'var(--text-primary)' }}>{userProfile.lastName || '—'}</div>
                      </div>
                    </div>
                    <div>
                      <label className="section-label" style={{ display: 'block', marginBottom: 'var(--sp-1)' }}>Phone</label>
                      <div style={{ color: 'var(--text-primary)' }}>{userProfile.phone || '—'}</div>
                    </div>
                    <div>
                      <label className="section-label" style={{ display: 'block', marginBottom: 'var(--sp-1)' }}>Nationality</label>
                      <div style={{ color: 'var(--text-primary)' }}>{userProfile.nationality || '—'}</div>
                    </div>

                    <button onClick={() => setIsEditing(true)} className="btn btn-secondary" style={{ marginTop: 'var(--sp-4)', justifyContent: 'center' }}>
                      Edit Profile
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
