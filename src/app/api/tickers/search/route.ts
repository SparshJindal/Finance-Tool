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
    const tickers = await prisma.marketTicker.findMany({
      where: {
        OR: [
          { symbol: { contains: query, mode: 'insensitive' } },
          { company: { contains: query, mode: 'insensitive' } }
        ]
      },
      take: 10,
      orderBy: { symbol: 'asc' }
    })

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
