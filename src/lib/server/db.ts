import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../../db/schema';
const globalDb = globalThis as unknown as { vetPool?: Pool };
export function getPool() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL mangler');
  return (globalDb.vetPool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 8,
    connectionTimeoutMillis: 5000,
    statement_timeout: 10000,
  }));
}
export function getDb() {
  return drizzle(getPool(), { schema });
}
