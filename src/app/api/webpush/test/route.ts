import { NextResponse } from 'next/server';
import { sendPushAlert } from '@/lib/push';

export async function POST() {
  try {
    await sendPushAlert({
      title: '🔴 Disruption Radar Test',
      body: 'This is a test push notification. Your alerts are working!',
    });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('[API] Test push error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
