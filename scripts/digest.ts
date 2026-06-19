import 'dotenv/config';
import { generateDailyBrief } from '../src/lib/providers/summary';
import { sendDigest } from '../src/lib/email';
import { prisma } from '../src/lib/db';

async function run() {
  console.log("=== Running Digest Generator ===");
  try {
    const users = await prisma.user.findMany();
    for (const user of users) {
      console.log(`=== Processing user ${user.email} ===`);
      const brief = await generateDailyBrief(user.id);
      
      if (brief) {
        const targetEmail = process.env.TEST_EMAIL || user.email;
        if (!targetEmail) {
          console.log(`=== No email for user ${user.id}, skipping email delivery. ===`);
          continue;
        }

        console.log("=== Sending Email Digest ===");
        await sendDigest(brief.userId, targetEmail);
        
        console.log("=== Marking Findings as Delivered ===");
        await prisma.finding.updateMany({
          where: { delivered: false, holding: { userId: user.id } },
          data: { delivered: true }
        });
      } else {
        console.log(`=== No brief generated for ${user.email} (no findings). ===`);
      }
    }
    
    console.log("=== Digest Job Finished ===");
    process.exit(0);
  } catch (e: any) {
    console.error("❌ Digest Error:", e);
    process.exit(1);
  }
}

run();
