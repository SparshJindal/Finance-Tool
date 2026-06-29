import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import * as dotenv from 'dotenv'

dotenv.config()

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

import * as Papa from 'papaparse'

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY

async function fetchTickers(exchange: string) {
  console.log(`Fetching ${exchange} tickers from Finnhub...`)
  const url = `https://finnhub.io/api/v1/stock/symbol?exchange=${exchange}&token=${FINNHUB_API_KEY}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${exchange} tickers: ${res.statusText}`)
  const data = await res.json()
  
  // Filter for Common Stock and valid symbols/descriptions
  const filtered = data.filter((item: any) => 
    item.type === 'Common Stock' && 
    item.description && 
    item.symbol && 
    !item.symbol.includes('.') && 
    !item.symbol.includes('-')
  )
  
  console.log(`Found ${filtered.length} valid common stocks for ${exchange}`)
  return filtered
}

async function fetchNSETickers() {
  console.log(`Fetching Indian tickers from NSE...`)
  // Alternative stable endpoint for NSE tickers if official archive is blocked
  const url = 'https://raw.githubusercontent.com/sahilrahman12/Price-Volume-Data-Downloader-NSE/master/symbols.csv'
  const res = await fetch(url)
  if (!res.ok) {
    // If it fails, return a small fallback list
    console.log("Failed to fetch NSE CSV from github, using fallback.")
    return [
      { symbol: 'RELIANCE.NS', company: 'Reliance Industries Limited' },
      { symbol: 'TCS.NS', company: 'Tata Consultancy Services Limited' },
      { symbol: 'HDFCBANK.NS', company: 'HDFC Bank Limited' },
      { symbol: 'INFY.NS', company: 'Infosys Limited' }
    ]
  }
  const text = await res.text()
  
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true })
  const filtered = parsed.data
    .filter((row: any) => row.SYMBOL && row.SYMBOL !== 'SYMBOL')
    .map((row: any) => ({
      symbol: `${row.SYMBOL}.NS`,
      company: row['NAME OF COMPANY'] || row.SYMBOL
    }))
  
  console.log(`Found ${filtered.length} valid common stocks for NS`)
  return filtered
}

async function main() {
  if (!FINNHUB_API_KEY) {
    throw new Error('FINNHUB_API_KEY is not set in environment')
  }

  const usTickers = await fetchTickers('US')
  const inTickers = await fetchNSETickers()

  const allTickers = [
    ...usTickers.map((t: any) => ({
      symbol: t.symbol,
      company: t.description,
      exchange: 'US'
    })),
    ...inTickers.map((t: any) => ({
      symbol: t.symbol,
      company: t.company,
      exchange: 'NS'
    }))
  ]

  console.log(`Total tickers to insert: ${allTickers.length}`)

  // Use a transaction and chunking to avoid query limits
  const CHUNK_SIZE = 1000
  let insertedCount = 0

  // First, clear existing to avoid duplicates if running multiple times
  await prisma.marketTicker.deleteMany({})

  for (let i = 0; i < allTickers.length; i += CHUNK_SIZE) {
    const chunk = allTickers.slice(i, i + CHUNK_SIZE)
    const result = await prisma.marketTicker.createMany({
      data: chunk,
      skipDuplicates: true
    })
    insertedCount += result.count
    console.log(`Inserted chunk ${i / CHUNK_SIZE + 1} (${insertedCount} total)`)
  }

  console.log(`Successfully seeded ${insertedCount} tickers into the database!`)
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
