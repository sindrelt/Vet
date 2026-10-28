import { PDFParse } from 'pdf-parse';
import { snapshotSchema } from '../../domain';
import { parseNorwegianPrice } from '../normalize';
import { adapterConfigSchema, type AdapterConfig, type Extracted } from '../config';
export function extractPdfText(text: string, input: AdapterConfig, sourceUrl: string): Extracted[] {
  const config = adapterConfigSchema.parse(input);
  const lines = text
    .normalize('NFKC')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  return config.rows.map((rule) => {
    const linesForLabel = lines.filter(
      (l) => l.startsWith(rule.label) && /^[\s:;\t]/.test(l.slice(rule.label.length)),
    );
    if (linesForLabel.length !== 1)
      throw new Error(`PDF: forventet én rad for «${rule.label}». Ingen priser endres.`);
    const line = linesForLabel[0];
    return {
      treatmentId: rule.treatmentId,
      snapshot: snapshotSchema.parse({
        originalName: rule.originalName,
        price: parseNorwegianPrice(line.slice(rule.label.length).replace(/^[\s:;]+/, '')),
        includes: rule.includes,
        extras: rule.extras,
        caveats: rule.caveats,
        vat: rule.vat,
        sourceUrl,
        originalText: line,
      }),
    };
  });
}
export async function extractPdf(buffer: Uint8Array, config: AdapterConfig, url: string) {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return extractPdfText(result.text, config, url);
  } finally {
    await parser.destroy();
  }
}
