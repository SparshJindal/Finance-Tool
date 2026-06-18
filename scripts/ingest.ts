import 'dotenv/config';
import { ingestNews } from '../src/lib/pipeline';

async function run() {
  console.log("=== Running Ingest Pipeline ===");
  try {
    await ingestNews();
    console.log("=== Ingest Pipeline Finished ===");
    process.exit(0);
  } catch (e: any) {
    console.error("❌ Pipeline Error:", e);
    process.exit(1);
  }
}

run();
