import { beforeAll, afterAll, describe, test, expect, vi } from 'vitest';
import { Pool } from 'pg';
import { execFileSync } from 'node:child_process';
import { getPool } from '../src/lib/server/db';
import { propose, reviewProposal } from '../src/lib/server/review';
import { extractHtml } from '../src/lib/collector/adapters/html-table';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { adapterConfigSchema } from '../src/lib/collector/config';
import { collectSource } from '../src/lib/collector/run';
const network = vi.hoisted(() => ({ checkRobots: vi.fn(), fetchDocument: vi.fn() }));
vi.mock('../src/lib/collector/fetch', () => network);
import { getCatalog } from '../src/lib/server/catalog';
const testUrl = process.env.TEST_DATABASE_URL;
describe.skipIf(!testUrl)('PostgreSQL: forslag, publisering og historikk', () => {
  let pool: Pool;
  beforeAll(async () => {
    if (!new URL(testUrl!).pathname.endsWith('_test'))
      throw new Error(
        'TEST_DATABASE_URL må peke til en separat database med navn som slutter på _test',
      );
    process.env.DATABASE_URL = testUrl;
    execFileSync('node', ['--import', 'tsx', 'scripts/migrate.ts'], {
      env: { ...process.env, DATABASE_URL: testUrl },
      stdio: 'pipe',
    });
    pool = getPool();
    await pool.query(
      'TRUNCATE price_history,proposals,offers,sources,treatments,clinics,chains CASCADE',
    );
    await pool.query(
      `INSERT INTO clinics(id,slug,branch_key,name,municipality,area,place,address,postal_code,website,verified_at) VALUES('test-c','test-clinic','unique-test-branch','Syntetisk testklinikk','Drammen','Nedre Eiker','Teststed','Testadresse 1','3050','https://clinic.example.org',now())`,
    );
    await pool.query(
      `INSERT INTO treatments(id,category,species,sex,package_key,package_label) VALUES('test-t','Vaksinasjon','dog','any','basic','Syntetisk testpakke')`,
    );
    const config = adapterConfigSchema.parse({
      rows: [
        {
          treatmentId: 'test-t',
          label: 'Vaksine hund',
          originalName: 'Vaksine hund',
          includes: [],
          extras: [],
          caveats: [],
          vat: 'unspecified',
        },
      ],
    });
    await pool.query(
      `INSERT INTO sources(id,clinic_id,url,adapter,config,terms_url,terms_reviewed_at,terms_note,enabled) VALUES('test-s','test-c','https://clinic.example.org/priser','html-table',$1,'https://clinic.example.org/terms',now(),'Kun syntetisk testdata; ikke en ekte kilde',false)`,
      [config],
    );
  });
  afterAll(async () => {
    if (pool) {
      await pool.query(
        'TRUNCATE price_history,proposals,offers,sources,treatments,clinics,chains CASCADE',
      );
      await pool.end();
    }
  });
  const make = (price: string) => ({
    clinicId: 'test-c',
    treatmentId: 'test-t',
    sourceId: 'test-s',
    fetchedAt: new Date(),
    snapshot: extractHtml(
      readFileSync('tests/fixtures/prices.html', 'utf8').replace('890,-', price),
      adapterConfigSchema.parse({
        rows: [
          {
            treatmentId: 'test-t',
            label: 'Vaksine hund',
            originalName: 'Vaksine hund',
            includes: [],
            extras: [],
            caveats: [],
            vat: 'unspecified',
          },
        ],
      }),
      'https://clinic.example.org/priser',
    )[0].snapshot,
  });
  const pendingId = async () =>
    (
      await pool.query(
        "SELECT id FROM proposals WHERE status='pending' ORDER BY fetched_at DESC LIMIT 1",
      )
    ).rows[0].id as string;
  test('ny og gjentatt innhenting gir ett forslag og ingen offentlig pris', async () => {
    await Promise.all([propose(make('890,-')), propose(make('890,-'))]);
    expect((await pool.query('SELECT count(*)::int AS n FROM proposals')).rows[0].n).toBe(1);
    expect((await getCatalog()).offers).toHaveLength(0);
  });
  test('overlappende område kan ikke duplisere avdelingens identitet', async () => {
    await expect(
      pool.query(
        `INSERT INTO clinics(id,slug,branch_key,name,municipality,area,place,address,postal_code,website,verified_at) VALUES('test-c2','test-clinic2','unique-test-branch','Syntetisk testklinikk','Drammen','Drammen','Teststed','Testadresse 1','3050','https://clinic.example.org',now())`,
      ),
    ).rejects.toMatchObject({ code: '23505' });
  });
  test('godkjenning publiserer én gang med historikk', async () => {
    const id = await pendingId();
    await reviewProposal(id, 'approve', 'test-admin', 'Kontrollert i test');
    expect((await getCatalog()).offers[0].price.minOre).toBe(89000);
    expect((await pool.query('SELECT count(*)::int AS n FROM price_history')).rows[0].n).toBe(1);
    await expect(reviewProposal(id, 'approve', 'test-admin', '')).rejects.toThrow('allerede');
    expect(await propose(make('890,-'))).toBe('unchanged');
  });
  test('avvisning og uttrekksfeil beholder tidligere pris', async () => {
    await propose(make('990,-'));
    await reviewProposal(await pendingId(), 'reject', 'test-admin', 'Feil pakke');
    expect(await propose(make('990,-'))).toBe('already-reviewed');
    expect((await getCatalog()).offers[0].price.minOre).toBe(89000);
    expect(() => make('')).toThrow();
    expect((await getCatalog()).offers[0].price.minOre).toBe(89000);
  });
  test('utdaterte forslag kan ikke overskrive nyere pris; tidligere pris kan gjeninnføres', async () => {
    await propose(make('1000,-'));
    const stale = await pendingId();
    await propose(make('1100,-'));
    await reviewProposal(await pendingId(), 'approve', 'test-admin', '');
    await expect(reviewProposal(stale, 'approve', 'test-admin', '')).rejects.toThrow('annen pris');
    await propose(make('1000,-'));
    await reviewProposal(stale, 'approve', 'test-admin', 'Ny kontroll av kilden');
    await propose(make('890,-'));
    await reviewProposal(await pendingId(), 'approve', 'test-admin', 'Prisen er tilbake');
    expect((await getCatalog()).offers[0].price.minOre).toBe(89000);
    expect((await pool.query('SELECT count(*)::int AS n FROM price_history')).rows[0].n).toBe(4);
  });
  test('samtidig godkjenning kan ikke lage doble historikkrader', async () => {
    await propose(make('1200,-'));
    const id = await pendingId();
    const r = await Promise.allSettled([
      reviewProposal(id, 'approve', 'a', ''),
      reviewProposal(id, 'approve', 'b', ''),
    ]);
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(
      (await pool.query('SELECT count(*)::int AS n FROM price_history WHERE proposal_id=$1', [id]))
        .rows[0].n,
    ).toBe(1);
  });
  test('robots- og nettverksfeil beholder publisert pris og siste vellykkede kontroll', async () => {
    await pool.query(
      "UPDATE sources SET enabled=true,last_success_at='2026-01-01' WHERE id='test-s'",
    );
    network.checkRobots.mockRejectedValueOnce(new Error('robots.txt tillater ikke denne kilden'));
    await expect(collectSource('test-s', 'contact@example.org')).rejects.toThrow('robots.txt');
    expect(network.fetchDocument).not.toHaveBeenCalled();
    const source = (await pool.query("SELECT * FROM sources WHERE id='test-s'")).rows[0];
    expect(source.last_success_at.toISOString()).toContain('2026-01-01');
    expect(source.last_error).toContain('robots.txt');
    expect((await getCatalog()).offers[0].price.minOre).toBe(120000);
    network.checkRobots.mockResolvedValue(undefined);
    network.fetchDocument.mockRejectedValueOnce(new Error('Tidsavbrudd'));
    await expect(collectSource('test-s', 'contact@example.org')).rejects.toThrow('Tidsavbrudd');
    expect((await getCatalog()).offers[0].price.minOre).toBe(120000);
  });
  test('kildeendring stopper innhentingen; vellykket uttrekk lager kun forslag', async () => {
    network.fetchDocument.mockResolvedValueOnce({
      bytes: Buffer.from('<table><tr><td>Ukjent</td><td>0</td></tr></table>'),
      contentType: 'text/html',
    });
    await expect(collectSource('test-s', 'contact@example.org')).rejects.toThrow('Forventet');
    expect((await getCatalog()).offers[0].price.minOre).toBe(120000);
    network.fetchDocument.mockResolvedValue({
      bytes: Buffer.from(
        readFileSync('tests/fixtures/prices.html', 'utf8').replace('890,-', '1300,-'),
      ),
      contentType: 'text/html',
    });
    expect(await collectSource('test-s', 'contact@example.org')).toEqual(['pending']);
    expect(await collectSource('test-s', 'contact@example.org')).toEqual(['pending']);
    expect(
      (await pool.query("SELECT count(*)::int AS n FROM proposals WHERE status='pending'")).rows[0]
        .n,
    ).toBe(1);
    expect((await getCatalog()).offers[0].price.minOre).toBe(120000);
    expect(
      (await pool.query("SELECT last_error FROM sources WHERE id='test-s'")).rows[0].last_error,
    ).toBeNull();
  });
  test('registreringsjobben lagrer kilden deaktivert og avviser duplikater og variantkonflikter', async () => {
    const folder = mkdtempSync(join(tmpdir(), 'vet-registration-'));
    const file = join(folder, 'source.json');
    const data = {
      clinic: {
        id: 'reg-c',
        slug: 'reg-c',
        name: 'Syntetisk registreringsklinikk',
        chain: null,
        municipality: 'Modum',
        area: 'Modum',
        place: 'Teststed',
        address: 'Testadresse 20',
        postalCode: '3370',
        phone: null,
        website: 'https://clinic.example.org',
      },
      treatments: [
        {
          id: 'reg-t',
          category: 'Vaksinasjon',
          species: 'cat',
          sex: 'any',
          weightMinGrams: null,
          weightMaxGrams: null,
          packageKey: 'reg-package',
          packageLabel: 'Syntetisk testpakke',
        },
      ],
      source: {
        id: 'reg-s',
        url: 'https://clinic.example.org/registration-test',
        adapter: 'html-table',
        termsUrl: 'https://clinic.example.org/terms',
        termsNote: 'Syntetisk test. Ingen faktisk identitet eller vilkår er kontrollert.',
        verifiedIdentityUrl: 'https://clinic.example.org/contact',
        confirmedPhysicalArea: true,
        confirmedTermsAllowCollection: true,
        enabled: false,
        config: {
          rows: [
            {
              treatmentId: 'reg-t',
              label: 'Vaksine katt',
              originalName: 'Vaksine katt',
              includes: ['Testinnhold'],
              extras: [],
              caveats: [],
              vat: 'unspecified',
            },
          ],
        },
      },
    };
    const run = () =>
      execFileSync(process.execPath, ['--import', 'tsx', 'scripts/register-source.ts', file], {
        env: { ...process.env, DATABASE_URL: testUrl },
        stdio: 'pipe',
      });
    try {
      writeFileSync(file, JSON.stringify(data));
      run();
      expect(
        (await pool.query("SELECT enabled FROM sources WHERE id='reg-s'")).rows[0].enabled,
      ).toBe(false);
      expect(() => run()).toThrow();
      data.clinic.id = 'reg-c2';
      data.clinic.slug = 'reg-c2';
      writeFileSync(file, JSON.stringify(data));
      expect(() => run()).toThrow();
      expect(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM clinics WHERE name='Syntetisk registreringsklinikk'",
          )
        ).rows[0].n,
      ).toBe(1);
      data.clinic.name = 'En annen syntetisk klinikk';
      data.clinic.address = 'Testadresse 21';
      data.source.id = 'reg-s2';
      data.source.url = 'https://clinic.example.org/registration-test-2';
      data.treatments[0].packageLabel = 'En helt annen pakke';
      writeFileSync(file, JSON.stringify(data));
      expect(() => run()).toThrow();
      expect(
        (await pool.query("SELECT count(*)::int AS n FROM clinics WHERE id='reg-c2'")).rows[0].n,
      ).toBe(0);
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });
});
