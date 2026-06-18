import { prisma } from '@/lib/db'
import { addHolding, studyAllHoldings, triggerNewsIngestion, triggerSendDigest } from '@/app/actions'
import { HoldingRow } from '@/components/HoldingRow'
import { PushManager } from '@/components/PushManager'
import ReactMarkdown from 'react-markdown'

export default async function Page() {
  const holdings = await prisma.holding.findMany({
    where: { userId: 'me' },
    orderBy: { createdAt: 'desc' },
    include: {
      competitors: true,
      questions: true
    }
  })

  const latestBrief = await prisma.dailyBrief.findFirst({
    orderBy: { createdAt: 'desc' }
  })

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-12 space-y-12 font-sans">
      <header className="border-b border-neutral-300 dark:border-neutral-700 pb-6">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">Portfolio Holdings</h1>
      </header>

      <PushManager vapidPublicKey={process.env.VAPID_PUBLIC_KEY || ''} />
      
      <section className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 p-6 sm:p-8">
        <h2 className="text-xl font-semibold mb-6 text-neutral-900 dark:text-neutral-100">Add New Holding</h2>
        <form action={addHolding} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Ticker</label>
              <input name="ticker" required className="w-full border border-neutral-300 dark:border-neutral-700 rounded-none px-3 py-2 bg-white dark:bg-neutral-950 focus:outline-none focus:ring-1 focus:ring-neutral-500 placeholder-neutral-400" placeholder="e.g. AAPL" />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Company</label>
              <input name="company" required className="w-full border border-neutral-300 dark:border-neutral-700 rounded-none px-3 py-2 bg-white dark:bg-neutral-950 focus:outline-none focus:ring-1 focus:ring-neutral-500 placeholder-neutral-400" placeholder="e.g. Apple Inc." />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Thesis</label>
            <textarea name="thesis" required rows={2} className="w-full border border-neutral-300 dark:border-neutral-700 rounded-none px-3 py-2 bg-white dark:bg-neutral-950 focus:outline-none focus:ring-1 focus:ring-neutral-500 placeholder-neutral-400" placeholder="Investment rationale..."></textarea>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Direction Logic</label>
            <select name="directionLogic" className="w-full border border-neutral-300 dark:border-neutral-700 rounded-none px-3 py-2 bg-white dark:bg-neutral-950 focus:outline-none focus:ring-1 focus:ring-neutral-500">
              <option value="LONG">LONG</option>
              <option value="SHORT">SHORT</option>
            </select>
          </div>
          <div className="pt-2">
            <button type="submit" className="bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 px-6 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity rounded-none">Add Holding</button>
          </div>
        </form>
      </section>

      <section className="space-y-6">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Daily Intelligence Brief</h2>
        {latestBrief ? (
          <div className="bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 p-6 sm:p-8 prose prose-neutral dark:prose-invert max-w-none font-sans">
            <ReactMarkdown>{latestBrief.content}</ReactMarkdown>
          </div>
        ) : (
          <div className="bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 p-6 sm:p-8 text-neutral-500 text-sm">
            No intelligence brief generated yet. Run the Ingest News Pipeline to generate your first brief.
          </div>
        )}
      </section>

      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Current Portfolio</h2>
          {holdings.length > 0 && (
            <div className="flex flex-wrap gap-3">
              <form action={triggerNewsIngestion}>
                <button type="submit" className="text-sm border border-neutral-300 dark:border-neutral-700 px-5 py-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 hover:opacity-90 transition-opacity font-medium rounded-none">Ingest News Pipeline</button>
              </form>
              <form action={studyAllHoldings}>
                <button type="submit" className="text-sm border border-neutral-300 dark:border-neutral-700 px-5 py-2 bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 hover:opacity-90 transition-opacity font-medium rounded-none">Study Entire Portfolio</button>
              </form>
              <form action={triggerSendDigest}>
                <button type="submit" className="text-sm border border-transparent px-5 py-2 bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium rounded-none shadow-sm">Send test digest now</button>
              </form>
            </div>
          )}
        </div>
        <div className="space-y-4">
          {holdings.map(h => (
            <HoldingRow key={h.id} holding={h} />
          ))}
          {holdings.length === 0 && (
            <div className="border border-neutral-300 dark:border-neutral-700 p-8 text-center bg-white dark:bg-neutral-950">
              <p className="text-neutral-500 dark:text-neutral-400">No holdings found. Add your first holding above.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
