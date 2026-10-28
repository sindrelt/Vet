import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { areas, categories } from '../src/lib/domain';
import { publicHttpsUrl } from '../src/lib/collector/fetch';
import { adapterConfigSchema } from '../src/lib/collector/config';
import { getPool } from '../src/lib/server/db';
const file = process.argv[2];
if (!file)
  throw new Error(
    'Bruk npm run source:register -- /sti/til/verifisert-kilde.json. Se docs/pilot.md.',
  );
const data = z
  .object({
    clinic: z.object({
      id: z.string().min(1),
      slug: z.string().regex(/^[a-z0-9-]+$/),
      name: z.string().min(2),
      chain: z.object({ id: z.string(), name: z.string() }).nullable(),
      municipality: z.string().min(2),
      area: z.enum(areas),
      place: z.string().min(2),
      address: z.string().min(3),
      postalCode: z.string().regex(/^\d{4}$/),
      phone: z.string().nullable(),
      website: z.url(),
    }),
    treatments: z
      .array(
        z.object({
          id: z.string().min(1),
          category: z.enum(categories),
          species: z.enum(['dog', 'cat']),
          sex: z.enum(['any', 'male', 'female']),
          weightMinGrams: z.number().int().nonnegative().nullable(),
          weightMaxGrams: z.number().int().positive().nullable(),
          packageKey: z.string().min(2),
          packageLabel: z.string().min(3),
        }),
      )
      .min(1),
    source: z.object({
      id: z.string().min(1),
      url: z.url(),
      adapter: z.enum(['html-table', 'pdf-lines']),
      config: adapterConfigSchema,
      termsUrl: z.url(),
      termsNote: z.string().min(20),
      verifiedIdentityUrl: z.url(),
      confirmedPhysicalArea: z.literal(true),
      confirmedTermsAllowCollection: z.literal(true),
      enabled: z.boolean().default(false),
    }),
  })
  .parse(JSON.parse(await readFile(file, 'utf8')));
const c = data.clinic,
  s = data.source;
[c.website, s.url, s.termsUrl, s.verifiedIdentityUrl].forEach(publicHttpsUrl);
if (c.area === 'Nedre Eiker' && c.municipality !== 'Drammen')
  throw new Error('Nedre Eiker skal lagres med gjeldende kommune Drammen');
if (
  data.treatments.some(
    (t) => t.weightMaxGrams !== null && t.weightMaxGrams <= (t.weightMinGrams ?? 0),
  )
)
  throw new Error('Ugyldig vektklasse');
if (s.config.rows.some((r) => !data.treatments.some((t) => t.id === r.treatmentId)))
  throw new Error('Konfigurasjonen viser til en ukjent behandling');
if (new Set(s.config.rows.map((r) => r.treatmentId)).size !== s.config.rows.length)
  throw new Error('Duplisert behandling i kilden');
const normalize = (v: string) =>
  v.normalize('NFKC').trim().toLocaleLowerCase('nb').replace(/\s+/g, ' ');
// Area is deliberately absent: moving a boundary cannot create a duplicate branch.
const branchKey = createHash('sha256')
  .update(`${normalize(c.name)}|${normalize(c.address)}|${c.postalCode}`)
  .digest('hex');
const pool = getPool(),
  client = await pool.connect();
try {
  await client.query('BEGIN');
  if (c.chain)
    await client.query(
      'INSERT INTO chains(id,name) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name',
      [c.chain.id, c.chain.name],
    );
  // Explicit inserts: conflicting identities or variants require human review, not silent overwrite.
  await client.query(
    `INSERT INTO clinics(id,slug,branch_key,name,chain_id,municipality,area,place,address,postal_code,phone,website,verified_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now())`,
    [
      c.id,
      c.slug,
      branchKey,
      c.name,
      c.chain?.id ?? null,
      c.municipality,
      c.area,
      c.place,
      c.address,
      c.postalCode,
      c.phone,
      c.website,
    ],
  );
  for (const t of data.treatments) {
    const existing = await client.query('SELECT * FROM treatments WHERE id=$1', [t.id]);
    if (existing.rowCount) {
      const e = existing.rows[0];
      if (
        e.category !== t.category ||
        e.species !== t.species ||
        e.sex !== t.sex ||
        e.weight_min_grams !== t.weightMinGrams ||
        e.weight_max_grams !== t.weightMaxGrams ||
        e.package_key !== t.packageKey ||
        e.package_label !== t.packageLabel
      )
        throw new Error(
          'Behandlings-ID har en annen definisjon. Bruk en ny variant, ikke overskriv historikk.',
        );
    } else
      await client.query(
        `INSERT INTO treatments(id,category,species,sex,weight_min_grams,weight_max_grams,package_key,package_label)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          t.id,
          t.category,
          t.species,
          t.sex,
          t.weightMinGrams,
          t.weightMaxGrams,
          t.packageKey,
          t.packageLabel,
        ],
      );
  }
  await client.query(
    `INSERT INTO sources(id,clinic_id,url,adapter,config,terms_url,terms_reviewed_at,terms_note,enabled)
    VALUES($1,$2,$3,$4,$5,$6,now(),$7,$8)`,
    [
      s.id,
      c.id,
      s.url,
      s.adapter,
      s.config,
      s.termsUrl,
      `${s.termsNote}\nIdentitet kontrollert mot ${s.verifiedIdentityUrl}`,
      s.enabled,
    ],
  );
  await client.query('COMMIT');
  console.log('Verifisert klinikk og kilde registrert. Ingen priser er publisert.');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();
  await pool.end();
}
