import { PgBoss } from 'pg-boss';
import { config } from 'dotenv';
config();

const globalForBoss = globalThis as unknown as {
  boss: PgBoss | undefined;
};

let isStarted = false;

// Helper to reliably ensure boss is started before enqueueing
export async function getStartedBoss(): Promise<PgBoss> {
  if (!globalForBoss.boss) {
    globalForBoss.boss = new PgBoss(process.env.DATABASE_URL as string);
    globalForBoss.boss.on('error', (error: any) => console.error('[PgBoss] Error:', error));
  }

  const boss = globalForBoss.boss;

  if (!isStarted) {
    try {
      await boss.start();
      isStarted = true;
    } catch (e: any) {
      if (e.message && e.message.includes('already started')) {
        isStarted = true;
      } else {
        throw e;
      }
    }
    try {
      await boss.createQueue('ingest-holding');
      await boss.createQueue('ingest-cluster');
      await boss.createQueue('eval-falsifier');
    } catch (e: any) {
      if (e.message && e.message.includes('already exists')) {
        // Ignore
      }
    }
  }
  return boss;
}
