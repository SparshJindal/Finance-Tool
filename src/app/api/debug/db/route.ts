import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const marketTickerCount = await prisma.marketTicker.count()
    const holdingCount = await prisma.holding.count()
    
    const dbUrl = process.env.DATABASE_URL || ''
    const dbInfo = `${dbUrl.split('@')[1]?.split('/')[0] || 'unknown-db'}`

    return NextResponse.json({ 
      counts: {
        marketTickers: marketTickerCount,
        holdings: holdingCount
      },
      dbHost: dbInfo
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
