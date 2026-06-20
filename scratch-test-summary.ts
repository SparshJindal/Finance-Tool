import { prisma } from './src/lib/db';
import { ingestNews } from './src/lib/pipeline';

async function test() {
  const user = await prisma.user.findFirst();
  if (!user) return console.log("No user found locally");
  
  console.log("Running pipeline for user", user.id);
  await ingestNews(user.id);
  
  const findings = await prisma.finding.count({ where: { holding: { userId: user.id } } });
  console.log("Total Findings in DB:", findings);
}
test();
