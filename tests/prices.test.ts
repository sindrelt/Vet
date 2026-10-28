import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseNorwegianPrice } from '../src/lib/collector/normalize';
import { extractHtml } from '../src/lib/collector/adapters/html-table';
import { extractPdfText, extractPdf } from '../src/lib/collector/adapters/pdf-lines';
import { adapterConfigSchema } from '../src/lib/collector/config';
import { snapshotHash } from '../src/lib/server/review';
import { demoCatalog } from '../src/lib/demo';
import { filterOffers, priceSchema, formatPrice, isStale } from '../src/lib/domain';
const config = adapterConfigSchema.parse({
  rows: [
    ['vaccine', 'Vaksine hund'],
    ['castration', 'Kastrering hannkatt'],
    ['consultation', 'Konsultasjon katt'],
    ['chip', 'ID-merking katt'],
  ].map(([treatmentId, label]) => ({
    treatmentId,
    label,
    originalName: label,
    includes: [],
    extras: [],
    caveats: [],
    vat: 'unspecified',
  })),
});
const url = 'https://clinic.example.org/priser';
const html = readFileSync('tests/fixtures/prices.html', 'utf8');
const pdfText = readFileSync('tests/fixtures/prices-pdf.txt', 'utf8');
describe('Presise norske pengeverdier', () => {
  test.each([
    ['890,-', 89000],
    ['NOK 1.290', 129000],
    ['1 234,50 kr', 123450],
    ['kr 1234,5', 123450],
    ['1\u00a0290 kr', 129000],
  ])('%s → %i øre', (text, ore) =>
    expect(parseNorwegianPrice(text)).toEqual({ kind: 'fixed', minOre: ore, maxOre: null }),
  );
  test('fra-priser og intervall beholdes', () => {
    expect(parseNorwegianPrice('Fra 1.490,-')).toEqual({
      kind: 'from',
      minOre: 149000,
      maxOre: null,
    });
    expect(parseNorwegianPrice('1.200–1.600 kr')).toEqual({
      kind: 'range',
      minOre: 120000,
      maxOre: 160000,
    });
    expect(parseNorwegianPrice('På forespørsel')).toEqual({
      kind: 'unknown',
      minOre: null,
      maxOre: null,
    });
    expect(formatPrice({ kind: 'from', minOre: 149000, maxOre: null })).toMatch(/^Fra 1.?490 kr$/);
  });
  test.each([
    '',
    '0',
    '-10 kr',
    'Gratis',
    '1.29',
    '1,200.50',
    '890 + 100 kr',
    'fra',
    '890 for katt, 990 for hund',
    '1000-900 kr',
  ])('avviser tvetydig eller manglende %s', (text) =>
    expect(() => parseNorwegianPrice(text)).toThrow(),
  );
  test('ukjent er aldri 0 og desimaløre avvises', () => {
    expect(priceSchema.safeParse({ kind: 'unknown', minOre: 0, maxOre: null }).success).toBe(false);
    expect(priceSchema.safeParse({ kind: 'fixed', minOre: 100.5, maxOre: null }).success).toBe(
      false,
    );
  });
});
describe('Adaptere bruker lagrede syntetiske kilder', () => {
  test('HTML og PDF-linjer normaliseres likt', () => {
    const a = extractHtml(html, config, url),
      b = extractPdfText(pdfText, config, url);
    expect(a).toHaveLength(4);
    expect(a.map((x) => x.snapshot.price)).toEqual(b.map((x) => x.snapshot.price));
    expect(a[0].snapshot.originalText).not.toContain('Ignore');
  });
  test('manglende og dupliserte rader stopper uttrekket', () => {
    expect(() =>
      extractHtml(html.replace('Vaksine hund', 'Endret behandling'), config, url),
    ).toThrow('Forventet');
    expect(() =>
      extractHtml(
        html.replace('</table>', '<tr><td>Vaksine hund</td><td>990</td></tr></table>'),
        config,
        url,
      ),
    ).toThrow();
    expect(() =>
      extractPdfText(pdfText.replace('Vaksine hund', 'Endret behandling'), config, url),
    ).toThrow();
    expect(() => extractHtml(html.replace('890,-', ''), config, url)).toThrow();
  });
  test('ekte PDF-byteparser testes med en syntetisk PDF', async () => {
    const bytes = readFileSync('tests/fixtures/prices.pdf');
    const result = await extractPdf(bytes, config, url);
    expect(result).toHaveLength(4);
    expect(result[0].snapshot.price.minOre).toBe(89000);
  });
  test('hashen er stabil uavhengig av JSON-nøkkelrekkefølge', () => {
    const s = extractHtml(html, config, url)[0].snapshot;
    expect(snapshotHash(s)).toBe(
      snapshotHash(Object.fromEntries(Object.entries(s).reverse()) as typeof s),
    );
  });
});
describe('Filtrering, områder og sammenlignbarhet', () => {
  test('Nedre Eiker overlapper ikke Drammen-søket', () => {
    expect(
      filterOffers(demoCatalog, { area: 'Nedre Eiker' }).offers.map((o) => o.clinicId),
    ).toEqual(['demo-c']);
    expect(
      filterOffers(demoCatalog, { area: 'Drammen' }).offers.every((o) => o.clinicId === 'demo-a'),
    ).toBe(true);
    expect(new Set(filterOffers(demoCatalog, {}).offers.map((o) => o.id)).size).toBe(4);
  });
  test('ulike dyr og pakker rangeres ikke samlet', () =>
    expect(filterOffers(demoCatalog, { sort: 'price' }).comparable).toBe(false));
  test('fastpris og fra-pris blandes ikke til billigst-rangering', () => {
    const result = filterOffers(demoCatalog, {
      species: 'dog',
      category: 'Vaksinasjon',
      sort: 'price',
    });
    expect(result.comparable).toBe(true);
    expect(result.offers.map((o) => o.price.kind)).toEqual(['fixed', 'fixed', 'from']);
  });
  test('ulikt pakkeinnhold eller mva. gjør tilbud usammenlignbare', () => {
    const catalog = structuredClone(demoCatalog);
    catalog.offers[0].vat = 'excluded';
    expect(filterOffers(catalog, { species: 'dog' }).comparable).toBe(false);
    catalog.offers[0].vat = 'unspecified';
    catalog.offers[0].includes.push('ID-merking');
    expect(filterOffers(catalog, { species: 'dog' }).comparable).toBe(false);
  });
  test('søk og tomtilstand', () => {
    expect(filterOffers(demoCatalog, { q: 'Hønefoss' }).offers).toHaveLength(1);
    expect(filterOffers(demoCatalog, { area: 'Modum' }).offers).toHaveLength(0);
  });
  test('30 dager gir utdatert-varsel', () =>
    expect(isStale('2026-01-01', new Date('2026-03-01'))).toBe(true));
});
