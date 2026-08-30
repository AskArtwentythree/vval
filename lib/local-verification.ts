'use client';

export type DocumentEvidence = {
  brightness: number;
  sharpness: number;
  glareRatio: number;
  textLength: number;
  mrzDetected: boolean;
  mrzValid: boolean;
  barcodeDetected: boolean;
  faceDetected: boolean;
  embedding?: number[];
  expired: boolean | null;
  qualityPassed: boolean;
  structurePassed: boolean;
  score: number;
  issues: string[];
};

export type LiveFaceEvidence = {
  faceCount: number;
  embedding?: number[];
  similarity: number | null;
  yaw: number;
  pitch: number;
  real: number | null;
  live: number | null;
  blink: boolean;
  detectionScore: number;
};

export type ChallengeSample = {
  targetX: number;
  targetY: number;
  yaw: number;
  pitch: number;
  faceCount: number;
};

export type ChallengeEvidence = {
  samples: ChallengeSample[];
  completedTargets: number;
  totalTargets: number;
  blinkObserved: boolean;
  singleFaceRatio: number;
  liveScore: number | null;
  realScore: number | null;
  faceSimilarity: number | null;
  poseCorrelation: number;
  passed: boolean;
  reasonCodes: string[];
};

type HumanInstance = {
  load: () => Promise<unknown>;
  detect: (input: HTMLCanvasElement | HTMLVideoElement) => Promise<{
    face: Array<{
      score: number;
      embedding?: number[];
      real?: number;
      live?: number;
      rotation?: {
        angle: { yaw: number; pitch: number };
      } | null;
    }>;
    gesture: Array<{ gesture: string }>;
  }>;
  match: {
    similarity: (first: number[], second: number[]) => number;
  };
};

let humanPromise: Promise<HumanInstance> | null = null;

export function getHuman() {
  if (!humanPromise) {
    humanPromise = import('@vladmandic/human')
      .then(async ({ Human }) => {
        const human = new Human({
          modelBasePath: '/models/human/',
          backend: 'webgl',
          cacheSensitivity: 0,
          filter: { enabled: true, equalization: true, flip: false },
          face: {
            enabled: true,
            detector: { rotation: true, maxDetected: 3, return: true },
            mesh: { enabled: true },
            iris: { enabled: true },
            emotion: { enabled: false },
            description: { enabled: true },
            antispoof: { enabled: true },
            liveness: { enabled: true },
          },
          body: { enabled: false },
          hand: { enabled: false },
          object: { enabled: false },
          gesture: { enabled: true },
        }) as unknown as HumanInstance;
        await human.load();
        return human;
      })
      .catch(() => {
        humanPromise = null;
        throw new Error(
          'Face analysis could not load. Refresh this page and try again.',
        );
      });
  }
  return humanPromise;
}

export function captureVideoFrame(
  video: HTMLVideoElement,
  cropRatio = 0,
): HTMLCanvasElement {
  if (!video.videoWidth || !video.videoHeight) {
    throw new Error('The camera is not ready yet.');
  }

  const sourceX = Math.round(video.videoWidth * cropRatio);
  const sourceY = Math.round(video.videoHeight * cropRatio);
  const sourceWidth = Math.round(video.videoWidth * (1 - cropRatio * 2));
  const sourceHeight = Math.round(video.videoHeight * (1 - cropRatio * 2));
  const maxWidth = 1600;
  const scale = Math.min(1, maxWidth / sourceWidth);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sourceWidth * scale));
  canvas.height = Math.max(1, Math.round(sourceHeight * scale));
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Could not read the camera frame.');
  context.drawImage(
    video,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return canvas;
}

function imageQuality(canvas: HTMLCanvasElement) {
  const sample = document.createElement('canvas');
  const scale = Math.min(1, 360 / canvas.width);
  sample.width = Math.max(1, Math.round(canvas.width * scale));
  sample.height = Math.max(1, Math.round(canvas.height * scale));
  const context = sample.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Could not inspect the document image.');
  context.drawImage(canvas, 0, 0, sample.width, sample.height);

  const { data } = context.getImageData(0, 0, sample.width, sample.height);
  const luminance = new Float32Array(sample.width * sample.height);
  let total = 0;
  let glare = 0;
  for (let pixel = 0; pixel < luminance.length; pixel += 1) {
    const offset = pixel * 4;
    const value =
      data[offset] * 0.2126 +
      data[offset + 1] * 0.7152 +
      data[offset + 2] * 0.0722;
    luminance[pixel] = value;
    total += value;
    if (
      value > 244 &&
      Math.max(data[offset], data[offset + 1], data[offset + 2]) -
        Math.min(data[offset], data[offset + 1], data[offset + 2]) <
        12
    ) {
      glare += 1;
    }
  }

  let edgeTotal = 0;
  let edgeCount = 0;
  for (let y = 1; y < sample.height - 1; y += 1) {
    for (let x = 1; x < sample.width - 1; x += 1) {
      const index = y * sample.width + x;
      const laplacian =
        luminance[index - 1] +
        luminance[index + 1] +
        luminance[index - sample.width] +
        luminance[index + sample.width] -
        luminance[index] * 4;
      edgeTotal += Math.abs(laplacian);
      edgeCount += 1;
    }
  }

  return {
    brightness: Math.round(total / luminance.length),
    glareRatio: glare / luminance.length,
    sharpness: edgeTotal / Math.max(1, edgeCount),
  };
}

function mrzCharacterValue(character: string) {
  if (/\d/.test(character)) return Number(character);
  if (/[A-Z]/.test(character)) return character.charCodeAt(0) - 55;
  return 0;
}

function mrzChecksum(value: string) {
  const weights = [7, 3, 1];
  return (
    value.split('').reduce((sum, character, index) => {
      return sum + mrzCharacterValue(character) * weights[index % 3];
    }, 0) % 10
  );
}

function checkDigit(value: string, digit: string) {
  return /^\d$/.test(digit) && mrzChecksum(value) === Number(digit);
}

function normalizedMrzLines(text: string) {
  return text
    .toUpperCase()
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/\s/g, '')
        .replace(/[^A-Z0-9<]/g, '')
        .replace(/[«‹]/g, '<'),
    )
    .filter((line) => line.length >= 25);
}

function expiryFromMrz(value: string): boolean | null {
  if (!/^\d{6}$/.test(value)) return null;
  const year = Number(value.slice(0, 2));
  const month = Number(value.slice(2, 4));
  const day = Number(value.slice(4, 6));
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const fullYear = year >= 60 ? 1900 + year : 2000 + year;
  const expiresAt = new Date(Date.UTC(fullYear, month - 1, day, 23, 59, 59));
  return expiresAt.getTime() < Date.now();
}

function inspectMrz(text: string) {
  const lines = normalizedMrzLines(text);
  const passport = lines
    .filter((line) => line.length >= 40)
    .map((line) => line.slice(0, 44));
  if (passport.length >= 2) {
    const line2 = passport.at(-1)!.padEnd(44, '<');
    const valid =
      checkDigit(line2.slice(0, 9), line2[9]) &&
      checkDigit(line2.slice(13, 19), line2[19]) &&
      checkDigit(line2.slice(21, 27), line2[27]) &&
      checkDigit(line2.slice(28, 42), line2[42]) &&
      checkDigit(
        `${line2.slice(0, 10)}${line2.slice(13, 20)}${line2.slice(21, 43)}`,
        line2[43],
      );
    return {
      detected: true,
      valid,
      expired: expiryFromMrz(line2.slice(21, 27)),
    };
  }

  const identityCard = lines
    .filter((line) => line.length >= 27 && line.length < 40)
    .map((line) => line.slice(0, 30).padEnd(30, '<'));
  if (identityCard.length >= 3) {
    const [line1, line2] = identityCard.slice(-3);
    const valid =
      checkDigit(line1.slice(5, 14), line1[14]) &&
      checkDigit(line2.slice(0, 6), line2[6]) &&
      checkDigit(line2.slice(8, 14), line2[14]) &&
      checkDigit(
        `${line1.slice(5, 30)}${line2.slice(0, 7)}${line2.slice(8, 15)}${line2.slice(18, 29)}`,
        line2[29],
      );
    return {
      detected: true,
      valid,
      expired: expiryFromMrz(line2.slice(8, 14)),
    };
  }

  return { detected: false, valid: false, expired: null };
}

async function readBarcode(canvas: HTMLCanvasElement) {
  try {
    const [{ BrowserMultiFormatReader }, zxing] = await Promise.all([
      import('@zxing/browser'),
      import('@zxing/library'),
    ]);
    const hints = new Map();
    hints.set(zxing.DecodeHintType.POSSIBLE_FORMATS, [
      zxing.BarcodeFormat.PDF_417,
      zxing.BarcodeFormat.QR_CODE,
      zxing.BarcodeFormat.DATA_MATRIX,
    ]);
    const reader = new BrowserMultiFormatReader(hints);
    const result = reader.decodeFromCanvas(canvas);
    return Boolean(result.getText());
  } catch {
    return false;
  }
}

export async function analyzeDocument(
  canvas: HTMLCanvasElement,
  onProgress?: (progress: number, label: string) => void,
): Promise<DocumentEvidence> {
  onProgress?.(8, 'Checking image quality');
  const quality = imageQuality(canvas);
  const issues: string[] = [];
  if (quality.brightness < 55) issues.push('Document image is too dark');
  if (quality.brightness > 225) issues.push('Document image is overexposed');
  if (quality.sharpness < 7) issues.push('Document text may be out of focus');
  if (quality.glareRatio > 0.22)
    issues.push('Strong glare covers the document');
  const qualityPassed =
    quality.brightness >= 55 &&
    quality.brightness <= 225 &&
    quality.sharpness >= 7 &&
    quality.glareRatio <= 0.22;

  onProgress?.(22, 'Looking for the document portrait');
  let documentFace: { embedding?: number[]; score: number } | undefined;
  try {
    const human = await getHuman();
    const faceResult = await human.detect(canvas);
    documentFace = faceResult.face[0];
  } catch {
    issues.push('Face analysis models were unavailable');
  }

  onProgress?.(45, 'Reading visible text on this device');
  let text = '';
  try {
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('eng', 1, {
      logger(message) {
        if (message.status === 'recognizing text') {
          onProgress?.(
            45 + Math.round((message.progress ?? 0) * 35),
            'Reading visible text on this device',
          );
        }
      },
    });
    const result = await worker.recognize(canvas);
    text = result.data.text;
    await worker.terminate();
  } catch {
    issues.push('Text reading was unavailable');
  }

  const mrz = inspectMrz(text);
  onProgress?.(84, 'Checking machine-readable structure');
  const barcodeDetected = await readBarcode(canvas);
  const textLength = text.replace(/\s/g, '').length;
  const structurePassed = mrz.valid || barcodeDetected || textLength >= 35;

  if (!documentFace) issues.push('No portrait was found on the document');
  if (!mrz.detected && !barcodeDetected && textLength < 35) {
    issues.push('Not enough document structure could be read');
  }
  if (mrz.detected && !mrz.valid) {
    issues.push('Machine-readable zone checksum did not validate');
  }
  if (mrz.expired) issues.push('The document appears to be expired');

  let score = 0;
  if (qualityPassed) score += 30;
  if (documentFace) score += 25;
  if (textLength >= 35) score += 15;
  if (mrz.valid) score += 25;
  else if (barcodeDetected) score += 20;
  if (mrz.expired) score -= 20;

  onProgress?.(100, 'Local document checks complete');
  return {
    ...quality,
    textLength,
    mrzDetected: mrz.detected,
    mrzValid: mrz.valid,
    barcodeDetected,
    faceDetected: Boolean(documentFace),
    embedding: documentFace?.embedding,
    expired: mrz.expired,
    qualityPassed,
    structurePassed,
    score: Math.max(0, Math.min(100, score)),
    issues,
  };
}

export async function analyzeLiveFace(
  video: HTMLVideoElement,
  documentEmbedding?: number[],
): Promise<LiveFaceEvidence> {
  const human = await getHuman();
  const result = await human.detect(video);
  const face = result.face[0];
  const gestures = result.gesture.map((item) => item.gesture);
  return {
    faceCount: result.face.length,
    embedding: face?.embedding,
    similarity:
      face?.embedding && documentEmbedding
        ? human.match.similarity(documentEmbedding, face.embedding)
        : null,
    yaw: face?.rotation?.angle.yaw ?? 0,
    pitch: face?.rotation?.angle.pitch ?? 0,
    real: face?.real ?? null,
    live: face?.live ?? null,
    blink:
      gestures.includes('blink left eye') ||
      gestures.includes('blink right eye'),
    detectionScore: face?.score ?? 0,
  };
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

function average(values: Array<number | null>) {
  const present = values.filter((value): value is number => value !== null);
  if (!present.length) return null;
  return present.reduce((sum, value) => sum + value, 0) / present.length;
}

export function scoreChallenge(
  samples: ChallengeSample[],
  frames: LiveFaceEvidence[],
  blinkObserved: boolean,
  totalTargets: number,
): ChallengeEvidence {
  const validSamples = samples.filter((sample) => sample.faceCount === 1);
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
  const singleFaceRatio =
    frames.filter((frame) => frame.faceCount === 1).length /
    Math.max(1, frames.length);
  const liveScore = average(frames.map((frame) => frame.live));
  const realScore = average(frames.map((frame) => frame.real));
  const faceSimilarity = average(frames.map((frame) => frame.similarity));
  const reasonCodes: string[] = [];

  if (validSamples.length < totalTargets)
    reasonCodes.push('challenge_incomplete');
  if (singleFaceRatio < 0.85) reasonCodes.push('single_face_not_consistent');
  if (!blinkObserved) reasonCodes.push('blink_not_observed');
  if (poseCorrelation < 0.25) reasonCodes.push('motion_not_correlated');
  if (faceSimilarity === null || faceSimilarity < 0.5) {
    reasonCodes.push('document_face_mismatch');
  }
  if (realScore === null) {
    reasonCodes.push('anti_spoof_unavailable');
  } else if (realScore < 0.5) {
    reasonCodes.push('possible_spoof_signal');
  }
  if (liveScore === null) {
    reasonCodes.push('liveness_unavailable');
  } else if (liveScore < 0.5) {
    reasonCodes.push('weak_liveness_signal');
  }

  return {
    samples,
    completedTargets: validSamples.length,
    totalTargets,
    blinkObserved,
    singleFaceRatio,
    liveScore,
    realScore,
    faceSimilarity,
    poseCorrelation,
    passed: reasonCodes.length === 0,
    reasonCodes,
  };
}
