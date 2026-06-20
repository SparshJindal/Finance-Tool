'use server'

import { prisma } from '@/lib/db'
import { auth, signOut } from '@/auth'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { getCompanyProfile, getPeers } from '@/lib/providers/finnhub'
import { generateWatchQuestions, batchGenerateWatchQuestions } from '@/lib/providers/gemini'
import { ingestNews } from '@/lib/pipeline'
import { evaluateCandidates } from '@/lib/providers/summary'

const holdingSchema = z.object({
  id: z.string().optional(),
  ticker: z.string().min(1, 'Ticker is required').toUpperCase(),
  company: z.string().min(1, 'Company name is required'),
  thesis: z.string().min(1, 'Thesis is required'),
  directionLogic: z.string().default('LONG')
})

export async function addHolding(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  const userId = session.user.id

  const result = holdingSchema.safeParse({
    ticker: formData.get('ticker'),
    company: formData.get('company'),
    thesis: formData.get('thesis'),
    directionLogic: formData.get('directionLogic')
  })

  if (!result.success) {
    return { error: result.error.issues[0].message }
  }

  try {
    await prisma.holding.create({
      data: {
        userId,
        ticker: result.data.ticker,
        company: result.data.company,
        thesis: result.data.thesis,
        directionLogic: result.data.directionLogic
      }
    })
    revalidatePath('/dashboard')
    return { success: true }
  } catch (err) {
    console.error(err)
    return { error: 'Failed to add holding' }
  }
}

export async function updateHolding(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  const userId = session.user.id

  const result = holdingSchema.safeParse({
    id: formData.get('id'),
    ticker: formData.get('ticker'),
    company: formData.get('company'),
    thesis: formData.get('thesis'),
    directionLogic: formData.get('directionLogic')
  })

  if (!result.success) {
    return { error: result.error.issues[0].message }
  }
  
  if (!result.data.id) {
    return { error: 'Holding ID is missing' }
  }

  try {
    // Only update if userId is 'me'
    const existing = await prisma.holding.findFirst({
      where: { id: result.data.id, userId }
    })
    if (!existing) return { error: 'Not found' }

    await prisma.holding.update({
      where: { id: result.data.id },
      data: {
        ticker: result.data.ticker,
        company: result.data.company,
        thesis: result.data.thesis,
        directionLogic: result.data.directionLogic
      }
    })
    revalidatePath('/dashboard')
    return { success: true }
  } catch (err) {
    console.error(err)
    return { error: 'Failed to update holding' }
  }
}

export async function deleteHolding(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  const userId = session.user.id

  const id = formData.get('id') as string
  if (!id) return { error: 'Invalid ID' }

  try {
    const existing = await prisma.holding.findFirst({
      where: { id, userId }
    })
    if (!existing) return { error: 'Not found' }

    await prisma.holding.delete({
      where: { id }
    })
    revalidatePath('/dashboard')
    return { success: true }
  } catch (err) {
    console.error(err)
    return { error: 'Failed to delete holding' }
  }
}

export async function studyHolding(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  const userId = session.user.id

  const id = formData.get('id') as string
  if (!id) return { error: 'Invalid ID' }

  try {
    const holding = await prisma.holding.findFirst({
      where: { id, userId }
    })
    if (!holding) return { error: 'Holding not found' }

    const profile = await getCompanyProfile(holding.ticker)
    const sector = profile.finnhubIndustry || 'Unknown'
    const peers = await getPeers(holding.ticker)
    const competitors = peers.filter(p => p !== holding.ticker).slice(0, 5)

    await prisma.holding.update({
      where: { id },
      data: { sector }
    })

    await prisma.competitor.deleteMany({ where: { holdingId: id } })
    await prisma.question.deleteMany({ where: { holdingId: id } })

    if (competitors.length > 0) {
      await prisma.competitor.createMany({
        data: competitors.map(c => ({
          holdingId: id,
          name: c,
          ticker: c
        }))
      })
    }

    const questions = await generateWatchQuestions(
      holding.company,
      holding.thesis,
      sector,
      competitors
    ).catch(() => [])

    if (questions && questions.length > 0) {
      await prisma.question.createMany({
        data: questions.map(q => ({
          holdingId: id,
          category: q.category,
          text: q.text
        }))
      })
    }

    revalidatePath('/dashboard')
    return { success: true }
  } catch (err) {
    console.error(err)
    return { error: 'Study failed' }
  }
}

export async function studyAllHoldings() {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  const userId = session.user.id

  try {
    const holdings = await prisma.holding.findMany({ where: { userId } })
    if (holdings.length === 0) return { error: 'No holdings to study' }

    const holdingsData = []
    const allCompetitorsToInsert: any[] = []

    for (const h of holdings) {
      const profile = await getCompanyProfile(h.ticker)
      const sector = profile.finnhubIndustry || 'Unknown'
      
      await new Promise(resolve => setTimeout(resolve, 200)) // Rate limit buffer
      
      const peers = await getPeers(h.ticker)
      const competitors = peers.filter((p: string) => p !== h.ticker).slice(0, 5)

      await prisma.holding.update({
        where: { id: h.id },
        data: { sector }
      })

      holdingsData.push({
        id: h.id,
        ticker: h.ticker,
        company: h.company,
        thesis: h.thesis,
        sector,
        competitors
      })

      competitors.forEach((c: string) => {
        allCompetitorsToInsert.push({ holdingId: h.id, name: c, ticker: c })
      })

      await new Promise(resolve => setTimeout(resolve, 200)) // Rate limit buffer
    }

    const holdingIds = holdings.map(h => h.id)
    await prisma.competitor.deleteMany({ where: { holdingId: { in: holdingIds } } })
    await prisma.question.deleteMany({ where: { holdingId: { in: holdingIds } } })

    if (allCompetitorsToInsert.length > 0) {
      await prisma.competitor.createMany({ data: allCompetitorsToInsert })
    }

    const batchResults = await batchGenerateWatchQuestions(holdingsData)
    const allQuestionsToInsert: any[] = []
    
    if (batchResults && Array.isArray(batchResults)) {
      for (const result of batchResults) {
      const holdingId = holdingsData.find(h => h.ticker === result.ticker)?.id
      if (holdingId && result.questions) {
        result.questions.forEach((q: any) => {
          allQuestionsToInsert.push({
            holdingId,
            category: q.category,
            text: q.text
          })
        })
      }
      }
    }

    if (allQuestionsToInsert.length > 0) {
      await prisma.question.createMany({ data: allQuestionsToInsert })
    }

    revalidatePath('/dashboard')
    return { success: true }
  } catch (err) {
    console.error(err)
    return { error: 'Study All failed' }
  }
}

export async function triggerNewsIngestionPhase1() {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  const userId = session.user.id

  try {
    const result = await ingestNews(userId, false) // Skip evaluation
    const candidates = (result as any)?.candidates || []
    console.log("Found Candidates:", candidates.length)
    return { success: true, candidates }
  } catch (err) {
    console.error(err)
    return { error: 'Phase 1 failed' }
  }
}

export async function triggerNewsIngestionPhase2(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const candidateJson = formData.get('candidate') as string
  if (!candidateJson) return { error: 'No candidate provided' }
  
  try {
    const candidate = JSON.parse(candidateJson)
    await evaluateCandidates([candidate])
    revalidatePath('/dashboard')
    return { success: true }
  } catch (err) {
    console.error(err)
    return { error: 'Phase 2 failed' }
  }
}

import { sendDigest } from '@/lib/email'
import { generateDailyBrief } from '@/lib/providers/summary'

export async function triggerSendDigest() {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.email) throw new Error("Unauthorized or missing email")
  const userId = session.user.id
  const email = session.user.email

  try {
    await generateDailyBrief(userId)
    const res = await sendDigest(userId, email)
    return res
  } catch (err: any) {
    console.error(err)
    return { success: false, error: err.message }
  }
}

const signUpSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
})

export async function signUp(formData: FormData) {
  const result = signUpSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!result.success) {
    return { error: result.error.issues[0]?.message || 'Validation failed' }
  }

  const { email, password } = result.data

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return { error: 'A user with this email already exists' }
    }

    const passwordHash = await bcrypt.hash(password, 10)

    await prisma.user.create({
      data: {
        email,
        passwordHash,
      },
    })

    return { success: true }
  } catch (err: any) {
    console.error("[signUp] Database error:", err)
    return { error: `Database Error: ${err.message || 'Failed to connect'}` }
  }
}

export async function logOut() {
  await signOut()
}

export async function submitFindingFeedback(findingId: string, feedback: 'up' | 'down' | null) {
  try {
    await prisma.finding.update({
      where: { id: findingId },
      data: { feedback }
    })
    revalidatePath('/dashboard')
    return { success: true }
  } catch (err) {
    console.error(err)
    return { error: 'Failed to update feedback' }
  }
}

export async function importHoldings(holdings: { ticker: string, company: string }[]) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  const userId = session.user.id

  let imported = 0
  let skipped = 0

  for (const h of holdings) {
    if (!h.ticker) continue

    const existing = await prisma.holding.findFirst({
      where: { userId, ticker: h.ticker }
    })
    
    if (existing) {
      skipped++
      continue
    }
    
    await prisma.holding.create({
      data: {
        userId,
        ticker: h.ticker,
        company: h.company || h.ticker,
        thesis: '',
        directionLogic: 'LONG'
      }
    })
    imported++
  }
  
  revalidatePath('/dashboard')
  return { imported, skipped }
}
