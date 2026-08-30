import { verificationBuildSecret } from '@/.generated/verification-secret';
import {
  parseChallengePlan,
  type ChallengePlan,
} from '@/lib/verification/server-policy';

type ChallengeTokenPayload = {
  version: 1;
  attemptId: string;
  plan: ChallengePlan;
};

const encoder = new TextEncoder();
let signingKeyPromise: Promise<CryptoKey> | null = null;

function signingKey() {
  signingKeyPromise ??= crypto.subtle.importKey(
    'raw',
    encoder.encode(
      process.env.VERIFICATION_SECRET?.trim() || verificationBuildSecret,
    ),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
  return signingKeyPromise;
}

function encode(value: Uint8Array | string) {
  const bytes = typeof value === 'string' ? encoder.encode(value) : value;
  return Buffer.from(bytes).toString('base64url');
}

function decode(value: string) {
  return new Uint8Array(Buffer.from(value, 'base64url'));
}

export async function issueChallengeToken(
  attemptId: string,
  plan: ChallengePlan,
) {
  const payload = encode(
    JSON.stringify({
      version: 1,
      attemptId,
      plan,
    } satisfies ChallengeTokenPayload),
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      'HMAC',
      await signingKey(),
      encoder.encode(payload),
    ),
  );
  return `${payload}.${encode(signature)}`;
}

export async function verifyChallengeToken(value: string) {
  const parts = value.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  try {
    const valid = await crypto.subtle.verify(
      'HMAC',
      await signingKey(),
      decode(parts[1]),
      encoder.encode(parts[0]),
    );
    if (!valid) return null;
    const payload = JSON.parse(
      Buffer.from(parts[0], 'base64url').toString('utf8'),
    ) as Partial<ChallengeTokenPayload>;
    if (payload.version !== 1 || typeof payload.attemptId !== 'string') {
      return null;
    }
    const plan = parseChallengePlan(JSON.stringify(payload.plan));
    if (!plan) return null;
    return { attemptId: payload.attemptId, plan };
  } catch {
    return null;
  }
}
