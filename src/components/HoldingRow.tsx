'use client'

import { useState } from 'react'
import { deleteHolding, updateHolding, studyHolding } from '@/app/actions'
import type { Holding, Competitor, Question } from '@prisma/client'

type HoldingWithDetails = Holding & { competitors: Competitor[], questions: Question[] }

export function HoldingRow({ holding }: { holding: HoldingWithDetails }) {
  const [isEditing, setIsEditing] = useState(false)

  if (isEditing) {
    return (
      <form action={async (fd) => {
        await updateHolding(fd)
        setIsEditing(false)
      }} className="border border-neutral-300 dark:border-neutral-700 p-5 space-y-4 bg-neutral-50 dark:bg-neutral-900">
        <input type="hidden" name="id" value={holding.id} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Ticker</label>
            <input name="ticker" defaultValue={holding.ticker} required className="w-full border border-neutral-300 dark:border-neutral-700 rounded-none px-3 py-2 bg-white dark:bg-neutral-950 focus:outline-none focus:ring-1 focus:ring-neutral-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Company</label>
            <input name="company" defaultValue={holding.company} required className="w-full border border-neutral-300 dark:border-neutral-700 rounded-none px-3 py-2 bg-white dark:bg-neutral-950 focus:outline-none focus:ring-1 focus:ring-neutral-500" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Thesis</label>
          <textarea name="thesis" defaultValue={holding.thesis} required rows={2} className="w-full border border-neutral-300 dark:border-neutral-700 rounded-none px-3 py-2 bg-white dark:bg-neutral-950 focus:outline-none focus:ring-1 focus:ring-neutral-500"></textarea>
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Direction</label>
          <select name="directionLogic" defaultValue={holding.directionLogic} className="w-full border border-neutral-300 dark:border-neutral-700 rounded-none px-3 py-2 bg-white dark:bg-neutral-950 focus:outline-none focus:ring-1 focus:ring-neutral-500">
            <option value="LONG">LONG</option>
            <option value="SHORT">SHORT</option>
          </select>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="submit" className="bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 px-5 py-2 text-sm font-medium hover:opacity-90 transition-opacity rounded-none">Save</button>
          <button type="button" onClick={() => setIsEditing(false)} className="bg-transparent border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 px-5 py-2 text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors rounded-none">Cancel</button>
        </div>
      </form>
    )
  }

  return (
    <div className="border border-neutral-300 dark:border-neutral-700 p-5 flex flex-col gap-6 bg-white dark:bg-neutral-950">
      <div className="flex flex-col sm:flex-row justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="font-bold text-lg tracking-tight text-neutral-900 dark:text-neutral-100">{holding.ticker}</span>
            <span className="text-xs font-mono bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 px-2 py-1 uppercase">{holding.directionLogic}</span>
            {holding.sector && <span className="text-xs border border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 px-2 py-1">{holding.sector}</span>}
          </div>
          <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 mb-2">{holding.company}</p>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">{holding.thesis}</p>
        </div>
        <div className="flex flex-wrap sm:flex-col gap-3 items-start shrink-0 mt-4 sm:mt-0">
          <form action={studyHolding}>
            <input type="hidden" name="id" value={holding.id} />
            <button type="submit" className="text-sm border border-neutral-300 dark:border-neutral-700 px-4 py-1.5 bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 hover:opacity-90 transition-opacity font-medium rounded-none">Run Study</button>
          </form>
          <button onClick={() => setIsEditing(true)} className="text-sm text-neutral-600 dark:text-neutral-400 underline underline-offset-4 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors">Edit</button>
          <form action={deleteHolding}>
            <input type="hidden" name="id" value={holding.id} />
            <button type="submit" className="text-sm text-red-600 dark:text-red-400 underline underline-offset-4 hover:text-red-800 dark:hover:text-red-300 transition-colors">Delete</button>
          </form>
        </div>
      </div>
      
      {(holding.competitors.length > 0 || holding.questions.length > 0) && (
        <div className="border-t border-neutral-200 dark:border-neutral-800 pt-5 mt-2 flex flex-col gap-5">
          {holding.competitors.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase text-neutral-500 mb-2 tracking-wider">Competitors</h4>
              <div className="flex gap-2 flex-wrap">
                {holding.competitors.map(c => (
                  <span key={c.id} className="text-xs font-medium border border-neutral-300 dark:border-neutral-700 px-2.5 py-1 text-neutral-700 dark:text-neutral-300 bg-neutral-50 dark:bg-neutral-900">{c.ticker}</span>
                ))}
              </div>
            </div>
          )}
          {holding.questions.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase text-neutral-500 mb-3 tracking-wider">Watch Questions</h4>
              <ul className="space-y-3">
                {holding.questions.map(q => (
                  <li key={q.id} className="text-sm flex flex-col sm:flex-row gap-1 sm:gap-4 sm:items-start">
                    <span className="text-[11px] font-mono font-bold text-neutral-400 mt-0.5 w-28 shrink-0 uppercase tracking-tight">{q.category}</span>
                    <span className="text-neutral-700 dark:text-neutral-300 leading-snug">{q.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
