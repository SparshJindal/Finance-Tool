import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q')

    if (!query || query.length < 1) {
      return NextResponse.json({ tickers: [] })
    }

    // Search for tickers matching the symbol or company name
    let tickers = await prisma.marketTicker.findMany({
      where: {
        OR: [
          { symbol: { contains: query, mode: 'insensitive' } },
          { company: { contains: query, mode: 'insensitive' } }
        ]
      },
      take: 10,
      orderBy: { symbol: 'asc' }
    })

    // Fallback to Finnhub if not found in local DB (e.g. on fresh Vercel deployment)
    if (tickers.length === 0 && process.env.FINNHUB_API_KEY) {
      try {
        const finnhubRes = await fetch(`https://finnhub.io/api/v1/search?q=${encodeURIComponent(query)}&token=${process.env.FINNHUB_API_KEY}`)
        if (finnhubRes.ok) {
          const data = await finnhubRes.json()
          if (data.result && data.result.length > 0) {
            // Filter common stocks and map to our format
            const newTickers = data.result
              .filter((t: any) => t.type === 'Common Stock' && t.symbol && !t.symbol.includes('.'))
              .slice(0, 10)
              .map((t: any) => ({
                symbol: t.symbol,
                company: t.description || t.symbol,
                exchange: 'US'
              }))

            if (newTickers.length > 0) {
              // Save to DB so we don't have to fetch again
              await prisma.marketTicker.createMany({
                data: newTickers,
                skipDuplicates: true
              })
              
              // Refetch to get the DB generated IDs
              tickers = await prisma.marketTicker.findMany({
                where: {
                  OR: [
                    { symbol: { contains: query, mode: 'insensitive' } },
                    { company: { contains: query, mode: 'insensitive' } }
                  ]
                },
                take: 10,
                orderBy: { symbol: 'asc' }
              })
            }
          }
        }
      } catch (err) {
        console.error('Finnhub fallback error:', err)
      }
    }

    const dbUrl = process.env.DATABASE_URL || ''
    const dbInfo = `${dbUrl.split('@')[1]?.split('/')[0] || 'unknown-db'} (length: ${dbUrl.length})`

    return NextResponse.json({ 
      tickers, 
      debug: { 
        queryReceived: query, 
        dbHost: dbInfo,
        tickersFound: tickers.length
      } 
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
      }
    })
  } catch (error) {
    console.error('Ticker search error:', error)
    return NextResponse.json({ error: 'Failed to search tickers', details: String(error) }, { status: 500 })
  }
}
