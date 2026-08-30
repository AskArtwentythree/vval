import type { VerificationStatus } from '@/lib/verification/types';

export const CHALLENGE_TARGET_COUNT = 6;
const CHALLENGE_TTL_MS = 20 * 60 * 1000;

export type ChallengeTarget = { x: number; y: number };

export type ChallengePlan = {
  version: 1;
  expiresAt: number;
  targets: ChallengeTarget[];
};

type ChallengeSample = {
  targetX: number;
  targetY: number;
  yaw: number;
  pitch: number;
  faceCount: number;
};

type SubmittedEvidence = {
  document: {
    brightness: number;
    sharpness: number;
    glareRatio: number;
    textLength: number;
    mrzValid: boolean;
    barcodeDetected: boolean;
    faceDetected: boolean;
    expired: boolean | null;
  };
  challenge: {
    samples: ChallengeSample[];
    blinkObserved: boolean;
    singleFaceRatio: number;
    liveScore: number | null;
    realScore: number | null;
    faceSimilarity: number | null;
  };
};

export type VerificationEvaluation = {
  status: Extract<VerificationStatus, 'verified' | 'review'>;
  reasonCodes: string[];
};

function randomFraction(value: number) {
  return value / 0xffffffff;
}

export function createChallengePlan(): ChallengePlan {
  const ranges = [
    [12, 34, 14, 34],
    [66, 88, 14, 34],
    [12, 34, 66, 84],
    [66, 88, 66, 84],
    [38, 62, 12, 28],
    [38, 62, 70, 86],
  ];
  const random = new Uint32Array(ranges.length * 3);
  crypto.getRandomValues(random);
  const targets = ranges.map(([minX, maxX, minY, maxY], index) => ({
    x: Number(
      (minX + randomFraction(random[index * 2]) * (maxX - minX)).toFixed(3),
    ),
    y: Number(
      (minY + randomFraction(random[index * 2 + 1]) * (maxY - minY)).toFixed(3),
    ),
  }));

  for (let index = targets.length - 1; index > 0; index -= 1) {
    const randomIndex = random[ranges.length * 2 + index] % (index + 1);
    [targets[index], targets[randomIndex]] = [
      targets[randomIndex],
      targets[index],
    ];
  }

  return {
    version: 1,
    expiresAt: Date.now() + CHALLENGE_TTL_MS,
    targets,
  };
}

export function parseChallengePlan(value: string | null): ChallengePlan | null {
  if (!value) return null;
  try {
    const plan = JSON.parse(value) as Partial<ChallengePlan>;
    if (
      plan.version !== 1 ||
      !Number.isFinite(plan.expiresAt) ||
      !Array.isArray(plan.targets) ||
      plan.targets.length !== CHALLENGE_TARGET_COUNT ||
      !plan.targets.every(
        (target) =>
          target &&
          Number.isFinite(target.x) &&
          Number.isFinite(target.y) &&
          target.x >= 0 &&
          target.x <= 100 &&
          target.y >= 0 &&
          target.y <= 100,
      )
    ) {
      return null;
    }
    return plan as ChallengePlan;
  } catch {
    return null;
  }
}

export async function hashChallengeToken(token: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function secureHashEqual(first: string, second: string) {
  if (first.length !== second.length) return false;
  let difference = 0;
  for (let index = 0; index < first.length; index += 1) {
    difference |= first.charCodeAt(index) ^ second.charCodeAt(index);
  }
  return difference === 0;
}

function finiteNumber(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= minimum &&
    value <= maximum
  );
}

function optionalScore(value: unknown): value is number | null {
  return value === null || finiteNumber(value, 0, 1);
}

function correlation(first: number[], second: number[]) {
  if (first.length !== second.length || first.length < 3) return 0;
  const firstMean = first.reduce((sum, value) => sum + value, 0) / first.length;
  const secondMean =
    second.reduce((sum, value) => sum + value, 0) / second.length;
  let numerator = 0;
  let firstVariance = 0;
  let secondVariance = 0;
  for (let index = 0; index < first.length; index += 1) {
    const firstDelta = first[index] - firstMean;
    const secondDelta = second[index] - secondMean;
    numerator += firstDelta * secondDelta;
    firstVariance += firstDelta * firstDelta;
    secondVariance += secondDelta * secondDelta;
  }
  const denominator = Math.sqrt(firstVariance * secondVariance);
  return denominator ? numerator / denominator : 0;
}

function isSubmittedEvidence(
  value: unknown,
  plan: ChallengePlan,
): value is SubmittedEvidence {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SubmittedEvidence>;
  const document = candidate.document;
  const challenge = candidate.challenge;
  if (!document || typeof document !== 'object') return false;
  if (!challenge || typeof challenge !== 'object') return false;

  if (
    !finiteNumber(document.brightness, 0, 255) ||
    !finiteNumber(document.sharpness, 0, 1000) ||
    !finiteNumber(document.glareRatio, 0, 1) ||
    !finiteNumber(document.textLength, 0, 100_000) ||
    !Number.isInteger(document.textLength) ||
    typeof document.mrzValid !== 'boolean' ||
    typeof document.barcodeDetected !== 'boolean' ||
    typeof document.faceDetected !== 'boolean' ||
    (document.expired !== null && typeof document.expired !== 'boolean')
  ) {
    return false;
  }

  if (
    !Array.isArray(challenge.samples) ||
    challenge.samples.length !== plan.targets.length ||
    typeof challenge.blinkObserved !== 'boolean' ||
    !finiteNumber(challenge.singleFaceRatio, 0, 1) ||
    !optionalScore(challenge.liveScore) ||
    !optionalScore(challenge.realScore) ||
    !optionalScore(challenge.faceSimilarity)
  ) {
    return false;
  }

  return challenge.samples.every((sample, index) => {
    if (!sample || typeof sample !== 'object') return false;
    const target = plan.targets[index];
    return (
      finiteNumber(sample.targetX, 0, 100) &&
      finiteNumber(sample.targetY, 0, 100) &&
      Math.abs(sample.targetX - target.x) < 0.0001 &&
      Math.abs(sample.targetY - target.y) < 0.0001 &&
      finiteNumber(sample.yaw, -Math.PI, Math.PI) &&
      finiteNumber(sample.pitch, -Math.PI, Math.PI) &&
      Number.isInteger(sample.faceCount) &&
      sample.faceCount >= 0 &&
      sample.faceCount <= 3
    );
  });
}

export function evaluateVerification(
  plan: ChallengePlan,
  value: unknown,
): VerificationEvaluation | null {
  if (!isSubmittedEvidence(value, plan)) return null;
  const { document, challenge } = value;
  const validSamples = challenge.samples.filter(
    (sample) => sample.faceCount === 1,
  );
  const poseCorrelation =
    (Math.abs(
      correlation(
        validSamples.map((sample) => sample.targetX),
        validSamples.map((sample) => sample.yaw),
      ),
    ) +
      Math.abs(
        correlation(
          validSamples.map((sample) => sample.targetY),
          validSamples.map((sample) => sample.pitch),
        ),
      )) /
    2;
  const reasonCodes: string[] = [];

  if (Date.now() > plan.expiresAt) reasonCodes.push('challenge_expired');
  if (
    document.brightness < 55 ||
    document.brightness > 225 ||
    document.sharpness < 7 ||
    document.glareRatio > 0.22
  ) {
    reasonCodes.push('document_quality');
  }
  if (
    !document.mrzValid &&
    !document.barcodeDetected &&
    document.textLength < 35
  ) {
    reasonCodes.push('document_structure');
  }
  if (!document.faceDetected) reasonCodes.push('document_face_missing');
  if (document.expired) reasonCodes.push('document_expired');
  if (validSamples.length < plan.targets.length) {
    reasonCodes.push('challenge_incomplete');
  }
  if (challenge.singleFaceRatio < 0.85) {
    reasonCodes.push('single_face_not_consistent');
  }
  if (!challenge.blinkObserved) reasonCodes.push('blink_not_observed');
  if (poseCorrelation < 0.25) reasonCodes.push('motion_not_correlated');
  if (challenge.faceSimilarity === null || challenge.faceSimilarity < 0.5) {
    reasonCodes.push('document_face_mismatch');
  }
  if (challenge.realScore === null) {
    reasonCodes.push('anti_spoof_unavailable');
  } else if (challenge.realScore < 0.5) {
    reasonCodes.push('possible_spoof_signal');
  }
  if (challenge.liveScore === null) {
    reasonCodes.push('liveness_unavailable');
  } else if (challenge.liveScore < 0.5) {
    reasonCodes.push('weak_liveness_signal');
  }

  return {
    status: reasonCodes.length ? 'review' : 'verified',
    reasonCodes,
  };
}
