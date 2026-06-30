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

    // Fallback to Yahoo Finance if not found in local DB (e.g. on fresh Vercel deployment)
    if (tickers.length === 0) {
      try {
        const yfRes = await fetch(`https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0'
          }
        })
        if (yfRes.ok) {
          const data = await yfRes.json()
          if (data.quotes && data.quotes.length > 0) {
            // Filter out empty symbols and map to our format
            const newTickers = data.quotes
              .filter((t: any) => t.quoteType === 'EQUITY' && t.symbol)
              .slice(0, 10)
              .map((t: any) => ({
                symbol: t.symbol,
                company: t.longname || t.shortname || t.symbol,
                exchange: t.symbol.includes('.') ? t.symbol.split('.').pop() : 'US'
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
        console.error('Yahoo fallback error:', err)
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
