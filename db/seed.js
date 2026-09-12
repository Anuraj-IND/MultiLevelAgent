require('dotenv').config();
const { Pool } = require('pg');

// Seed after prisma migrate: departments, TOS v1, LG display-ID start at 12345.
async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await pool.query(
    `INSERT INTO departments(code,name) VALUES
     ('LIFE','Life'),('HEALTH','Health'),('MOTOR','Motor'),
     ('NON_MOTOR','Non-Motor'),('GROUP','Group'),('HR','HR'),
     ('ACCOUNTS','Accounts'),('CRM','CRM')
     ON CONFLICT (code) DO NOTHING`
  );
  await pool.query(
    `INSERT INTO tos_versions(version,text,text_hash) VALUES
     ('v1','Covermint LG Terms of Service (placeholder v1). By accepting you confirm details are true, you consent to KYC verification and data storage per company policy. Full legal text to be pasted by owner.','placeholder-v1')
     ON CONFLICT (version) DO NOTHING`
  );
  await pool.query(`SELECT setval('lgs_lg_seq_seq', GREATEST((SELECT COALESCE(MAX(lg_seq),12344) FROM lgs), 12344))`);
  console.log('seed ok');
  await pool.end();
}
main().catch((e) => { console.error('seed failed:', e.message); process.exit(1); });
