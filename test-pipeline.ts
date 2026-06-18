import 'dotenv/config';
import { ingestNews } from './src/lib/pipeline';
import { sendDigest } from './src/lib/email';

async function run() {
  console.log("=== Manually Triggering Pipeline ===");
  try {
    const { report, candidates } = await ingestNews();
    console.log("Pipeline Finished!", report);

    console.log("\\n=== Triggering Email Dispatch ===");
    const res = await sendDigest();
    console.log("Email Dispatch Finished!", res);
  } catch (e: any) {
    console.error("❌ Pipeline Error:", e.message);
  }
}

run();
