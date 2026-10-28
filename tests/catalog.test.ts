import { test, expect, vi, afterEach } from 'vitest';
const mock = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock('../src/lib/server/db', () => mock);
import { getCatalog } from '../src/lib/server/catalog';
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
test('manglende database viser feil og aldri skjult eksempeldata', async () => {
  vi.stubEnv('DATABASE_URL', '');
  const catalog = await getCatalog();
  expect(catalog.demo).toBe(false);
  expect(catalog.offers).toEqual([]);
  expect(catalog.error).toContain('ikke konfigurert');
});
test('databasefeil gir norsk feilmelding uten hemmeligheter', async () => {
  vi.stubEnv('DATABASE_URL', 'postgresql://private');
  mock.getDb.mockImplementation(() => {
    throw new Error('sensitive connection details');
  });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const catalog = await getCatalog();
  expect(catalog.demo).toBe(false);
  expect(catalog.error).toContain('ikke kontakt');
  expect(catalog.error).not.toContain('sensitive');
  expect(catalog.offers).toEqual([]);
});
test('eksempelvisning krever eksplisitt valg og trenger ingen database', async () => {
  vi.stubEnv('DATABASE_URL', '');
  const catalog = await getCatalog(true);
  expect(catalog.demo).toBe(true);
  expect(catalog.offers).toHaveLength(4);
});
