import { getPool } from '../src/lib/server/db';
const pool = getPool();
try {
  const result = await pool.query(
    "SELECT (SELECT count(*)::int FROM clinics) AS clinics, (SELECT count(*)::int FROM offers) AS offers, (SELECT count(*)::int FROM proposals WHERE status='pending') AS pending",
  );
  console.log('Databaseforbindelse og skjema OK:', result.rows[0]);
} finally {
  await pool.end();
}
