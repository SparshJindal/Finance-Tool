import { prisma } from '../src/lib/db';

async function test() {
  const holdings = await prisma.holding.count();
  const questions = await prisma.question.count();
  const articles = await prisma.article.count();
  console.log(`Holdings: ${holdings}`);
  console.log(`Questions: ${questions}`);
  console.log(`Articles: ${articles}`);
}

test().catch(console.error).finally(() => process.exit(0));
