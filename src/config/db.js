const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DIRECT_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
});

pool.on('error', (e) => console.error('pg pool error', e.message));

module.exports = { pool, query: (t, p) => pool.query(t, p) };
