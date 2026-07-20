import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getStartedBoss } from '@/lib/boss'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.warn("Invalid CRON_SECRET for falsifiers cron")
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const boss = await getStartedBoss();

    // Get all un-triggered falsifiers
    const falsifiers = await prisma.falsifier.findMany({
      where: {
        status: { in: ['WATCH', 'UNTRIGGERED'] }
      },
      include: { holding: true }
    })

    console.log(`[cron/falsifiers] Found ${falsifiers.length} falsifiers to evaluate`)

    let enqueued = 0
    for (const falsifier of falsifiers) {
      await boss.send('eval-falsifier', {
        falsifierId: falsifier.id,
        holdingId: falsifier.holdingId,
        ticker: falsifier.holding.ticker,
        company: falsifier.holding.company,
        thesis: falsifier.holding.thesis,
        text: falsifier.text,
        rationale: falsifier.rationale
      }, {
        retryLimit: 1
      })
      enqueued++
    }

    return NextResponse.json({ success: true, count: enqueued })
  } catch (error: any) {
    console.error("[cron/falsifiers] Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
