import { NextRequest, NextResponse } from 'next/server';
import { sendDigest } from '@/lib/email';
import { generateDailyBrief } from '@/lib/providers/summary';
import { prisma } from '@/lib/db';

export const maxDuration = 300; // Allow Vercel up to 5 minutes
export const dynamic = 'force-dynamic';

function checkAuth(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const url = new URL(request.url);
  const secretParam = url.searchParams.get('secret');

  if (cronSecret) {
    return authHeader === `Bearer ${cronSecret}` || secretParam === cronSecret;
  }
  return process.env.NODE_ENV !== 'production';
}

async function handleDigest(request: Request) {
  if (!checkAuth(request)) {
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

      // Mark unread/undelivered findings for this user as delivered
      await prisma.finding.updateMany({
        where: { delivered: false, holding: { userId: user.id } },
        data: { delivered: true }
      });

      results.push({ email: user.email, result });
    }

    return NextResponse.json({ success: true, count: results.length, results });
  } catch (error: any) {
    console.error('[API] Digest cron error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handleDigest(request);
}

export async function POST(request: Request) {
  return handleDigest(request);
}
