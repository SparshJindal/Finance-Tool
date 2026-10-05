import { NextRequest, NextResponse } from 'next/server';
import { ingestNews } from '@/lib/pipeline';

export const maxDuration = 300; // Allow Vercel up to 5 minutes
export const dynamic = 'force-dynamic';

function checkAuth(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const url = new URL(request.url);
  const secretParam = url.searchParams.get('secret');

  // If CRON_SECRET is set, require either Bearer token or ?secret= query param
  if (cronSecret) {
    return authHeader === `Bearer ${cronSecret}` || secretParam === cronSecret;
  }
  // In development without CRON_SECRET, allow testing
  return process.env.NODE_ENV !== 'production';
}

async function handleIngest(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[Cron/Ingest] Starting automated 8:00 AM IST news ingestion...');
  const startTime = Date.now();

  try {
    const report = await ingestNews();
    const findingsSaved = report.results.reduce((sum, r) => sum + r.findingsAdded, 0);
    const durationSeconds = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`[Cron/Ingest] Completed in ${durationSeconds}s. Processed ${report.results.length} holdings, saved ${findingsSaved} findings.`);

    return NextResponse.json({
      success: true,
      durationSeconds,
      holdingsProcessed: report.results.length,
      findingsSaved,
      results: report.results.map(r => ({
        ticker: r.ticker,
        status: r.status,
        findingsAdded: r.findingsAdded,
        reason: r.reason
      }))
    });
  } catch (error: any) {
    console.error('[Cron/Ingest] Pipeline failed:', error);
    return NextResponse.json({ error: error.message || 'Pipeline execution failed' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handleIngest(request);
}

export async function POST(request: Request) {
  return handleIngest(request);
}
