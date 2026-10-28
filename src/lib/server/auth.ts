import { createHash, timingSafeEqual } from 'node:crypto';
function safeEqual(a: string, b: string) {
  return timingSafeEqual(
    createHash('sha256').update(a).digest(),
    createHash('sha256').update(b).digest(),
  );
}
export function adminConfigured() {
  return (process.env.ADMIN_PASSWORD?.length ?? 0) >= 20;
}
export function authenticated(authorization: string | null) {
  if (!adminConfigured() || !authorization?.startsWith('Basic ')) return false;
  try {
    const raw = Buffer.from(authorization.slice(6), 'base64').toString('utf8');
    const split = raw.indexOf(':');
    if (split < 0) return false;
    const userOk = safeEqual(raw.slice(0, split), process.env.ADMIN_USER || 'admin');
    const passOk = safeEqual(raw.slice(split + 1), process.env.ADMIN_PASSWORD!);
    return userOk && passOk;
  } catch {
    return false;
  }
}
export function validOrigin(origin: string | null, expected: string) {
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(expected).origin;
  } catch {
    return false;
  }
}
