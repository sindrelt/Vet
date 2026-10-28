import { createHash, randomUUID } from 'node:crypto';
import { getPool } from './db';
import { snapshotSchema, type Snapshot } from '../domain';
export function snapshotHash(snapshot: Snapshot) {
  // Stable ordering regardless of JSON key order, without dropping array order.
  const stable = (v: unknown): string =>
    Array.isArray(v)
      ? `[${v.map(stable).join(',')}]`
      : v !== null && typeof v === 'object'
        ? `{${Object.keys(v)
            .sort()
            .map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`)
            .join(',')}}`
        : JSON.stringify(v);
  return createHash('sha256')
    .update(stable(snapshotSchema.parse(snapshot)))
    .digest('hex');
}
export async function propose(input: {
  clinicId: string;
  treatmentId: string;
  sourceId: string;
  snapshot: Snapshot;
  fetchedAt: Date;
}) {
  const snapshot = snapshotSchema.parse(input.snapshot);
  const hash = snapshotHash(snapshot);
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `${input.clinicId}:${input.treatmentId}`,
    ]);
    const source = await client.query(
      'SELECT 1 FROM sources WHERE id=$1 AND clinic_id=$2 AND url=$3',
      [input.sourceId, input.clinicId, snapshot.sourceUrl],
    );
    if (!source.rowCount)
      throw new Error('Kilden tilhører ikke klinikkavdelingen eller URL-en stemmer ikke');
    const old = await client.query(
      'SELECT content_hash FROM offers WHERE clinic_id=$1 AND treatment_id=$2 FOR UPDATE',
      [input.clinicId, input.treatmentId],
    );
    if (old.rows[0]?.content_hash === hash) {
      await client.query('UPDATE offers SET checked_at=$3 WHERE clinic_id=$1 AND treatment_id=$2', [
        input.clinicId,
        input.treatmentId,
        input.fetchedAt,
      ]);
      await client.query('COMMIT');
      return 'unchanged';
    }
    const rejected = await client.query(
      "SELECT 1 FROM proposals WHERE clinic_id=$1 AND treatment_id=$2 AND content_hash=$3 AND base_hash IS NOT DISTINCT FROM $4 AND status='rejected'",
      [input.clinicId, input.treatmentId, hash, old.rows[0]?.content_hash ?? null],
    );
    if (rejected.rowCount) {
      await client.query('COMMIT');
      return 'already-reviewed';
    }
    const result = await client.query(
      `INSERT INTO proposals(id,clinic_id,treatment_id,source_id,snapshot,content_hash,base_hash,fetched_at,checked_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$8) ON CONFLICT(clinic_id,treatment_id,content_hash) WHERE status='pending'
      DO UPDATE SET checked_at=EXCLUDED.checked_at,base_hash=EXCLUDED.base_hash RETURNING id`,
      [
        randomUUID(),
        input.clinicId,
        input.treatmentId,
        input.sourceId,
        snapshot,
        hash,
        old.rows[0]?.content_hash ?? null,
        input.fetchedAt,
      ],
    );
    await client.query('COMMIT');
    return result.rowCount ? 'pending' : 'already-reviewed';
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
export async function reviewProposal(
  id: string,
  action: 'approve' | 'reject',
  reviewer: string,
  note: string,
) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const first = await client.query('SELECT clinic_id,treatment_id FROM proposals WHERE id=$1', [
      id,
    ]);
    if (!first.rowCount) throw new Error('Forslaget finnes ikke');
    const key = first.rows[0];
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `${key.clinic_id}:${key.treatment_id}`,
    ]);
    const {
      rows: [p],
    } = await client.query('SELECT * FROM proposals WHERE id=$1 FOR UPDATE', [id]);
    if (p.status !== 'pending') throw new Error('Forslaget er allerede behandlet');
    if (action === 'approve') {
      const snapshot = snapshotSchema.parse(p.snapshot);
      const {
        rows: [old],
      } = await client.query(
        'SELECT * FROM offers WHERE clinic_id=$1 AND treatment_id=$2 FOR UPDATE',
        [p.clinic_id, p.treatment_id],
      );
      if ((old?.content_hash ?? null) !== p.base_hash)
        throw new Error(
          'En annen pris er publisert etter innhentingen. Hent og kontroller kilden på nytt.',
        );
      const offerId = old?.id ?? randomUUID();
      await client.query(
        `INSERT INTO offers(id,clinic_id,treatment_id,source_id,snapshot,content_hash,fetched_at,checked_at,published_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,now()) ON CONFLICT(clinic_id,treatment_id) DO UPDATE SET
        source_id=EXCLUDED.source_id,snapshot=EXCLUDED.snapshot,content_hash=EXCLUDED.content_hash,fetched_at=EXCLUDED.fetched_at,checked_at=EXCLUDED.checked_at,published_at=now()`,
        [
          offerId,
          p.clinic_id,
          p.treatment_id,
          p.source_id,
          snapshot,
          p.content_hash,
          p.fetched_at,
          p.checked_at,
        ],
      );
      await client.query(
        'INSERT INTO price_history(id,offer_id,proposal_id,snapshot,published_at,reviewed_by) VALUES($1,$2,$3,$4,now(),$5)',
        [randomUUID(), offerId, id, snapshot, reviewer],
      );
    }
    await client.query(
      'UPDATE proposals SET status=$2,reviewed_at=now(),reviewed_by=$3,review_note=$4 WHERE id=$1',
      [id, action === 'approve' ? 'approved' : 'rejected', reviewer, note],
    );
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
