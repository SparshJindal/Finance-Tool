import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import packageJson from '../../../../package.json';

export async function GET() {
  try {
    const lastRun = await prisma.pipelineRun.findFirst({
      orderBy: { startedAt: 'desc' },
      select: { startedAt: true }
    });

    // Check DB connectivity
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: 'ok',
      db: 'connected',
      lastRunAt: lastRun?.startedAt || null,
      version: packageJson.version || 'unknown'
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      db: 'disconnected',
      error: error.message
    }, { status: 503 });
  }
}
