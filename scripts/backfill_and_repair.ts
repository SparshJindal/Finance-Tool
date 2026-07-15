import { prisma } from '../src/lib/db'
import { generateThesisFalsifiers } from '../src/lib/providers/falsifiers'
import { ingestNews } from '../src/lib/pipeline'

async function main() {
  const userEmail = process.env.DIGEST_EMAIL || 'sparshjindal06@gmail.com'
  
  const user = await prisma.user.findUnique({
    where: { email: userEmail }
  })
  
  if (!user) {
    console.error(`User with email ${userEmail} not found.`)
    return
  }

  console.log(`Starting processing for user: ${user.email} (${user.id})`)

  // 1. Backfill falsifiers
  const holdings = await prisma.holding.findMany({
    where: { userId: user.id },
    include: { falsifiers: true }
  })
  
  const toBackfill = holdings.filter(h => h.falsifiers.length === 0 && h.thesis && h.thesis.trim() !== "")
  console.log(`Found ${toBackfill.length} holdings to backfill falsifiers for.`)
  
  for (const h of toBackfill) {
    console.log(`Generating falsifiers for ${h.ticker}...`)
    try {
      const generated = await generateThesisFalsifiers(h as any)
      if (generated && generated.length > 0) {
        for (const f of generated) {
          await prisma.falsifier.create({
            data: {
              holdingId: h.id,
              text: f.text,
              rationale: f.rationale
            }
          })
        }
        console.log(`  -> Created ${generated.length} falsifiers for ${h.ticker}`)
      }
    } catch (e) {
      console.error(`Failed to generate falsifiers for ${h.ticker}:`, e)
    }
  }

  // 2. Data Repair
  console.log(`\nStarting Data Repair...`)
  
  // Update Direction Logic
  const updatedHoldings = await prisma.holding.updateMany({
    where: {
      userId: user.id,
      ticker: { in: ['AVGO', 'NVO'] },
      directionLogic: { not: 'SHORT' }
    },
    data: { directionLogic: 'SHORT' }
  })
  console.log(`Updated directionLogic to SHORT for ${updatedHoldings.count} holdings.`)

  // Delete Findings
  const holdingsToClear = await prisma.holding.findMany({
    where: {
      userId: user.id,
      ticker: { in: ['AVGO', 'NVO'] }
    },
    select: { id: true }
  })
  
  if (holdingsToClear.length > 0) {
    const deletedFindings = await prisma.finding.deleteMany({
      where: {
        holdingId: { in: holdingsToClear.map(h => h.id) }
      }
    })
    console.log(`Deleted ${deletedFindings.count} stale findings for AVGO/NVO.`)
  }

  // 3. Re-ingest (skipHeavyApis = false, so Earnings Pass runs)
  console.log(`\nStarting Re-ingest for all holdings...`)
  const holdingIds = holdings.map(h => h.id)
  
  // ingestNews(userId?: string, runEvaluation: boolean = true, targetHoldingIds?: string[], skipHeavyApis: boolean = false)
  const result = await ingestNews(user.id, true, holdingIds, false)
  console.log(`Ingest complete. Output:`, result)
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
