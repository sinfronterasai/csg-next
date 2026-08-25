// Idempotent DB migration runner for the Cosmic Profile Hub.
// Applies src/lib/profile/migration.sql safely:
//  - strips SQL comments so statements are never split on ';' inside a comment
//  - respects $$ dollar-quoted strings (used in DO blocks)
//  - runs each statement in its OWN autocommit query (pg default), so
//    CREATE INDEX CONCURRENTLY is never wrapped in a transaction block
//  - every DDL uses IF NOT EXISTS / IF EXISTS guards, so re-running is a no-op
import { Pool } from 'pg';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlPath = join(__dirname, '..', 'src', 'lib', 'profile', 'migration.sql');
const sql = readFileSync(sqlPath, 'utf8');

const noBlock = sql.replace(/\/\*[\s\S]*?\*\//g, ' ');
const noLine = noBlock.replace(/--[^\n]*/g, ' ');

// Split on ';' but respect $$ dollar-quoted strings (used in DO blocks)
const statements = [];
let current = '';
let inDollarQuote = false;

for (let i = 0; i < noLine.length; i++) {
  const char = noLine[i];
  const next = noLine[i + 1];

  // Detect $$ delimiter
  if (char === '$' && next === '$') {
    inDollarQuote = !inDollarQuote;
    current += char + next;
    i++; // skip next $
  } else if (char === ';' && !inDollarQuote) {
    // End of statement
    const stmt = current.trim();
    if (stmt.length > 0) {
      statements.push(stmt);
    }
    current = '';
  } else {
    current += char;
  }
}

// Handle last statement if no trailing semicolon
const lastStmt = current.trim();
if (lastStmt.length > 0) {
  statements.push(lastStmt);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

let ok = 0;
let fail = 0;
for (const stmt of statements) {
  try {
    await pool.query(stmt);
    ok++;
  } catch (e) {
    fail++;
    console.error('MIGRATION STATEMENT FAILED:', stmt.slice(0, 60), '->', e.message);
  }
}

const res = await pool.query(
  `SELECT column_name FROM information_schema.columns
    WHERE table_name = 'readings'
      AND column_name IN ('pipeline_status', 'pipeline_callback_hash', 'share_token')
    ORDER BY column_name`,
);
console.log(`Migration applied: ${ok} ok, ${fail} failed.`);
console.log('readings columns present:', res.rows.map((r) => r.column_name).join(', '));
await pool.end();
process.exit(fail === 0 ? 0 : 1);
