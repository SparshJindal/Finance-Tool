import { config } from 'dotenv';
config({ path: '.env.production' });
import { Pool } from 'pg';

async function investigate() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    // 1. Find the User
    const userRes = await pool.query(`SELECT id, email FROM users WHERE email ILIKE '%sparshjindalextra%'`);
    if (userRes.rows.length === 0) {
      console.log("User not found via ILIKE. Listing all users:");
      const allUsers = await pool.query(`SELECT id, email FROM users`);
      allUsers.rows.forEach(u => console.log(u.email));
      return;
    }
    const userId = userRes.rows[0].id;
    console.log(`User found: ${userRes.rows[0].email} (ID: ${userId})`);

    // 2. Get Holdings
    const holdingsRes = await pool.query(`
      SELECT id, ticker, company, thesis, "directionLogic", aliases, themes 
      FROM holdings 
      WHERE user_id = $1
    `, [userId]);
    
    console.log(`\nFound ${holdingsRes.rows.length} holdings for user.`);

    for (const h of holdingsRes.rows) {
      console.log(`\n================================`);
      console.log(`Holding: ${h.ticker} (${h.company})`);
      console.log(`Aliases: ${h.aliases}`);
      console.log(`Themes: ${h.themes}`);
      console.log(`Thesis: ${h.thesis?.substring(0, 80)}...`);
      
      // 3. Get Questions
      const questionsRes = await pool.query(`SELECT id, text FROM questions WHERE holding_id = $1`, [h.id]);
      console.log(`Questions (${questionsRes.rows.length}):`);
      questionsRes.rows.forEach((q, i) => console.log(`  ${i+1}. ${q.text}`));

      // 4. Get Findings
      const findingsRes = await pool.query(`
        SELECT f.id, f.severity, f."direction", f.summary, a.title 
        FROM findings f
        JOIN articles a ON f.article_id = a.id
        WHERE f.holding_id = $1
      `, [h.id]);
      console.log(`Findings (${findingsRes.rows.length}):`);
      findingsRes.rows.forEach(f => {
        console.log(`  - [Sev ${f.severity}] [${f.direction}] ${f.title}`);
        console.log(`    Summary: ${f.summary.substring(0, 100)}...`);
      });
    }

  } catch (e) {
    console.error("Query failed:", e);
  } finally {
    await pool.end();
  }
}

investigate();
