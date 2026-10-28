import { afterEach, beforeEach, expect, test, vi } from 'vitest';
const network = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('undici', () => ({ EnvHttpProxyAgent: class {}, fetch: network.fetch }));
import { checkRobots, fetchDocument, publicHttpsUrl } from '../src/lib/collector/fetch';
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-28T12:00:00Z'));
  network.fetch.mockReset();
});
afterEach(() => vi.useRealTimers());
async function complete<T>(promise: Promise<T>) {
  await vi.runAllTimersAsync();
  return promise;
}
test('robots.txt kan stoppe innhentingen', async () => {
  network.fetch.mockResolvedValue(
    new Response('User-agent: *\nDisallow: /priser\n', {
      headers: { 'content-type': 'text/plain' },
    }),
  );
  const result = expect(
    checkRobots('https://robots.example.org/priser', 'contact@example.org'),
  ).rejects.toThrow('tillater ikke');
  await complete(result);
  expect(network.fetch).toHaveBeenCalledTimes(1);
});
test('manglende robots.txt er ikke automatisk tillatelse', async () => {
  network.fetch.mockResolvedValue(new Response('Not found', { status: 404 }));
  await complete(
    expect(
      checkRobots('https://missing.example.org/priser', 'contact@example.org'),
    ).rejects.toThrow('HTTP 404'),
  );
});
test('midlertidig HTTP-feil får maksimalt ett forsøk til og respekterer Retry-After', async () => {
  network.fetch
    .mockResolvedValueOnce(new Response('Busy', { status: 503, headers: { 'retry-after': '4' } }))
    .mockResolvedValueOnce(
      new Response('Price table', { headers: { 'content-type': 'text/html' } }),
    );
  const start = Date.now();
  const result = await complete(
    fetchDocument('https://retry.example.org/priser', 'contact@example.org'),
  );
  expect(result.bytes.toString()).toBe('Price table');
  expect(network.fetch).toHaveBeenCalledTimes(2);
  expect(Date.now() - start).toBeGreaterThanOrEqual(4000);
});
test('lang Retry-After stopper jobben uten nytt forsøk', async () => {
  network.fetch.mockResolvedValue(
    new Response('Busy', { status: 429, headers: { 'retry-after': '300' } }),
  );
  await complete(
    expect(
      fetchDocument('https://later.example.org/priser', 'contact@example.org'),
    ).rejects.toThrow('senere'),
  );
  expect(network.fetch).toHaveBeenCalledTimes(1);
});
test('redirect og store dokumenter stoppes', async () => {
  network.fetch.mockResolvedValueOnce(
    new Response(null, { status: 302, headers: { location: 'https://other.example.org' } }),
  );
  await complete(
    expect(
      fetchDocument('https://redirect.example.org/priser', 'contact@example.org'),
    ).rejects.toThrow('HTTP 302'),
  );
  network.fetch.mockResolvedValueOnce(
    new Response('x', { headers: { 'content-length': '9000000' } }),
  );
  await complete(
    expect(
      fetchDocument('https://large.example.org/priser', 'contact@example.org'),
    ).rejects.toThrow('for stor'),
  );
});
test('registrering tillater ikke HTTP, IP, lokale adresser eller innlogging i URL', () => {
  for (const url of [
    'http://clinic.no',
    'https://127.0.0.1',
    'https://localhost',
    'https://metadata.internal',
    'https://user:password@clinic.no',
    'https://clinic.no:9000',
  ])
    expect(() => publicHttpsUrl(url)).toThrow();
  expect(publicHttpsUrl('https://clinic.example.org/priser').protocol).toBe('https:');
  expect(network.fetch).not.toHaveBeenCalled();
});
