import { and, eq } from 'drizzle-orm';

import { ensureVerificationSchema, getDb } from '@/db';
import { verificationAttempts, verificationEvents } from '@/db/schema';
import type {
  PublicVerificationAttempt,
  VerificationStatus,
} from '@/lib/verification/types';

type NewAttempt = {
  id: string;
  externalUserId: string;
  provider: 'local';
  levelName: string | null;
  consentVersion: string;
};

export async function createVerificationAttempt(input: NewAttempt) {
  await ensureVerificationSchema();
  const now = Date.now();

  await getDb().insert(verificationAttempts).values({
    id: input.id,
    externalUserId: input.externalUserId,
    provider: input.provider,
    levelName: input.levelName,
    consentVersion: input.consentVersion,
    status: 'created',
    createdAt: now,
    updatedAt: now,
  });
}

export async function getVerificationAttempt(id: string) {
  await ensureVerificationSchema();
  return getDb().query.verificationAttempts.findFirst({
    where: eq(verificationAttempts.id, id),
  });
}

export async function completeLocalAttempt(input: {
  attemptId: string;
  status: Extract<VerificationStatus, 'verified' | 'review' | 'rejected'>;
  reasonCodes: string[];
}) {
  await ensureVerificationSchema();
  const db = getDb();
  const attempt = await db.query.verificationAttempts.findFirst({
    where: eq(verificationAttempts.id, input.attemptId),
  });

  if (
    !attempt ||
    attempt.provider !== 'local' ||
    attempt.status !== 'created'
  ) {
    return false;
  }

  const now = Date.now();
  const reasonCode = input.reasonCodes.length
    ? input.reasonCodes.join(',').slice(0, 500)
    : null;
  const canonicalResult = JSON.stringify({
    attemptId: input.attemptId,
    status: input.status,
    reasonCodes: input.reasonCodes,
  });
  const payloadHash = Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(canonicalResult),
      ),
    ),
  )
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

  const claimed = await db
    .update(verificationAttempts)
    .set({
      status: input.status,
      reasonCode,
      updatedAt: now,
      completedAt: now,
    })
    .where(
      and(
        eq(verificationAttempts.id, attempt.id),
        eq(verificationAttempts.status, 'created'),
      ),
    )
    .returning({ id: verificationAttempts.id });

  if (!claimed.length) return false;

  await db.insert(verificationEvents).values({
    id: crypto.randomUUID(),
    attemptId: attempt.id,
    providerEventId: `local:${attempt.id}`,
    eventType: 'local_analysis_completed',
    status: input.status,
    reasonCode,
    payloadHash,
    receivedAt: now,
  });

  return true;
}

export function toPublicAttempt(
  attempt: NonNullable<Awaited<ReturnType<typeof getVerificationAttempt>>>,
): PublicVerificationAttempt {
  return {
    attemptId: attempt.id,
    mode: 'local',
    status: attempt.status as VerificationStatus,
    reasonCode: attempt.reasonCode,
    updatedAt: attempt.updatedAt,
  };
}
