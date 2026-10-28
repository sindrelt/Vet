import { eq } from 'drizzle-orm';
import { clinics, chains, offers, treatments } from '../../db/schema';
import { demoCatalog } from '../demo';
import type { Catalog } from '../domain';
import { getDb } from './db';
export async function getCatalog(demo = false): Promise<Catalog> {
  if (demo) return demoCatalog;
  if (!process.env.DATABASE_URL)
    return {
      clinics: [],
      offers: [],
      demo: false,
      error: 'Databasen er ikke konfigurert. Ekte priser er ikke tilgjengelige ennå.',
    };
  try {
    const db = getDb();
    const [branches, prices] = await Promise.all([
      db
        .select({ clinic: clinics, chain: chains.name })
        .from(clinics)
        .leftJoin(chains, eq(clinics.chainId, chains.id)),
      db
        .select({ offer: offers, treatment: treatments })
        .from(offers)
        .innerJoin(treatments, eq(offers.treatmentId, treatments.id)),
    ]);
    return {
      demo: false,
      clinics: branches.map(({ clinic: c, chain }) => ({
        ...c,
        chain,
        area: c.area as Catalog['clinics'][number]['area'],
      })),
      offers: prices.map(({ offer: o, treatment }) => ({
        ...o.snapshot,
        id: o.id,
        clinicId: o.clinicId,
        treatment,
        checkedAt: o.checkedAt.toISOString(),
        fetchedAt: o.fetchedAt.toISOString(),
        publishedAt: o.publishedAt.toISOString(),
      })),
    };
  } catch {
    console.error('catalog_database_unavailable');
    return {
      clinics: [],
      offers: [],
      demo: false,
      error: 'Vi får ikke kontakt med prisdatabasen akkurat nå. Prøv igjen om litt.',
    };
  }
}
