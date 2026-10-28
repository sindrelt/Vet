import { sql } from 'drizzle-orm';
import {
  pgTable,
  text,
  integer,
  timestamp,
  jsonb,
  uniqueIndex,
  boolean,
} from 'drizzle-orm/pg-core';
import type { Snapshot, Treatment } from '../lib/domain';
export const chains = pgTable('chains', { id: text().primaryKey(), name: text().notNull() });
export const clinics = pgTable('clinics', {
  id: text().primaryKey(),
  slug: text().notNull().unique(),
  branchKey: text('branch_key').notNull().unique(),
  name: text().notNull(),
  chainId: text('chain_id').references(() => chains.id),
  municipality: text().notNull(),
  area: text().notNull(),
  place: text().notNull(),
  address: text().notNull(),
  postalCode: text('postal_code').notNull(),
  phone: text(),
  website: text().notNull(),
  verifiedAt: timestamp('verified_at', { withTimezone: true }).notNull(),
});
export const treatments = pgTable('treatments', {
  id: text().primaryKey(),
  category: text().$type<Treatment['category']>().notNull(),
  species: text().$type<Treatment['species']>().notNull(),
  sex: text().$type<Treatment['sex']>().notNull(),
  weightMinGrams: integer('weight_min_grams'),
  weightMaxGrams: integer('weight_max_grams'),
  packageKey: text('package_key').notNull(),
  packageLabel: text('package_label').notNull(),
});
export const sources = pgTable('sources', {
  id: text().primaryKey(),
  clinicId: text('clinic_id')
    .references(() => clinics.id)
    .notNull(),
  url: text().notNull().unique(),
  adapter: text().notNull(),
  config: jsonb().notNull(),
  termsUrl: text('terms_url').notNull(),
  termsReviewedAt: timestamp('terms_reviewed_at', { withTimezone: true }).notNull(),
  termsNote: text('terms_note').notNull(),
  enabled: boolean().notNull().default(false),
  lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
  lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
  lastError: text('last_error'),
});
export const offers = pgTable(
  'offers',
  {
    id: text().primaryKey(),
    clinicId: text('clinic_id')
      .references(() => clinics.id)
      .notNull(),
    treatmentId: text('treatment_id')
      .references(() => treatments.id)
      .notNull(),
    sourceId: text('source_id')
      .references(() => sources.id)
      .notNull(),
    snapshot: jsonb().$type<Snapshot>().notNull(),
    contentHash: text('content_hash').notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull(),
    checkedAt: timestamp('checked_at', { withTimezone: true }).notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
  },
  (t) => [uniqueIndex('offer_branch_treatment').on(t.clinicId, t.treatmentId)],
);
export const proposals = pgTable(
  'proposals',
  {
    id: text().primaryKey(),
    clinicId: text('clinic_id')
      .references(() => clinics.id)
      .notNull(),
    treatmentId: text('treatment_id')
      .references(() => treatments.id)
      .notNull(),
    sourceId: text('source_id')
      .references(() => sources.id)
      .notNull(),
    snapshot: jsonb().$type<Snapshot>().notNull(),
    contentHash: text('content_hash').notNull(),
    baseHash: text('base_hash'),
    status: text().$type<'pending' | 'approved' | 'rejected'>().notNull().default('pending'),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull(),
    checkedAt: timestamp('checked_at', { withTimezone: true }).notNull(),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewedBy: text('reviewed_by'),
    reviewNote: text('review_note'),
  },
  (t) => [
    uniqueIndex('proposal_pending_content')
      .on(t.clinicId, t.treatmentId, t.contentHash)
      .where(sql`${t.status} = 'pending'`),
  ],
);
export const priceHistory = pgTable('price_history', {
  id: text().primaryKey(),
  offerId: text('offer_id')
    .references(() => offers.id)
    .notNull(),
  proposalId: text('proposal_id')
    .references(() => proposals.id)
    .notNull()
    .unique(),
  snapshot: jsonb().$type<Snapshot>().notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
  reviewedBy: text('reviewed_by').notNull(),
});
