'use client'

import React, { createContext, useContext, useRef, useState, useCallback } from 'react'

export type WaypointType = 'step' | 'feature-heading' | 'feature-left' | 'feature-right' | 'demo' | 'cta' | 'default'

export type ElementRegistration = {
  id: string
  ref: React.RefObject<HTMLElement | null>
  order: number
  waypointType: WaypointType
}

type ScrollContextType = {
  register: (id: string, ref: React.RefObject<HTMLElement | null>, order: number, waypointType?: WaypointType) => void
  unregister: (id: string) => void
  elements: Map<string, ElementRegistration>
  elementFractions: Map<string, { top: number, center: number }>
  setElementFractions: (fractions: Map<string, { top: number, center: number }>) => void
  progress: import('framer-motion').MotionValue<number>
}

const LandingScrollContext = createContext<ScrollContextType | null>(null)

export function LandingScrollProvider({ children, progress }: { children: React.ReactNode, progress: import('framer-motion').MotionValue<number> }) {
  const elementsRef = useRef<Map<string, ElementRegistration>>(new Map())
  const [updateTick, setUpdateTick] = useState(0)
  const [elementFractions, setFractions] = useState<Map<string, { top: number, center: number }>>(new Map())

  const register = useCallback((id: string, ref: React.RefObject<HTMLElement | null>, order: number, waypointType: WaypointType = 'default') => {
    elementsRef.current.set(id, { id, ref, order, waypointType })
    setUpdateTick(t => t + 1)
  }, [])

  const unregister = useCallback((id: string) => {
    elementsRef.current.delete(id)
    setUpdateTick(t => t + 1)
  }, [])

  const setElementFractions = useCallback((fractions: Map<string, { top: number, center: number }>) => {
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
