import { Pool } from 'pg';
import { readFile, appendFile } from 'node:fs/promises';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL mangler');
const url = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1'].includes(url.hostname))
  throw new Error('Dette hjelpeprogrammet oppretter bare lokale testdatabaser');
const pool = new Pool({ connectionString: url.toString() });
try {
  const lines = [];
  for (const [name, variable] of [
    ['vet_test', 'TEST_DATABASE_URL'],
    ['vet_e2e_test', 'E2E_DATABASE_URL'],
  ]) {
    try {
      await pool.query(`CREATE DATABASE ${name}`);
    } catch (e) {
      if ((e as { code: string }).code !== '42P04') throw e;
    }
    const testUrl = new URL(url);
    testUrl.pathname = `/${name}`;
    const content = await readFile('.env.local', 'utf8');
    if (!new RegExp(`^${variable}=`, 'm').test(content)) lines.push(`${variable}=${testUrl}`);
  }
  if (lines.length) await appendFile('.env.local', `\n${lines.join('\n')}\n`);
  console.log('Isolerte lokale testdatabaser er opprettet. Testene tømmer bare disse databasene.');
} finally {
  await pool.end();
}
