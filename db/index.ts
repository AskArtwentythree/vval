import { env } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/d1';

import * as schema from './schema';

let schemaReady: Promise<void> | null = null;

export function getDb() {
  if (!env.DB) {
    throw new Error(
      'Cloudflare D1 binding `DB` is unavailable. Set `d1` to `DB` in .openai/hosting.json.',
    );
  }

  return drizzle(env.DB, { schema });
}

export async function ensureVerificationSchema() {
  if (!env.DB) {
    throw new Error('Cloudflare D1 binding `DB` is unavailable.');
  }

  schemaReady ??= env.DB.batch([
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS verification_attempts (
        id TEXT PRIMARY KEY NOT NULL,
        external_user_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        provider_applicant_id TEXT,
        provider_inspection_id TEXT,
        status TEXT NOT NULL,
        reason_code TEXT,
        level_name TEXT,
        consent_version TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        completed_at INTEGER
      )
    `),
    env.DB.prepare(
      'CREATE UNIQUE INDEX IF NOT EXISTS verification_attempts_external_user_id_unique ON verification_attempts (external_user_id)',
    ),
    env.DB.prepare(
      'CREATE INDEX IF NOT EXISTS verification_attempts_provider_applicant_id_idx ON verification_attempts (provider_applicant_id)',
    ),
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS verification_events (
        id TEXT PRIMARY KEY NOT NULL,
        attempt_id TEXT NOT NULL,
        provider_event_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        status TEXT NOT NULL,
        reason_code TEXT,
        payload_hash TEXT NOT NULL,
        received_at INTEGER NOT NULL,
        FOREIGN KEY (attempt_id) REFERENCES verification_attempts(id) ON DELETE CASCADE
      )
    `),
    env.DB.prepare(
      'CREATE UNIQUE INDEX IF NOT EXISTS verification_events_provider_event_id_unique ON verification_events (provider_event_id)',
    ),
    env.DB.prepare(
      'CREATE INDEX IF NOT EXISTS verification_events_attempt_id_idx ON verification_events (attempt_id)',
    ),
  ]).then(() => undefined);

  return schemaReady;
}
