import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import * as dotenv from 'dotenv'
dotenv.config()

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  await prisma.holding.create({
    data: {
      userId: 'test_user_1',
      ticker: 'TSLA',
      company: 'Tesla Inc.',
      thesis: 'Disrupting automotive and energy markets.',
      directionLogic: 'LONG',
    }
  })
  console.log('Seed completed: Inserted 1 holding.')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
