import { test, expect } from '@playwright/test';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { snapshotHash } from '../../src/lib/server/review';
import type { Snapshot } from '../../src/lib/domain';

test('ekte visning er tom; eksempeldata er tydelig merket og kan filtreres', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByText('Ingen ekte priser er publisert ennå.', { exact: false }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Utforsk eksempelvisning' }).click();
  await expect(page.getByText('Du ser eksempeldata – ingen av prisene er ekte.')).toBeVisible();
  await expect(page.locator('.offer-card')).toHaveCount(4);
  await page.getByRole('combobox', { name: 'Område', exact: true }).selectOption('Nedre Eiker');
  await page.getByRole('button', { name: 'Finn priser', exact: true }).click();
  await expect(page.locator('.offer-card')).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Eksempelklinikk C' })).toBeVisible();
  await page.getByRole('link', { name: 'Se klinikken', exact: true }).click();
  await expect(page.getByText('Gjeldende kommune: Drammen')).toBeVisible();
  await expect(page.getByText('Fiktiv eksempelklinikk.', { exact: false })).toBeVisible();
});
test('art, behandling, tomtilstand og prissortering fungerer', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByRole('combobox', { name: 'Dyreart', exact: true }).selectOption('cat');
  await page.getByRole('combobox', { name: 'Behandling', exact: true }).selectOption('Kastrering');
  await page.getByRole('button', { name: 'Finn priser', exact: true }).click();
  await expect(page.locator('.offer-card')).toHaveCount(1);
  await page.getByRole('combobox', { name: 'Område', exact: true }).selectOption('Modum');
  await page.getByRole('button', { name: 'Finn priser', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Ingen priser passer til søket ditt' }),
  ).toBeVisible();
  await page.goto('/?demo=1&sort=price');
  await expect(
    page.getByText('Tilbudene gjelder ulike behandlinger eller pakker.', { exact: false }),
  ).toBeVisible();
  await page
    .getByRole('combobox', { name: 'Sammenlignbar behandling / pakke', exact: true })
    .selectOption({ label: 'Vaksinasjon · Hund · Vaksine og enkel helsesjekk' });
  await page.getByRole('button', { name: 'Finn priser', exact: true }).click();
  await expect(page.locator('.offer-card')).toHaveCount(3);
  await expect(page.locator('.offer-card').first()).toContainText('890 kr');
  await expect(page.locator('.offer-card').last()).toContainText('Fra 790 kr');
});
test('layout passer skjermen og har ingen nettleserfeil', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?demo=1');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: `test-results/${testInfo.project.name}-home.png`, fullPage: true });
  expect(errors).toEqual([]);
});
test('administrasjon og skrive-API er stengt uten innlogging', async ({ request }) => {
  expect((await request.get('/admin')).status()).toBe(401);
  expect(
    (await request.post('/api/admin/review', { form: { id: 'x', action: 'approve' } })).status(),
  ).toBe(401);
});
test('innlogget administrasjon avviser CSRF', async ({ playwright }) => {
  const api = await playwright.request.newContext({
    baseURL: 'http://localhost:3001',
    httpCredentials: {
      username: 'admin',
      password: process.env.E2E_ADMIN_PASSWORD!,
      send: 'always',
    },
  });
  expect((await api.get('/admin')).status()).toBe(200);
  expect(
    (
      await api.post('/api/admin/review', {
        headers: { origin: 'https://evil.example' },
        form: { id: 'x', action: 'approve' },
      })
    ).status(),
  ).toBe(403);
  expect(
    (await api.post('/api/admin/review', { form: { id: 'x', action: 'approve' } })).status(),
  ).toBe(403);
  await api.dispose();
});
test('godkjenning og avvisning gjennom nettleseren styrer publisering', async ({ browser }) => {
  const db = new Pool({ connectionString: process.env.E2E_DATABASE_URL });
  const context = await browser.newContext({
    httpCredentials: { username: 'admin', password: process.env.E2E_ADMIN_PASSWORD! },
  });
  const page = await context.newPage();
  const id = randomUUID();
  const s: Snapshot = {
    originalName: 'Syntetisk testvaksine',
    price: { kind: 'fixed', minOre: 123400, maxOre: null },
    includes: ['Testinnhold'],
    extras: [],
    caveats: ['Syntetisk E2E-test'],
    vat: 'included',
    sourceUrl: 'https://clinic.example.org/priser',
    originalText: 'Syntetisk testvaksine 1234 kr, ikke et ekte tilbud.',
  };
  try {
    await db.query(
      `INSERT INTO clinics(id,slug,branch_key,name,municipality,area,place,address,postal_code,website,verified_at) VALUES($1,$1,$1,'Kun E2E testklinikk','Drammen','Nedre Eiker','Teststed','Testadresse','3050','https://clinic.example.org',now())`,
      [id],
    );
    await db.query(
      `INSERT INTO treatments(id,category,species,sex,package_key,package_label) VALUES($1,'Vaksinasjon','dog','any',$1,'Testpakke')`,
      [id],
    );
    await db.query(
      `INSERT INTO sources(id,clinic_id,url,adapter,config,terms_url,terms_reviewed_at,terms_note) VALUES($1,$1,$2,'html-table','{}','https://clinic.example.org/terms',now(),'Syntetisk testkilde, ikke ekte')`,
      [id, `https://clinic.example.org/priser/${id}`],
    );
    const proposal = randomUUID();
    await db.query(
      `INSERT INTO proposals(id,clinic_id,treatment_id,source_id,snapshot,content_hash,fetched_at,checked_at) VALUES($1,$2,$2,$2,$3,$4,now(),now())`,
      [proposal, id, s, snapshotHash(s)],
    );
    await page.goto('/');
    await expect(page.getByText('Kun E2E testklinikk', { exact: true })).toHaveCount(0);
    await page.goto('/admin');
    await expect(
      page.getByRole('heading', { name: 'Kun E2E testklinikk · Syntetisk testvaksine' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Godkjenn og publiser' }).click();
    await expect(page.getByText('Forslaget er behandlet.')).toBeVisible();
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Kun E2E testklinikk' })).toBeVisible();
    await expect(page.getByText('1 234 kr', { exact: true })).toBeVisible();
    const rejected = randomUUID(),
      s2 = { ...s, price: { kind: 'fixed' as const, minOre: 150000, maxOre: null } };
    await db.query(
      `INSERT INTO proposals(id,clinic_id,treatment_id,source_id,snapshot,content_hash,base_hash,fetched_at,checked_at) VALUES($1,$2,$2,$2,$3,$4,$5,now(),now())`,
      [rejected, id, s2, snapshotHash(s2), snapshotHash(s)],
    );
    await page.goto('/admin');
    await page.getByRole('button', { name: 'Avvis', exact: true }).click();
    await expect(page.getByText('Forslaget er behandlet.')).toBeVisible();
    await page.goto('/');
    await expect(page.getByText('1 234 kr', { exact: true })).toBeVisible();
    await expect(page.getByText('1 500 kr', { exact: true })).toHaveCount(0);
  } finally {
    await db.query(
      'DELETE FROM price_history WHERE offer_id IN (SELECT id FROM offers WHERE clinic_id=$1)',
      [id],
    );
    await db.query('DELETE FROM offers WHERE clinic_id=$1', [id]);
    await db.query('DELETE FROM proposals WHERE clinic_id=$1', [id]);
    await db.query('DELETE FROM sources WHERE clinic_id=$1', [id]);
    await db.query('DELETE FROM treatments WHERE id=$1', [id]);
    await db.query('DELETE FROM clinics WHERE id=$1', [id]);
    await db.end();
    await context.close();
  }
});
