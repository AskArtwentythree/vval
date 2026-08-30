import {
  completeLocalAttempt,
  createVerificationAttempt,
  getVerificationAttempt,
  toPublicAttempt,
} from '@/lib/verification/repository';
import {
  createChallengePlan,
  evaluateVerification,
  hashChallengeToken,
  parseChallengePlan,
  secureHashEqual,
} from '@/lib/verification/server-policy';

export const dynamic = 'force-dynamic';

const attemptIdPattern = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i;

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    consentVersion?: unknown;
  };

  const attemptId = crypto.randomUUID();
  const challengeToken = crypto.randomUUID();
  const challengeHash = await hashChallengeToken(challengeToken);
  const challengePlan = createChallengePlan();
  const consentVersion =
    typeof body.consentVersion === 'string' && body.consentVersion.length <= 40
      ? body.consentVersion
      : '2026-08-29';

  try {
    await createVerificationAttempt({
      id: attemptId,
      externalUserId: `challenge_${challengeHash}`,
      provider: 'local',
      levelName: JSON.stringify(challengePlan),
      consentVersion,
    });
  } catch {
    return json({ error: 'Could not create a verification session.' }, 503);
  }

  return json({
    mode: 'local',
    attemptId,
    challengeToken,
    challengeTargets: challengePlan.targets,
    status: 'created',
  });
}

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    attemptId?: unknown;
    status?: unknown;
    reasonCodes?: unknown;
    challengeToken?: unknown;
    evidence?: unknown;
  };
  if (
    typeof body.attemptId !== 'string' ||
    !attemptIdPattern.test(body.attemptId) ||
    typeof body.challengeToken !== 'string' ||
    body.challengeToken.length > 100
  ) {
    return json({ error: 'Invalid verification evidence.' }, 400);
  }
  if (body.status !== undefined || body.reasonCodes !== undefined) {
    return json({ error: 'Verification decisions are server-owned.' }, 400);
  }

  const attempt = await getVerificationAttempt(body.attemptId);
  if (!attempt || attempt.provider !== 'local') {
    return json({ error: 'Verification session not found.' }, 404);
  }
  if (attempt.status !== 'created') {
    return json({ error: 'Verification session was already completed.' }, 409);
  }
  const challengePlan = parseChallengePlan(attempt.levelName);
  if (!challengePlan) {
    return json({ error: 'Verification challenge is unavailable.' }, 409);
  }
  const submittedHash = await hashChallengeToken(body.challengeToken);
  const expectedHash = attempt.externalUserId.replace(/^challenge_/, '');
  if (
    !attempt.externalUserId.startsWith('challenge_') ||
    !secureHashEqual(submittedHash, expectedHash)
  ) {
    return json({ error: 'Invalid verification challenge.' }, 401);
  }
  const evaluation = evaluateVerification(challengePlan, body.evidence);
  if (!evaluation) {
    return json({ error: 'Invalid verification evidence.' }, 400);
  }
  const matched = await completeLocalAttempt({
    attemptId: body.attemptId,
    status: evaluation.status,
    reasonCodes: evaluation.reasonCodes,
  });
  if (!matched) {
    return json({ error: 'Verification session was already completed.' }, 409);
  }
  return json({ ok: true, ...evaluation });
}

export async function GET(request: Request) {
  const attemptId = new URL(request.url).searchParams.get('attemptId');
  if (!attemptId || !attemptIdPattern.test(attemptId)) {
    return json({ error: 'Invalid verification session.' }, 400);
  }

  const attempt = await getVerificationAttempt(attemptId);
  if (!attempt) return json({ error: 'Verification session not found.' }, 404);

  return json(toPublicAttempt(attempt));
}
