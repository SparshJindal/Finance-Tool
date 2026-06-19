import { NextRequest, NextResponse } from 'next/server';
import { sendDigest } from '@/lib/email';
import { generateDailyBrief } from '@/lib/providers/summary';
import { prisma } from '@/lib/db';

export const maxDuration = 300; // Allow Vercel up to 5 minutes

export async function POST(request: NextRequest) {
  // Protect route with CRON_SECRET
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const users = await prisma.user.findMany({
      where: { email: { not: null } },
    });
    
    const results = [];
    for (const user of users) {
      if (!user.email) continue;
      await generateDailyBrief(user.id);
      const result = await sendDigest(user.id, user.email);
      results.push({ email: user.email, result });
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error('[API] Digest cron error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
