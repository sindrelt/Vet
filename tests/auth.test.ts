import { afterEach, expect, test, vi } from 'vitest';
import { authenticated, adminConfigured, validOrigin } from '../src/lib/server/auth';
afterEach(() => vi.unstubAllEnvs());
const header = (u: string, p: string) => `Basic ${Buffer.from(`${u}:${p}`).toString('base64')}`;
test('administrasjon er stengt uten sterkt passord', () => {
  vi.stubEnv('ADMIN_PASSWORD', 'short');
  expect(adminConfigured()).toBe(false);
  expect(authenticated(header('admin', 'short'))).toBe(false);
});
test('begge innloggingsfelter må stemme', () => {
  vi.stubEnv('ADMIN_PASSWORD', 'test-only-strong-password-123');
  vi.stubEnv('ADMIN_USER', 'admin');
  expect(authenticated(header('admin', 'test-only-strong-password-123'))).toBe(true);
  expect(authenticated(header('other', 'test-only-strong-password-123'))).toBe(false);
  expect(authenticated(header('admin', 'wrong'))).toBe(false);
  expect(authenticated('Basic invalid')).toBe(false);
  expect(authenticated(null)).toBe(false);
});
test('endringer krever nøyaktig samme origin', () => {
  expect(validOrigin('https://dyrpris.example', 'https://dyrpris.example')).toBe(true);
  expect(validOrigin('https://evil.example', 'https://dyrpris.example')).toBe(false);
  expect(validOrigin('https://dyrpris.example.evil.example', 'https://dyrpris.example')).toBe(
    false,
  );
  expect(validOrigin(null, 'https://dyrpris.example')).toBe(false);
});
