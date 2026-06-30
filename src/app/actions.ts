'use server'

import { prisma } from '@/lib/db'
import { auth, signOut } from '@/auth'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { getCompanyProfile, getPeers } from '@/lib/providers/finnhub'
import { generateWatchQuestions, batchGenerateWatchQuestions } from '@/lib/providers/gemini'
import { ingestNews } from '@/lib/pipeline'
import { askAI } from '@/lib/providers/ai'
import { Type } from '@google/genai'
import { generateHoldingProfile } from '@/lib/providers/profile'

async function populateHoldingProfile(holdingId: string, ticker: string, company: string, thesis: string, directionLogic: string) {
  try {
    const profile = await generateHoldingProfile({ ticker, company, thesis, directionLogic });
    
    const updateData: any = { 
      themes: profile.themes,
      aliases: profile.aliases,
    };
    
    // Backfill thesis if it was empty, but NEVER overwrite the user's directionLogic
    if (!thesis || thesis.trim() === '') {
      updateData.thesis = profile.thesis;
    }
    
    await prisma.holding.update({
      where: { id: holdingId },
      data: updateData
    });

    if (profile.competitors && profile.competitors.length > 0) {
      const cleanHoldingTicker = ticker.split('.')[0].toUpperCase();
      const cleanHoldingName = company.toLowerCase().replace(/\b(inc|ltd|corp|corporation|llc|plc)\b\.?/gi, '').trim();

      const sanitizedComps = profile.competitors.filter(c => {
        if (!c.name || !c.name.trim()) return false;
        
        const cleanCompTicker = (c.ticker || "").split('.')[0].toUpperCase();
        const cleanCompName = c.name.toLowerCase().replace(/\b(inc|ltd|corp|corporation|llc|plc)\b\.?/gi, '').trim();

        if (cleanCompTicker && cleanCompTicker === cleanHoldingTicker) return false;
        if (cleanCompName === cleanHoldingName) return false;
        if (cleanCompName.includes(cleanHoldingName) || cleanHoldingName.includes(cleanCompName)) return false; // Extra safety
        
        return true;
      }).map(c => {
        let validTicker = (c.ticker || "").trim().toUpperCase();
        if (validTicker && !/^[A-Z0-9.\-]{1,12}$/.test(validTicker)) {
          validTicker = "";
        }
        return { name: c.name.trim(), ticker: validTicker };
      });

      const uniqueComps = Array.from(new Map(sanitizedComps.map(c => [c.name.toLowerCase(), c])).values());
      
      for (const comp of uniqueComps) {
        await prisma.competitor.create({
          data: {
            holdingId,
            name: comp.name,
            ticker: comp.ticker
          }
        });
      }
    }
  } catch (e) {
    console.error(`[populateHoldingProfile] Failed for ${ticker}:`, e);
  }
}

const holdingSchema = z.object({
  id: z.string().optional(),
  ticker: z.string().min(1, 'Ticker is required').toUpperCase(),
  company: z.string().min(1, 'Company name is required'),
  exchange: z.string().default('US'),
  thesis: z.string().min(1, 'Thesis is required'),
  directionLogic: z.string().default('LONG'),
  kind: z.string().default('PORTFOLIO')
})

export async function addHolding(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  const userId = session.user.id

  const result = holdingSchema.safeParse({
    ticker: formData.get('ticker'),
    company: formData.get('company'),
    exchange: formData.get('exchange') || 'US',
    thesis: formData.get('thesis'),
    directionLogic: formData.get('directionLogic'),
    kind: formData.get('kind') || 'PORTFOLIO'
  })

  if (!result.success) {
    return { error: result.error.issues[0].message }
  }

  try {
    const holding = await prisma.holding.create({
      data: {
        userId,
        ticker: result.data.ticker,
        company: result.data.company,
        exchange: result.data.exchange,
        themes: [],
        thesis: result.data.thesis,
        directionLogic: result.data.directionLogic,
        kind: result.data.kind
      }
    })
    
    // Asynchronously or awaited populate profile (must not fail creation)
    await populateHoldingProfile(holding.id, holding.ticker, holding.company, holding.thesis, holding.directionLogic);
    
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
    directionLogic: formData.get('directionLogic'),
    kind: formData.get('kind') || 'PORTFOLIO'
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
        directionLogic: result.data.directionLogic,
        kind: result.data.kind
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

    await prisma.finding.deleteMany({ where: { holdingId: id } })
    await prisma.question.deleteMany({ where: { holdingId: id } })
    await prisma.competitor.deleteMany({ where: { holdingId: id } })
    
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

export async function deleteAllHoldings(formData?: FormData) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  const userId = session.user.id

  try {
    const holdings = await prisma.holding.findMany({ where: { userId }, select: { id: true } })
    const holdingIds = holdings.map(h => h.id)
    if (holdingIds.length > 0) {
      await prisma.finding.deleteMany({ where: { holdingId: { in: holdingIds } } })
      await prisma.question.deleteMany({ where: { holdingId: { in: holdingIds } } })
      await prisma.competitor.deleteMany({ where: { holdingId: { in: holdingIds } } })
      await prisma.holding.deleteMany({ where: { id: { in: holdingIds } } })
    }
    revalidatePath('/dashboard')
    return { success: true }
  } catch (err) {
    console.error("Failed to delete entire portfolio:", err)
    return { error: 'Failed to delete entire portfolio' }
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

export async function studyBatchHoldings(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  const userId = session.user.id

  const idsJson = formData.get('ids') as string
  if (!idsJson) return { error: 'No IDs provided' }
  
  try {
    const ids = JSON.parse(idsJson) as string[]
    if (ids.length === 0) return { success: true }

    const holdings = await prisma.holding.findMany({ 
      where: { userId, id: { in: ids } } 
    })
    
    if (holdings.length === 0) return { error: 'Holdings not found' }

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
        thesis: h.thesis || '',
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

    const batchResults = await batchGenerateWatchQuestions(holdingsData).catch(() => [])
    const allQuestionsToInsert: any[] = []
    
    if (batchResults && Array.isArray(batchResults)) {
      for (const result of batchResults) {
        const holdingId = holdingsData.find(h => h.ticker === result.ticker)?.id
        if (holdingId && result.questions && Array.isArray(result.questions)) {
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

    // Fallback: If any holding was missed by the batch LLM call, generate them individually
    for (const h of holdingsData) {
      const isMissing = !allQuestionsToInsert.some(q => q.holdingId === h.id)
      if (isMissing) {
        const fallbackQuestions = await generateWatchQuestions(h.company, h.thesis, h.sector, h.competitors).catch(() => [])
        if (fallbackQuestions && Array.isArray(fallbackQuestions)) {
          fallbackQuestions.forEach(q => {
            allQuestionsToInsert.push({
              holdingId: h.id,
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
    return { error: 'Batch study failed' }
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

export async function triggerNewsIngestionPhase1(formData?: FormData) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  const userId = session.user.id

  const idsJson = formData?.get('ids') as string | undefined
  let targetHoldingIds = idsJson ? JSON.parse(idsJson) as string[] : undefined
  const skipHeavyApis = formData?.get('skipHeavyApis') === 'true'
  
  let remainingCount = 0;

  try {
    const batchSize = parseInt(process.env.BATCH_SIZE || "5", 10);

    if (!targetHoldingIds || targetHoldingIds.length === 0) {
      let holdings = await prisma.holding.findMany({
        where: { userId, lastIngestedAt: null },
        take: batchSize,
        select: { id: true }
      });

      if (holdings.length < batchSize) {
        const moreHoldings = await prisma.holding.findMany({
          where: { userId, lastIngestedAt: { not: null } },
          orderBy: { lastIngestedAt: 'asc' },
          take: batchSize - holdings.length,
          select: { id: true }
        });
        holdings = holdings.concat(moreHoldings);
      }

      if (holdings.length === 0) {
        return { success: true, processed: 0, remain: 0, report: null };
      }

      targetHoldingIds = holdings.map(h => h.id);
      
      const totalHoldings = await prisma.holding.count({ where: { userId } });
      remainingCount = Math.max(0, totalHoldings - targetHoldingIds.length);
    } else {
      const originalLength = targetHoldingIds.length;
      targetHoldingIds = targetHoldingIds.slice(0, batchSize);
      remainingCount = Math.max(0, originalLength - targetHoldingIds.length);
    }

    const result = await ingestNews(userId, false, targetHoldingIds, skipHeavyApis) // Skip evaluation
    
    const report = (result as any)?.report || null
    
    console.log(`[ingestNews] Saved ${report?.findingsSaved || 0} findings across ${report?.totalHoldingsProcessed || 0} holdings.`);

    revalidatePath('/dashboard')
    
    if (report?.quotaExhausted) {
      return { success: false, error: 'LLM_QUOTA_EXHAUSTED' }
    }
    
    return { 
      success: true, 
      processed: targetHoldingIds?.length || 0,
      remain: remainingCount,
      report 
    }
  } catch (err) {
    console.error(err)
    return { error: 'Phase 1 failed' }
  }
}

export async function triggerNewsIngestionPhase2(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const candidatesJson = formData.get('candidates') as string
  if (!candidatesJson) return { error: 'No candidates provided' }
  
  try {
    // Phase 2 is now deprecated as Phase 1 (ingestNews) handles the entire unified pipeline.
    console.log('[Phase 2] Skipping deprecated Phase 2 call. Evaluation is now handled directly during ingestion.');
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
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().optional().or(z.literal('')),
  nationality: z.string().optional().or(z.literal('')),
})

export async function signUp(formData: FormData) {
  const result = signUpSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    phone: formData.get('phone'),
    nationality: formData.get('nationality'),
  })

  if (!result.success) {
    return { error: result.error.issues[0]?.message || 'Validation failed' }
  }

  const { email, password, firstName, lastName, phone, nationality } = result.data

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return { error: 'A user with this email already exists' }
    }

    const passwordHash = await bcrypt.hash(password, 10)

    const fullName = `${firstName} ${lastName}`.trim()

    await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName,
        phone: phone || null,
        nationality: nationality || null,
        name: fullName,
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

const updateProfileSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().optional().or(z.literal('')),
  nationality: z.string().optional().or(z.literal('')),
})

export async function updateProfile(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const result = updateProfileSchema.safeParse({
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    phone: formData.get('phone'),
    nationality: formData.get('nationality'),
  })

  if (!result.success) {
    return { error: result.error.issues[0]?.message || 'Validation failed' }
  }

  const { firstName, lastName, phone, nationality } = result.data
  const fullName = `${firstName} ${lastName}`.trim()

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        firstName,
        lastName,
        phone: phone || null,
        nationality: nationality || null,
        name: fullName,
      },
    })

    revalidatePath('/dashboard')
    return { success: true }
  } catch (err: any) {
    console.error("[updateProfile] Database error:", err)
    return { error: `Database Error: ${err.message || 'Failed to update profile'}` }
  }
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

export async function importHoldings(holdings: { ticker: string, company: string, exchange?: string, thesis?: string, directionLogic?: string }[]) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  const userId = session.user.id

  let imported = 0
  let skipped = 0
  const newlyCreatedHoldings: any[] = []

  for (const h of holdings) {
    if (!h.ticker) continue

    const existing = await prisma.holding.findFirst({
      where: { userId, ticker: h.ticker }
    })
    
    if (existing) {
      skipped++
      continue
    }
    
    const holding = await prisma.holding.create({
      data: {
        userId,
        ticker: h.ticker,
        company: h.company || h.ticker,
        exchange: h.exchange || 'US',
        thesis: h.thesis || '',
        directionLogic: h.directionLogic || 'LONG'
      }
    })
    
    newlyCreatedHoldings.push(holding)
    imported++
  }

  // Fire and forget sequential profile population in the background
  Promise.resolve().then(async () => {
    for (const holding of newlyCreatedHoldings) {
      await populateHoldingProfile(holding.id, holding.ticker, holding.company, holding.thesis, holding.directionLogic);
    }
  }).catch(e => console.error('[importHoldings] Background profile generation failed:', e));
  
  
  revalidatePath('/dashboard')
  return { imported, skipped }
}

