import { NextRequest, NextResponse } from 'next/server';
import { sendPushAlert } from '@/lib/push';

const rateLimitMap = new Map<string, { count: number, timestamp: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const limit = 3; // 3 requests per minute for test notifications

  const record = rateLimitMap.get(ip);
  if (!record || (now - record.timestamp > windowMs)) {
    rateLimitMap.set(ip, { count: 1, timestamp: now });
    return false;
  }
  if (record.count >= limit) return true;
  record.count += 1;
  return false;
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    await sendPushAlert({
      title: '🔴 coranto Test',
      body: 'This is a test push notification. Your alerts are working!',
    });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('[API] Test push error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
