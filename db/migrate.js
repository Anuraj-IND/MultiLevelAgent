require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function main() {
  const conn = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!conn) throw new Error('Set DIRECT_URL or DATABASE_URL in .env');
  const pool = new Pool({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
  // Start LG display IDs at 12345 on fresh DB
  await pool.query(`SELECT setval('lgs_lg_seq_seq', GREATEST((SELECT COALESCE(MAX(lg_seq),12344) FROM lgs), 12344))`);
  console.log('migrate ok');
  await pool.end();
}
main().catch((e) => { console.error(e.message); process.exit(1); });
