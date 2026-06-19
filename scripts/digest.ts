import 'dotenv/config';
import { generateDailyBrief } from '../src/lib/providers/summary';
import { sendDigest } from '../src/lib/email';
import { prisma } from '../src/lib/db';

async function run() {
  console.log("=== Running Digest Generator ===");
  try {
    const brief = await generateDailyBrief();
    
    if (brief) {
      console.log("=== Sending Email Digest ===");
      await sendDigest(process.env.TEST_EMAIL || 'test@example.com', brief);
      
      console.log("=== Marking Findings as Delivered ===");
      await prisma.finding.updateMany({
        where: { delivered: false },
        data: { delivered: true }
      });
    } else {
      console.log("=== No brief generated (no findings). ===");
    }
    
    console.log("=== Digest Job Finished ===");
    process.exit(0);
  } catch (e: any) {
    console.error("❌ Digest Error:", e);
    process.exit(1);
  }
}

run();
