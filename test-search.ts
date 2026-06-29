import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const count = await prisma.marketTicker.count()
  console.log("Total MarketTickers:", count)
  const rel = await prisma.marketTicker.findMany({
    where: { symbol: { contains: "relian", mode: "insensitive" } },
    take: 5
  })
  console.log("Relian by symbol:", rel)
  
  const rel2 = await prisma.marketTicker.findMany({
    where: { company: { contains: "relian", mode: "insensitive" } },
    take: 5
  })
  console.log("Relian by company:", rel2)
}
main()
