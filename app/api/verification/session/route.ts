import {
  createChallengePlan,
  evaluateVerification,
} from '@/lib/verification/server-policy';
import {
  issueChallengeToken,
  verifyChallengeToken,
} from '@/lib/verification/session-token';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const attemptIdPattern = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i;
const globalVerification = globalThis as typeof globalThis & {
  consumedVerificationAttempts?: Map<string, number>;
};
const consumedAttempts =
  globalVerification.consumedVerificationAttempts ?? new Map<string, number>();
globalVerification.consumedVerificationAttempts = consumedAttempts;

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

export async function POST() {
  const attemptId = crypto.randomUUID();
  const challengePlan = createChallengePlan();
  const challengeToken = await issueChallengeToken(attemptId, challengePlan);

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
    body.challengeToken.length > 4096
  ) {
    return json({ error: 'Invalid verification evidence.' }, 400);
  }
  if (body.status !== undefined || body.reasonCodes !== undefined) {
    return json({ error: 'Verification decisions are server-owned.' }, 400);
  }

  const challenge = await verifyChallengeToken(body.challengeToken);
  if (!challenge || challenge.attemptId !== body.attemptId) {
    return json({ error: 'Invalid verification challenge.' }, 401);
  }
  const evaluation = evaluateVerification(challenge.plan, body.evidence);
  if (!evaluation) {
    return json({ error: 'Invalid verification evidence.' }, 400);
  }

  const now = Date.now();
  for (const [attemptId, expiresAt] of consumedAttempts) {
    if (expiresAt < now) consumedAttempts.delete(attemptId);
  }
  if (consumedAttempts.has(body.attemptId)) {
    return json({ error: 'Verification session was already completed.' }, 409);
  }
  consumedAttempts.set(body.attemptId, challenge.plan.expiresAt);
  return json({ ok: true, ...evaluation });
}

export async function GET() {
  return json({ error: 'Start a verification session with POST.' }, 405);
}
