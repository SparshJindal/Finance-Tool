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

    return NextResponse.json({ tickers })
  } catch (error) {
    console.error('Ticker search error:', error)
    return NextResponse.json({ error: 'Failed to search tickers' }, { status: 500 })
  }
}
