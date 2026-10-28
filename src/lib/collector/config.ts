import { z } from 'zod';
import { snapshotSchema } from '../domain';
const row = snapshotSchema.omit({ price: true, originalText: true, sourceUrl: true }).extend({
  treatmentId: z.string().min(1),
  label: z.string().min(2),
});
export const adapterConfigSchema = z.object({
  // Exact allowlisted labels. Any missing or duplicate configured row aborts the whole source.
  rows: z.array(row).min(1).max(30),
  rowSelector: z.string().min(1).max(200).default('table tr'),
  nameSelector: z.string().min(1).max(200).default('td:first-child'),
  priceSelector: z.string().min(1).max(200).default('td:last-child'),
});
export type AdapterConfig = z.infer<typeof adapterConfigSchema>;
export interface Extracted {
  treatmentId: string;
  snapshot: z.infer<typeof snapshotSchema>;
}
