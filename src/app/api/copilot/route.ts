import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { askAI, generateEmbedding } from '@/lib/providers/ai'
import { fetchQuote, fetchHistoricalTrend } from '@/lib/providers/quote'

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const { message } = await req.json()
    if (!message) return NextResponse.json({ error: 'Message required' }, { status: 400 })

    const userId = session.user.id

    // Fetch user context for RAG
    const holdings = await prisma.holding.findMany({
      where: { userId },
      select: { ticker: true, company: true, thesis: true, exchange: true }
    })

    const holdingsWithQuotes = await Promise.all(holdings.map(async (h) => {
      const quote = await fetchQuote(h.ticker, h.exchange);
      const trend = await fetchHistoricalTrend(h.ticker, h.exchange);
      return { ...h, quote, trend };
    }))

    let findings: any[] = []
    try {
      const queryEmbedding = await generateEmbedding(message)
      const formattedEmbedding = `[${queryEmbedding.join(',')}]`
      
      findings = await prisma.$queryRaw`
        SELECT f.id, f.severity, f.direction, f.summary, h.ticker
        FROM findings f
        JOIN holdings h ON f.holding_id = h.id
        WHERE h.user_id = ${userId} AND f.severity >= 3 AND f.embedding IS NOT NULL
        ORDER BY f.embedding <=> ${formattedEmbedding}::vector
        LIMIT 20
      `
    } catch (e) {
      console.warn("Vector search failed, falling back to recent", e)
      const recent = await prisma.finding.findMany({
        where: { holding: { userId }, severity: { gte: 3 } },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { holding: { select: { ticker: true } } }
      })
      findings = recent.map(f => ({ ...f, ticker: f.holding.ticker }))
    }

    const holdingsContext = holdingsWithQuotes.map(h => 
      `- ${h.ticker} (${h.company}): ${h.thesis}. [MARKET DATA: ${h.quote ? `${h.quote.priceChangePct}% change today, ${h.quote.volumeRatio}x avg volume` : 'Today unavailable'}. ${h.trend ? h.trend : 'Historical unavailable'}]`
    ).join('\n')
    
    const findingsContext = findings.map(f => `- [${f.ticker} - Sev ${f.severity} - ${f.direction}]: ${f.summary}`).join('\n')

    const prompt = `
You are Cora AI, an elite AI financial analyst assistant.
You provide deep, concise, and highly professional insights regarding the user's investment portfolio.
You have access to the user's holdings (including today's real-time market data) and their recent findings below.
When responding, speak directly to the user as an advisor. Maintain a sophisticated, sharp, and objective tone. Do not use emojis unless absolutely necessary for clarity.

### User Portfolio Context
Holdings, Theses, and Today's Market Data:
${holdingsContext || 'No holdings currently tracked.'}

Recent High Severity Findings:
${findingsContext || 'No recent threats found.'}

### User Query
${message}

Provide a concise, professional, and highly analytical response. If the query is unrelated to finance or their portfolio, politely guide them back to portfolio analysis. Use Markdown for formatting.
`

    const reply = await askAI({ prompt })

    return NextResponse.json({ reply })

  } catch (error: any) {
    console.error('Copilot Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
