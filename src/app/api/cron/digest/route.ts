import { NextRequest, NextResponse } from 'next/server';
import { sendDigest } from '@/lib/email';
import { generateDailyBrief } from '@/lib/providers/summary';

export const maxDuration = 300; // Allow Vercel up to 5 minutes

export async function POST(request: NextRequest) {
  // Protect route with CRON_SECRET
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    await generateDailyBrief();
    const result = await sendDigest();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API] Digest cron error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
