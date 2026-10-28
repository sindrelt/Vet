import { EnvHttpProxyAgent, fetch as proxyFetch } from 'undici';
import robotsParser from 'robots-parser';
import { isIP } from 'node:net';
const agent = new EnvHttpProxyAgent();
const lastRequest = new Map<string, number>();
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
export function publicHttpsUrl(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    url.hash ||
    isIP(url.hostname) ||
    !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(url.hostname) ||
    /(^|\.)(localhost|local|internal|test|invalid|example)$/.test(url.hostname)
  )
    throw new Error('Bare offentlige HTTPS-kilder uten innlogging er tillatt');
  return url;
}
export async function fetchDocument(value: string, contact: string, maxBytes = 5_000_000) {
  const url = publicHttpsUrl(value);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact))
    throw new Error('Sett COLLECTOR_CONTACT til en ekte kontaktadresse');
  for (let attempt = 0; attempt < 2; attempt++) {
    await wait(Math.max(0, 2500 - (Date.now() - (lastRequest.get(url.host) ?? 0))));
    lastRequest.set(url.host, Date.now());
    const response = await proxyFetch(url, {
      dispatcher: agent,
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
      headers: {
        'User-Agent': `DyrprisBot/0.1 (+mailto:${contact})`,
        Accept: 'text/html,application/pdf,text/plain;q=0.9',
      },
    });
    if ([429, 502, 503, 504].includes(response.status) && attempt === 0) {
      const retry = response.headers.get('retry-after');
      await response.body?.cancel();
      const delay = retry
        ? /^\d+$/.test(retry)
          ? Number(retry) * 1000
          : Date.parse(retry) - Date.now()
        : 3000;
      if (!Number.isFinite(delay) || delay > 30000)
        throw new Error('Kilden ber om senere forsøk. Kjør jobben senere.');
      await wait(Math.max(3000, delay));
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(
        `Kilden svarte HTTP ${response.status}. Ingen omdirigering eller sperre omgås.`,
      );
    }
    if (Number(response.headers.get('content-length') ?? 0) > maxBytes) {
      await response.body?.cancel();
      throw new Error('Kilden er for stor');
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Kilden mangler innhold');
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) {
          await reader.cancel();
          throw new Error('Kilden er for stor');
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    return {
      bytes: Buffer.concat(chunks),
      contentType: response.headers.get('content-type') || '',
    };
  }
  throw new Error('Innhenting feilet etter begrenset nytt forsøk');
}
export async function checkRobots(url: string, contact: string) {
  const source = publicHttpsUrl(url),
    robotsUrl = `${source.origin}/robots.txt`;
  // Fail closed, including HTTP 404: a person must inspect policy before enabling the source.
  const { bytes } = await fetchDocument(robotsUrl, contact, 500_000);
  const robots = robotsParser(robotsUrl, bytes.toString('utf8'));
  if (robots.isAllowed(url, 'DyrprisBot') === false)
    throw new Error('robots.txt tillater ikke denne kilden');
  const delay = robots.getCrawlDelay('DyrprisBot');
  if (delay !== undefined && delay > 30)
    throw new Error('robots.txt krever lengre pause. Kilden må vurderes separat.');
  if (delay) await wait(Math.max(2500, delay * 1000));
}
