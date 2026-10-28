import { collectSource } from '../src/lib/collector/run';
import { getPool } from '../src/lib/server/db';
const pool = getPool();
try {
  const sources = await pool.query('SELECT id FROM sources WHERE enabled=true ORDER BY id');
  if (!sources.rowCount) {
    console.error(
      'Ingen aktiverte, verifiserte kilder. Se docs/pilot.md og source:register. Ingen nettsider er besøkt.',
    );
    process.exitCode = 1;
  } else {
    const contact = process.env.COLLECTOR_CONTACT;
    if (!contact)
      throw new Error('COLLECTOR_CONTACT mangler. Sett en ekte kontaktadresse i .env.local.');
    for (const { id } of sources.rows) {
      try {
        console.log(id, await collectSource(id, contact));
      } catch (e) {
        console.error(id, e instanceof Error ? e.message : 'Innhenting feilet');
        process.exitCode = 1;
      }
    }
  }
} finally {
  await pool.end();
}
