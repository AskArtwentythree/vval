import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const verificationAttempts = sqliteTable(
  'verification_attempts',
  {
    id: text('id').primaryKey(),
    externalUserId: text('external_user_id').notNull(),
    provider: text('provider').notNull(),
    providerApplicantId: text('provider_applicant_id'),
    providerInspectionId: text('provider_inspection_id'),
    status: text('status').notNull(),
    reasonCode: text('reason_code'),
    levelName: text('level_name'),
    consentVersion: text('consent_version').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    completedAt: integer('completed_at'),
  },
  (table) => [
    uniqueIndex('verification_attempts_external_user_id_unique').on(
      table.externalUserId,
    ),
    index('verification_attempts_provider_applicant_id_idx').on(
      table.providerApplicantId,
    ),
  ],
);

export const verificationEvents = sqliteTable(
  'verification_events',
  {
    id: text('id').primaryKey(),
    attemptId: text('attempt_id')
      .notNull()
      .references(() => verificationAttempts.id, { onDelete: 'cascade' }),
    providerEventId: text('provider_event_id').notNull(),
    eventType: text('event_type').notNull(),
    status: text('status').notNull(),
    reasonCode: text('reason_code'),
    payloadHash: text('payload_hash').notNull(),
    receivedAt: integer('received_at').notNull(),
  },
  (table) => [
    uniqueIndex('verification_events_provider_event_id_unique').on(
      table.providerEventId,
    ),
    index('verification_events_attempt_id_idx').on(table.attemptId),
  ],
);
