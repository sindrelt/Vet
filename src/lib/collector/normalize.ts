import { priceSchema, type Price } from '../domain';
export function parseNorwegianPrice(input: string): Price {
  const text = input
    .normalize('NFKC')
    .replace(/\u00a0/g, ' ')
    .trim();
  if (
    /^(pris\s+)?(på forespørsel|etter avtale|ikke oppgitt|kontakt (oss|klinikken))\.?$/i.test(text)
  )
    return { kind: 'unknown', minOre: null, maxOre: null };
  if (!text || text.length > 100) throw new Error('Manglende eller for lang pristekst');
  const amount = '(?:\\d{1,3}(?:[ .]\\d{3})+|\\d+)(?:,\\d{1,2}|,-)?';
  const currency = '(?:kr\\.?|NOK)';
  const fixed = new RegExp(`^(?:${currency}\\s*)?(${amount})(?:\\s*${currency})?$`, 'i');
  const from = new RegExp(`^fra\\s+(?:${currency}\\s*)?(${amount})(?:\\s*${currency})?$`, 'i');
  const range = new RegExp(
    `^(?:${currency}\\s*)?(${amount})\\s*(?:${currency}\\s*)?[–—-]\\s*(?:${currency}\\s*)?(${amount})(?:\\s*${currency})?$`,
    'i',
  );
  const ore = (v: string) => {
    const clean = v.replace(/[ .]/g, '').replace(/,-$/, '');
    const [whole, decimals = ''] = clean.split(',');
    return Number(whole) * 100 + Number(decimals.padEnd(2, '0'));
  };
  let match: RegExpMatchArray | null;
  if ((match = text.match(from)))
    return priceSchema.parse({ kind: 'from', minOre: ore(match[1]), maxOre: null });
  if ((match = text.match(range)))
    return priceSchema.parse({ kind: 'range', minOre: ore(match[1]), maxOre: ore(match[2]) });
  if ((match = text.match(fixed)))
    return priceSchema.parse({ kind: 'fixed', minOre: ore(match[1]), maxOre: null });
  throw new Error('Pristeksten har et ukjent eller tvetydig format');
}
