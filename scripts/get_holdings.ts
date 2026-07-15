import { prisma } from '../src/lib/db'

async function main() {
  const holdings = await prisma.holding.findMany()
  console.log("Holdings count:", holdings.length)
}
main().finally(() => process.exit(0))
