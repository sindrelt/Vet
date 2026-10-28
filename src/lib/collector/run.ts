import { getPool } from '../server/db';
import { propose } from '../server/review';
import { extractHtml } from './adapters/html-table';
import { extractPdf } from './adapters/pdf-lines';
import { adapterConfigSchema } from './config';
import { checkRobots, fetchDocument } from './fetch';
export async function collectSource(sourceId: string, contact: string) {
  const pool = getPool();
  const lock = await pool.connect();
  let locked = false;
  try {
    const result = await lock.query('SELECT pg_try_advisory_lock(hashtext($1)) AS locked', [
      `collector:${sourceId}`,
    ]);
    locked = result.rows[0].locked;
    if (!locked) throw new Error('En innhenting av denne kilden kjører allerede');
    const {
      rows: [source],
    } = await lock.query('SELECT * FROM sources WHERE id=$1 AND enabled=true', [sourceId]);
    if (!source) throw new Error('Kilden finnes ikke eller er deaktivert');
    await lock.query('UPDATE sources SET last_attempt_at=now() WHERE id=$1', [sourceId]);
    try {
      if (Date.now() - new Date(source.terms_reviewed_at).getTime() > 90 * 86400000)
        throw new Error('Bruksvilkår må kontrolleres på nytt (eldre enn 90 dager)');
      const config = adapterConfigSchema.parse(source.config);
      await checkRobots(source.url, contact);
      const document = await fetchDocument(source.url, contact);
      const isPdf = document.contentType.includes('application/pdf');
      if ((source.adapter === 'pdf-lines') !== isPdf) throw new Error('Kildens filtype er endret');
      if (!isPdf && !document.contentType.includes('text/html')) throw new Error('Forventet HTML');
      // Extract and validate every expected row before writing any proposal.
      const rows = isPdf
        ? await extractPdf(document.bytes, config, source.url)
        : extractHtml(document.bytes.toString('utf8'), config, source.url);
      const fetchedAt = new Date();
      const statuses: string[] = [];
      for (const row of rows)
        statuses.push(
          await propose({
            clinicId: source.clinic_id,
            sourceId,
            treatmentId: row.treatmentId,
            snapshot: row.snapshot,
            fetchedAt,
          }),
        );
      await lock.query('UPDATE sources SET last_success_at=$2,last_error=NULL WHERE id=$1', [
        sourceId,
        fetchedAt,
      ]);
      return statuses;
    } catch (e) {
      // Do not store remote HTML, response bodies, credentials or arbitrary error URLs.
      const message =
        e instanceof Error && !/https?:|postgres|password|token/i.test(e.message)
          ? e.message.slice(0, 350)
          : 'Innhenting feilet. Kontroller nettverk, kildeformat og vilkår.';
      await lock.query('UPDATE sources SET last_error=$2 WHERE id=$1', [sourceId, message]);
      throw new Error(message);
    }
  } finally {
    if (locked)
      await lock.query('SELECT pg_advisory_unlock(hashtext($1))', [`collector:${sourceId}`]);
    lock.release();
  }
}
