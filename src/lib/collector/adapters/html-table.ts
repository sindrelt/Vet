import { load } from 'cheerio';
import { parseNorwegianPrice } from '../normalize';
import { snapshotSchema } from '../../domain';
import { adapterConfigSchema, type AdapterConfig, type Extracted } from '../config';
const norm = (v: string) => v.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('nb');
export function extractHtml(html: string, input: AdapterConfig, sourceUrl: string): Extracted[] {
  const config = adapterConfigSchema.parse(input),
    $ = load(html);
  $('script,style,noscript').remove();
  return config.rows.map((rule) => {
    const matching = $(config.rowSelector)
      .toArray()
      .filter((row) => norm($(row).find(config.nameSelector).text()) === norm(rule.label));
    if (matching.length !== 1)
      throw new Error(
        `Forventet én rad for «${rule.label}», fant ${matching.length}. Ingen priser endres.`,
      );
    const row = $(matching[0]),
      priceText = row.find(config.priceSelector).text().trim();
    return {
      treatmentId: rule.treatmentId,
      snapshot: snapshotSchema.parse({
        originalName: rule.originalName,
        price: parseNorwegianPrice(priceText),
        includes: rule.includes,
        extras: rule.extras,
        caveats: rule.caveats,
        vat: rule.vat,
        sourceUrl,
        originalText: row.text().replace(/\s+/g, ' ').trim(),
      }),
    };
  });
}
