import { NextRequest, NextResponse } from 'next/server';
import { saveSubscription, removeSubscription } from '@/lib/push';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    await saveSubscription(body);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('[API] Subscribe error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    await removeSubscription(body.endpoint);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('[API] Unsubscribe error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
