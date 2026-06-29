import csvParser from 'csv-parser'
import https from 'https'
import fs from 'fs'
import { prisma } from '../src/lib/db'

async function fetchJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Node.js' } }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch (e) {
          reject(e)
        }
      })
    }).on('error', reject)
  })
}

async function fetchCsv(url: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const results: any[] = []
    https.get(url, { headers: { 'User-Agent': 'Node.js' } }, (res) => {
      res.pipe(csvParser())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', reject)
    }).on('error', reject)
  })
}

async function seed() {
  console.log("Starting ticker seed process...")
  const tickers: any[] = []
  const seen = new Set()

  try {
    // 1. Fetch Top 500 US companies (S&P 500)
    console.log("Fetching US (S&P 500) companies...")
    const sp500Url = "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/master/data/constituents.csv"
    const usData = await fetchCsv(sp500Url)
    for (const item of usData) {
      if (!seen.has(item.Symbol)) {
        tickers.push({
          symbol: item.Symbol,
          company: item.Security || item.Name,
          exchange: "US",
          sector: item['GICS Sector'] || item.Sector || null,
        })
        seen.add(item.Symbol)
      }
    }
    console.log(`Loaded ${usData.length} US tickers.`)

    // 2. Fetch Indian companies (NSE Official List)
    console.log("Fetching Indian (NSE) companies...")
    const nseUrl = "https://archives.nseindia.com/content/equities/EQUITY_L.csv"
    const indData = await fetchCsv(nseUrl)
    for (const item of indData) {
      const symbol = item.SYMBOL || item.Symbol
      const company = item['NAME OF COMPANY'] || item['Company Name'] || Object.values(item)[1]
      
      if (symbol && company && !seen.has(`${symbol}.NS`)) {
        tickers.push({
          symbol: `${symbol}.NS`, // Append .NS for NSE
          company: company.trim(),
          exchange: "NSE",
          sector: item[' SERIES'] || item.SERIES || null,
        })
        seen.add(`${symbol}.NS`)
      }
    }
    console.log(`Loaded ${indData.length} Indian tickers.`)

    // Insert into DB
    console.log(`Inserting ${tickers.length} total tickers into DB (skipping duplicates)...`)
    
    // We do it in chunks of 500 to not overload the DB connection
    const CHUNK_SIZE = 500
    for (let i = 0; i < tickers.length; i += CHUNK_SIZE) {
      const chunk = tickers.slice(i, i + CHUNK_SIZE)
      await prisma.marketTicker.createMany({
        data: chunk,
        skipDuplicates: true,
      })
      console.log(`Inserted chunk ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(tickers.length / CHUNK_SIZE)}`)
    }

    console.log("Seed complete!")

  } catch (err) {
    console.error("Failed to seed:", err)
  } finally {
    await prisma.$disconnect()
  }
}

seed()
