import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { askAI } from '@/lib/providers/ai'

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
      select: { ticker: true, company: true, thesis: true }
    })

    const findings = await prisma.finding.findMany({
      where: { holding: { userId }, severity: { gte: 3 } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { holding: { select: { ticker: true } } }
    })

    const holdingsContext = holdings.map(h => `- ${h.ticker} (${h.company}): ${h.thesis}`).join('\n')
    const findingsContext = findings.map(f => `- [${f.holding.ticker} - Sev ${f.severity} - ${f.direction}]: ${f.summary}`).join('\n')

    const prompt = `
You are Cora AI, an elite AI financial analyst assistant.
You provide deep, concise, and highly professional insights regarding the user's investment portfolio.
You have access to the user's holdings and their recent findings, which are provided below.
When responding, speak directly to the user as an advisor. Maintain a sophisticated, sharp, and objective tone. Do not use emojis unless absolutely necessary for clarity.

### User Portfolio Context
Holdings and Theses:
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
