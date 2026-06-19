import { NextRequest, NextResponse } from 'next/server';
import { saveSubscription, removeSubscription } from '@/lib/push';
import { z } from 'zod';

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string()
  })
});

const rateLimitMap = new Map<string, { count: number, timestamp: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const limit = 5; // 5 requests per minute

  const record = rateLimitMap.get(ip);
  if (!record || (now - record.timestamp > windowMs)) {
    rateLimitMap.set(ip, { count: 1, timestamp: now });
    return false;
  }
  if (record.count >= limit) return true;
  record.count += 1;
  return false;
}

import { auth } from '@/auth';

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const result = subscriptionSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    await saveSubscription(session.user.id, result.data);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('[API] Subscribe error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    if (!body.endpoint) {
      return NextResponse.json({ error: 'Endpoint missing' }, { status: 400 });
    }
    await removeSubscription(body.endpoint);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('[API] Unsubscribe error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
