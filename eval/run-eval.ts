import { config } from 'dotenv';
config();
import fs from 'fs';
import path from 'path';
import { judgeHoldingArticles } from '../src/lib/providers/summary';

interface Fixture {
  ticker: string;
  exchange: string;
  company: string;
  thesis: string;
  directionLogic: string;
  articleTitle: string;
  articleBody: string;
  source: string;
  expected: {
    material: boolean;
    direction: "Supports" | "Threatens" | "Neutral" | "Mixed";
    entityCorrect: boolean;
  };
}

async function runEval() {
  const args = process.argv.slice(2);
  const thresholdFileIndex = args.indexOf('--threshold-file');
  const thresholdFile = thresholdFileIndex !== -1 ? args[thresholdFileIndex + 1] : null;

  const fixturesPath = path.join(__dirname, 'fixtures', 'articles.jsonl');
  const content = fs.readFileSync(fixturesPath, 'utf8');
  const lines = content.split('\n').filter(l => l.trim().length > 0);
  
  const fixtures: Fixture[] = lines.map(l => JSON.parse(l));

  let tp = 0; // True Positive (material)
  let fp = 0; // False Positive
  let fn = 0; // False Negative
  let tn = 0; // True Negative

  let directionCorrect = 0;
  let directionTotal = 0;

  let entityCorrectCount = 0;
  let entityTotal = 0;

  console.log(`Starting eval on ${fixtures.length} fixtures...\n`);

  for (let i = 0; i < fixtures.length; i++) {
    const fixture = fixtures[i];
    console.log(`Evaluating [${i + 1}/${fixtures.length}] ${fixture.ticker} - ${fixture.articleTitle.slice(0, 30)}...`);

    const holdingMock = {
      id: `hold-${i}`,
      ticker: fixture.ticker,
      company: fixture.company,
      thesis: fixture.thesis,
      directionLogic: fixture.directionLogic,
      questions: [],
      aliases: []
    };

    const articleMock = {
      id: `art-${i}`,
      title: fixture.articleTitle,
      excerpt: fixture.articleBody,
      url: `https://example.com/art-${i}`,
      source: fixture.source
    };

    // run the actual judge
    const results = await judgeHoldingArticles(holdingMock, [articleMock]);
    const pred = results[0];

    const predMaterial = pred ? !!pred.material : false;
    const predDirection = pred ? pred.direction : "Neutral";

    // Material detection
    if (fixture.expected.material && predMaterial) tp++;
    if (!fixture.expected.material && predMaterial) fp++;
    if (fixture.expected.material && !predMaterial) fn++;
    if (!fixture.expected.material && !predMaterial) tn++;

    // Direction accuracy (only evaluate if expected is material)
    if (fixture.expected.material) {
      directionTotal++;
      if (predMaterial && predDirection === fixture.expected.direction) {
        directionCorrect++;
      }
    }

    // Entity attribution accuracy (did it correctly identify if it's about the company?)
    // If the expected.entityCorrect is meant to test whether the LLM gets tricked:
    // e.g. expected.material = false for a confusable company. If LLM says false, entity is correct.
    entityTotal++;
    if (predMaterial === fixture.expected.material) {
      entityCorrectCount++;
    }
  }

  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
  const materialAccuracy = (tp + tn) / fixtures.length;
  
  const dirAccuracy = directionTotal > 0 ? directionCorrect / directionTotal : 0;
  const entityAccuracy = entityTotal > 0 ? entityCorrectCount / entityTotal : 0;

  console.log('\n--- EVALUATION RESULTS ---');
  console.table({
    "Material Precision": (precision * 100).toFixed(1) + '%',
    "Material Recall": (recall * 100).toFixed(1) + '%',
    "Material F1": (f1 * 100).toFixed(1) + '%',
    "Direction Accuracy": (dirAccuracy * 100).toFixed(1) + '%',
    "Entity Accuracy": (entityAccuracy * 100).toFixed(1) + '%'
  });

  const report = {
    precision,
    recall,
    f1,
    materialAccuracy,
    directionAccuracy: dirAccuracy,
    entityAccuracy,
    timestamp: new Date().toISOString()
  };

  fs.writeFileSync(path.join(__dirname, 'report.json'), JSON.stringify(report, null, 2));

  if (thresholdFile && fs.existsSync(thresholdFile)) {
    const thresholds = JSON.parse(fs.readFileSync(thresholdFile, 'utf8'));
    let failed = false;
    if (report.precision < thresholds.precision) { console.error(`❌ Precision ${report.precision} below threshold ${thresholds.precision}`); failed = true; }
    if (report.recall < thresholds.recall) { console.error(`❌ Recall ${report.recall} below threshold ${thresholds.recall}`); failed = true; }
    if (report.directionAccuracy < thresholds.directionAccuracy) { console.error(`❌ Direction Accuracy ${report.directionAccuracy} below threshold ${thresholds.directionAccuracy}`); failed = true; }
    if (report.entityAccuracy < thresholds.entityAccuracy) { console.error(`❌ Entity Accuracy ${report.entityAccuracy} below threshold ${thresholds.entityAccuracy}`); failed = true; }
    
    if (failed) {
      process.exit(1);
    } else {
      console.log('✅ All metrics passed thresholds.');
    }
  } else if (thresholdFile) {
    console.log(`⚠️ Threshold file ${thresholdFile} not found. Skipping threshold checks.`);
  }
}

runEval().catch(err => {
  console.error("Eval failed:", err);
  process.exit(1);
});
