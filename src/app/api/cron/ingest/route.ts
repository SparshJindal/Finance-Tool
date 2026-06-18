import { NextRequest, NextResponse } from 'next/server';
import { ingestNews } from '@/lib/pipeline';

export const maxDuration = 300; // Allow Vercel up to 5 minutes

export async function POST(request: NextRequest) {
  // Protect route with CRON_SECRET
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const result = await ingestNews();
    return NextResponse.json({ success: true, candidatesFound: (result as any)?.candidates?.length ?? 0 });
  } catch (error: any) {
    console.error('[API] Ingestion cron error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
