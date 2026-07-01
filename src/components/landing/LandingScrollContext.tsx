'use client'

import React, { createContext, useContext, useRef, useState, useCallback } from 'react'

export type ElementRegistration = {
  id: string
  ref: React.RefObject<HTMLElement | null>
  order: number
}

type ScrollContextType = {
  register: (id: string, ref: React.RefObject<HTMLElement | null>, order: number) => void
  unregister: (id: string) => void
  elements: Map<string, ElementRegistration>
  elementFractions: Map<string, number>
  setElementFractions: (fractions: Map<string, number>) => void
  progress: import('framer-motion').MotionValue<number>
}

const LandingScrollContext = createContext<ScrollContextType | null>(null)

export function LandingScrollProvider({ children, progress }: { children: React.ReactNode, progress: import('framer-motion').MotionValue<number> }) {
  const elementsRef = useRef<Map<string, ElementRegistration>>(new Map())
  const [updateTick, setUpdateTick] = useState(0)
  const [elementFractions, setFractions] = useState<Map<string, number>>(new Map())

  const register = useCallback((id: string, ref: React.RefObject<HTMLElement | null>, order: number) => {
    elementsRef.current.set(id, { id, ref, order })
    setUpdateTick(t => t + 1)
  }, [])

  const unregister = useCallback((id: string) => {
    elementsRef.current.delete(id)
    setUpdateTick(t => t + 1)
  }, [])

  const setElementFractions = useCallback((fractions: Map<string, number>) => {
    setFractions(fractions)
  }, [])

  return (
    <LandingScrollContext.Provider value={{ register, unregister, elements: elementsRef.current, elementFractions, setElementFractions, progress }}>
      {/* We pass updateTick as a key or just let elements map be read */}
      <span style={{ display: 'none' }} data-tick={updateTick} />
      {children}
    </LandingScrollContext.Provider>
  )
}

export function useLandingScroll() {
  const ctx = useContext(LandingScrollContext)
  if (!ctx) throw new Error('useLandingScroll must be used within LandingScrollProvider')
  return ctx
}
