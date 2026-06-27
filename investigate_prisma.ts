import { config } from 'dotenv';
config();
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

async function investigate() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const users = await prisma.user.findMany();
    console.log(`Found ${users.length} users using Prisma:`, users.map(u => u.email));

    const specificUser = await prisma.user.findFirst({
      where: { email: { contains: 'sparshjindal' } }
    });
    console.log("Specific User:", specificUser);

    if (specificUser) {
      const holdings = await prisma.holding.findMany({
        where: { userId: specificUser.id },
        include: { questions: true }
      });
      console.log(`\nFound ${holdings.length} holdings.`);

      for (const h of holdings) {
        console.log(`\n================================`);
        console.log(`Holding: ${h.ticker} (${h.company})`);
        console.log(`Themes: ${h.themes}`);
        console.log(`Questions: ${h.questions.map(q => q.text).join(' | ')}`);
        
        const findings = await prisma.finding.findMany({
          where: { holdingId: h.id },
          include: { article: true }
        });
        console.log(`Findings: ${findings.length}`);
      }
    }
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}
investigate();
