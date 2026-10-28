import { Pool } from 'pg';
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
if (!process.env.DATABASE_URL) throw new Error('Sett DATABASE_URL i .env.local');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query("SELECT pg_advisory_xact_lock(hashtext('vet-migrations'))");
  await client.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())',
  );
  for (const name of (await readdir('migrations')).filter((n) => n.endsWith('.sql')).sort()) {
    const content = await readFile(`migrations/${name}`, 'utf8');
    const checksum = createHash('sha256').update(content).digest('hex');
    const previous = await client.query('SELECT checksum FROM schema_migrations WHERE name=$1', [
      name,
    ]);
    if (previous.rowCount) {
      if (previous.rows[0].checksum !== checksum)
        throw new Error(`Migreringen ${name} er endret etter at den ble kjørt`);
      continue;
    }
    await client.query(content);
    await client.query('INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)', [
      name,
      checksum,
    ]);
    console.log(`Migrert: ${name}`);
  }
  await client.query('COMMIT');
  console.log('Databasen er oppdatert.');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();
  await pool.end();
}
