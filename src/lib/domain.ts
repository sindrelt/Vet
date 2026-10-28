import { z } from 'zod';
export const areas = ['Modum', 'Ringerike', 'Øvre Eiker', 'Nedre Eiker', 'Drammen'] as const;
export const categories = ['Konsultasjon', 'Vaksinasjon', 'ID-merking', 'Kastrering'] as const;
export const priceSchema = z
  .object({
    kind: z.enum(['fixed', 'from', 'range', 'unknown']),
    minOre: z.number().int().positive().max(100_000_000).nullable(),
    maxOre: z.number().int().positive().max(100_000_000).nullable(),
  })
  .superRefine((v, ctx) => {
    const valid =
      v.kind === 'unknown'
        ? v.minOre === null && v.maxOre === null
        : v.kind === 'range'
          ? v.minOre !== null && v.maxOre !== null && v.maxOre >= v.minOre
          : v.minOre !== null && v.maxOre === null;
    if (!valid) ctx.addIssue({ code: 'custom', message: 'Ugyldig pristype eller prisgrenser' });
  });
export type Price = z.infer<typeof priceSchema>;
export const snapshotSchema = z.object({
  originalName: z.string().min(2).max(300),
  price: priceSchema,
  includes: z.array(z.string().min(1).max(300)).max(30),
  extras: z.array(z.string().min(1).max(300)).max(30),
  caveats: z.array(z.string().min(1).max(500)).max(30),
  vat: z.enum(['included', 'excluded', 'unspecified']),
  sourceUrl: z.url().refine((v) => new URL(v).protocol === 'https:', 'Kilden må bruke HTTPS'),
  originalText: z.string().min(3).max(10000),
});
export type Snapshot = z.infer<typeof snapshotSchema>;
export interface Treatment {
  id: string;
  category: (typeof categories)[number];
  species: 'dog' | 'cat';
  sex: 'any' | 'male' | 'female';
  weightMinGrams: number | null;
  weightMaxGrams: number | null;
  packageKey: string;
  packageLabel: string;
}
export interface Clinic {
  id: string;
  slug: string;
  name: string;
  chain: string | null;
  municipality: string;
  area: (typeof areas)[number];
  place: string;
  address: string | null;
  postalCode: string | null;
  phone: string | null;
  website: string | null;
}
export interface Offer extends Snapshot {
  id: string;
  clinicId: string;
  treatment: Treatment;
  checkedAt: string;
  fetchedAt: string;
  publishedAt: string;
}
export interface Catalog {
  clinics: Clinic[];
  offers: Offer[];
  demo: boolean;
  error?: string;
}
export const speciesLabel = (s: string) => (s === 'dog' ? 'Hund' : 'Katt');
export function treatmentLabel(t: Treatment) {
  const sex = t.sex === 'female' ? 'hunn' : t.sex === 'male' ? 'hann' : '';
  const weight =
    t.weightMaxGrams !== null
      ? `${(t.weightMinGrams ?? 0) / 1000}–${t.weightMaxGrams / 1000} kg`
      : t.weightMinGrams
        ? `over ${t.weightMinGrams / 1000} kg`
        : '';
  return [speciesLabel(t.species), sex, weight].filter(Boolean).join(' · ');
}
export function comparisonKey(t: Treatment) {
  return [
    t.category,
    t.species,
    t.sex,
    t.weightMinGrams ?? '-',
    t.weightMaxGrams ?? '-',
    t.packageKey,
  ].join('|');
}
export function formatPrice(price: Price) {
  const nok = (v: number) =>
    new Intl.NumberFormat('nb-NO', { maximumFractionDigits: v % 100 ? 2 : 0 }).format(v / 100);
  if (price.kind === 'unknown' || price.minOre === null) return 'Pris ikke oppgitt';
  if (price.kind === 'range') return `${nok(price.minOre)}–${nok(price.maxOre!)} kr`;
  return `${price.kind === 'from' ? 'Fra ' : ''}${nok(price.minOre)} kr`;
}
export function isStale(checkedAt: string, now = new Date()) {
  return now.getTime() - new Date(checkedAt).getTime() > 30 * 86400000;
}
export interface Filters {
  q?: string;
  area?: string;
  category?: string;
  species?: string;
  variant?: string;
  sort?: string;
}
export function filterOffers(catalog: Catalog, f: Filters) {
  const clinicMap = new Map(catalog.clinics.map((c) => [c.id, c]));
  const offers = catalog.offers.filter((o) => {
    const c = clinicMap.get(o.clinicId);
    return (
      c &&
      (!f.area || c.area === f.area) &&
      (!f.category || o.treatment.category === f.category) &&
      (!f.species || o.treatment.species === f.species) &&
      (!f.variant || comparisonKey(o.treatment) === f.variant) &&
      (!f.q ||
        `${c.name} ${c.place} ${o.originalName}`
          .toLocaleLowerCase('nb')
          .includes(f.q.toLocaleLowerCase('nb')))
    );
  });
  const comparable =
    offers.length > 0 &&
    offers.every((o) => o.includes.length > 0) &&
    new Set(
      offers.map((o) =>
        [
          comparisonKey(o.treatment),
          o.vat,
          [...o.includes].sort().join(';'),
          [...o.extras].sort().join(';'),
        ].join('::'),
      ),
    ).size === 1;
  // A lower bound is not a final price. Keep fixed/from/range/unknown in separate sections.
  const kindOrder = { fixed: 0, from: 1, range: 2, unknown: 3 };
  offers.sort((a, b) =>
    f.sort === 'price' && comparable
      ? kindOrder[a.price.kind] - kindOrder[b.price.kind] ||
        (a.price.minOre ?? Infinity) - (b.price.minOre ?? Infinity)
      : clinicMap.get(a.clinicId)!.name.localeCompare(clinicMap.get(b.clinicId)!.name, 'nb') ||
        a.originalName.localeCompare(b.originalName, 'nb'),
  );
  return { offers, comparable };
}
