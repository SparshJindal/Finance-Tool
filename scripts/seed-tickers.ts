import 'dotenv/config'
import { prisma } from '../src/lib/db'
import fetch from 'node-fetch'

async function seedTickers() {
  console.log("Fetching NSE Equity list...")
  
  try {
    const res = await fetch("https://archives.nseindia.com/content/equities/EQUITY_L.csv", {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      }
    })
    
    if (!res.ok) {
      throw new Error(`Failed to fetch NSE data: ${res.status} ${res.statusText}`)
    }
    
    const csvData = await res.text()
    
    // Parse CSV
    const lines = csvData.split('\n').map(line => line.trim()).filter(line => line.length > 0)
    // Remove header
    const header = lines.shift()
    
    if (!header || !header.includes('SYMBOL')) {
      throw new Error("Invalid CSV format received from NSE")
    }

    const tickers = []
    
    for (const line of lines) {
      // Split by comma, but handle quotes if necessary (NSE CSV is usually simple comma separated)
      const parts = line.split(',')
      if (parts.length >= 2) {
        const symbol = parts[0].trim()
        const company = parts[1].trim()
        
        if (symbol && company && symbol !== 'SYMBOL') {
          // Append .NS to make it Yahoo Finance compatible if they ever want to fetch quotes
          tickers.push({
            symbol: `${symbol}.NS`,
            company: company,
            exchange: 'NSE',
            sector: parts.length > 2 ? parts[2].trim() : null
          })
        }
      }
    }
    
    console.log(`Found ${tickers.length} tickers. Inserting into database...`)
    
    // Bulk insert with skipDuplicates
    const result = await prisma.marketTicker.createMany({
      data: tickers,
      skipDuplicates: true,
    })
    
    console.log(`\nSeeding complete! Inserted ${result.count} new tickers.`)
    
  } catch (error) {
    console.error("Error seeding tickers:", error)
  } finally {
    await prisma.$disconnect()
  }
}

seedTickers()
