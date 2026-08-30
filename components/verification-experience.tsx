'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  CreditCard,
  Eye,
  Fingerprint,
  IdCard,
  Loader2,
  LockKeyhole,
  RotateCcw,
  ScanFace,
  ShieldCheck,
  VideoOff,
} from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useLocalFaceAnalysis } from '@/hooks/use-local-face-analysis';
import {
  analyzeDocument,
  captureVideoFrame,
  scoreChallenge,
  type ChallengeEvidence,
  type ChallengeSample,
  type DocumentEvidence,
  type LiveFaceEvidence,
} from '@/lib/local-verification';
import { cn } from '@/lib/utils';
import type { VerificationStatus } from '@/lib/verification/types';

type Stage =
  | 'landing'
  | 'consent'
  | 'document'
  | 'face'
  | 'challenge'
  | 'processing'
  | 'result';

type CameraStatus = 'idle' | 'requesting' | 'ready' | 'error';

type ChallengeTarget = { x: number; y: number };

const assuranceSteps = [
  {
    icon: BadgeCheck,
    label: 'Document readability',
    detail: 'MRZ, barcode, text, and portrait',
  },
  {
    icon: ScanFace,
    label: 'Holder match',
    detail: 'ID portrait compared to you',
  },
  {
    icon: Camera,
    label: 'Live presence',
    detail: 'Fresh, consented checkpoints',
  },
];

const flowSteps = [
  { key: 'consent', label: 'Consent' },
  { key: 'document', label: 'Document' },
  { key: 'live', label: 'Live check' },
  { key: 'result', label: 'Result' },
];

const stageIndex: Record<Exclude<Stage, 'landing'>, number> = {
  consent: 0,
  document: 1,
  face: 2,
  challenge: 2,
  processing: 2,
  result: 3,
};

function BrandHeader({ compact = false }: { compact?: boolean }) {
  return (
    <header
      className={cn(
        'relative z-20 mx-auto flex w-full max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10',
        compact ? 'py-4' : 'py-5',
      )}
    >
      <button
        type="button"
        className="flex items-center gap-2.5 rounded-lg text-left focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
        aria-label="Validate home"
        onClick={() => window.location.reload()}
      >
        <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/20">
          <ShieldCheck className="size-5" strokeWidth={2.2} />
        </span>
        <span className="text-[1.05rem] font-semibold tracking-[-0.025em]">
          Validate
        </span>
        <Badge
          variant="secondary"
          className="ml-1 border border-primary/10 bg-primary/8 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary"
        >
          Preview
        </Badge>
      </button>

      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground sm:text-sm">
        <LockKeyhole className="size-3.5 text-primary" />
        <span className="hidden sm:inline">Private by design</span>
        <span className="sm:hidden">Private</span>
      </div>
    </header>
  );
}

function Landing({ onStart }: { onStart: () => void }) {
  return (
    <>
      <BrandHeader />
      <section className="relative z-10 mx-auto grid w-full max-w-7xl items-center gap-14 px-5 pb-16 pt-10 sm:px-8 sm:pt-16 lg:min-h-[calc(100svh-80px)] lg:grid-cols-[1.02fr_.98fr] lg:gap-20 lg:px-10 lg:pb-24 lg:pt-12">
        <div className="max-w-2xl">
          <Badge
            variant="outline"
            className="mb-7 h-7 border-primary/20 bg-white/55 px-3 text-primary shadow-sm backdrop-blur"
          >
            <span className="mr-1 size-1.5 rounded-full bg-primary shadow-[0_0_0_4px_oklch(0.54_0.13_171/.12)]" />
            Identity assurance for live sessions
          </Badge>

          <h1 className="max-w-[11ch] text-5xl font-semibold leading-[0.98] tracking-[-0.055em] text-balance sm:text-6xl lg:text-[4.7rem]">
            Know who’s really there.
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-muted-foreground sm:text-xl sm:leading-9">
            Verify a person once, bind their identity to a secure credential,
            and collect fresh evidence that the same live person remains
            present.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              size="lg"
              className="h-12 rounded-xl px-5 text-[15px] shadow-lg shadow-primary/15"
              onClick={onStart}
            >
              Start verification
              <ArrowRight data-icon="inline-end" className="ml-1 size-4" />
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className="h-12 rounded-xl px-4 text-[15px] text-muted-foreground"
              onClick={() =>
                document
                  .getElementById('assurance-chain')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
              }
            >
              See how it works
            </Button>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-muted-foreground">
            {[
              'About 2 minutes',
              'You stay in control',
              'No identity media stored',
            ].map((item) => (
              <span key={item} className="flex items-center gap-2">
                <span className="grid size-5 place-items-center rounded-full bg-primary/10 text-primary">
                  <Check className="size-3" strokeWidth={2.5} />
                </span>
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[560px]">
          <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-white/30 blur-2xl" />
          <Card className="gap-0 rounded-[1.75rem] border border-white/80 bg-white/88 py-0 shadow-[0_28px_90px_oklch(0.25_0.04_210/.13)] ring-1 ring-foreground/5 backdrop-blur-xl">
            <CardHeader className="border-b border-border/70 px-6 py-5 sm:px-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-base font-semibold tracking-tight">
                    Verification session
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Ready when you are
                  </CardDescription>
                </div>
                <Badge className="bg-primary/10 text-primary">
                  <span className="size-1.5 rounded-full bg-primary" />
                  Secure
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-5 sm:p-6">
              <div className="relative grid min-h-[250px] place-items-center overflow-hidden rounded-2xl border border-primary/10 bg-[linear-gradient(145deg,oklch(0.965_0.018_167),oklch(0.935_0.035_194))]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_28%,oklch(0.38_0.08_183/.08)_28.5%,transparent_29%)] bg-[size:38px_38px] opacity-60" />
                <div className="absolute left-[14%] top-[18%] size-2.5 rounded-full bg-[#f0a45d] shadow-[0_0_0_7px_oklch(0.72_0.12_64/.13)]" />
                <div className="relative grid size-32 place-items-center rounded-full border border-white/90 bg-white/75 shadow-[0_20px_45px_oklch(0.34_0.07_184/.15)] backdrop-blur">
                  <div className="grid size-20 place-items-center rounded-full bg-primary/8 text-primary">
                    <ScanFace className="size-10" strokeWidth={1.45} />
                  </div>
                  <span className="absolute -bottom-2 rounded-full border border-white bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground shadow-sm">
                    Camera check
                  </span>
                </div>
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between rounded-xl border border-white/90 bg-white/70 px-3 py-2.5 text-xs text-muted-foreground backdrop-blur">
                  <span className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-primary" />
                    Camera is off until you continue
                  </span>
                  <LockKeyhole className="size-3.5" />
                </div>
              </div>

              <div id="assurance-chain" className="mt-5 grid gap-2 scroll-mt-8">
                {assuranceSteps.map((step, index) => {
                  const Icon = step.icon;
                  return (
                    <div
                      key={step.label}
                      className="flex items-center gap-3 rounded-xl border border-border/65 bg-background/70 px-3.5 py-3"
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-primary">
                        <Icon className="size-[18px]" strokeWidth={1.8} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">
                          {step.label}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {step.detail}
                        </span>
                      </span>
                      <span className="text-xs font-semibold tabular-nums text-muted-foreground/75">
                        0{index + 1}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 flex items-center gap-2 rounded-xl bg-muted px-3.5 py-3 text-xs leading-5 text-muted-foreground">
                <Fingerprint className="size-4 shrink-0 text-primary" />
                Certified verification and passkey binding can be added later.
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
}

function FlowProgress({ stage }: { stage: Exclude<Stage, 'landing'> }) {
  const current = stageIndex[stage];

  return (
    <nav aria-label="Verification progress" className="mb-6 sm:mb-8">
      <ol className="grid grid-cols-4 gap-2">
        {flowSteps.map((step, index) => {
          const complete = index < current;
          const active = index === current;
          return (
            <li key={step.key} className="min-w-0">
              <div
                className={cn(
                  'mb-2 h-1 rounded-full transition-colors',
                  complete || active ? 'bg-primary' : 'bg-muted',
                )}
              />
              <span
                className={cn(
                  'block truncate text-[11px] font-semibold sm:text-xs',
                  active
                    ? 'text-foreground'
                    : complete
                      ? 'text-primary'
                      : 'text-muted-foreground/65',
                )}
              >
                {complete ? '✓ ' : ''}
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function CameraSurface({
  mediaStream,
  cameraStatus,
  videoRef,
  className,
  mirror = false,
  children,
}: {
  mediaStream: MediaStream | null;
  cameraStatus: CameraStatus;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  className?: string;
  mirror?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-primary/10 bg-[linear-gradient(145deg,oklch(0.965_0.018_167),oklch(0.92_0.035_194))]',
        className,
      )}
    >
      {cameraStatus === 'ready' && mediaStream ? (
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className={cn(
            'absolute inset-0 size-full object-cover',
            mirror && '-scale-x-100',
          )}
          aria-label="Live camera preview"
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center">
          <div className="grid size-24 place-items-center rounded-full bg-white/55 text-primary shadow-sm backdrop-blur">
            <ScanFace className="size-11" strokeWidth={1.3} />
          </div>
        </div>
      )}
      {children}
    </div>
  );
}

function percent(value: number | null) {
  return value === null ? 'Not available' : `${Math.round(value * 100)}%`;
}

function EvidenceRow({
  label,
  detail,
  passed,
}: {
  label: string;
  detail: string;
  passed: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-background/65 px-4 py-3.5">
      <span
        className={cn(
          'grid size-7 shrink-0 place-items-center rounded-full',
          passed
            ? 'bg-primary/10 text-primary'
            : 'bg-amber-500/10 text-amber-700',
        )}
      >
        {passed ? (
          <Check className="size-4" strokeWidth={2.5} />
        ) : (
          <CircleAlert className="size-4" strokeWidth={2} />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-xs text-muted-foreground">{detail}</span>
      </span>
    </div>
  );
}

export function VerificationExperience() {
  const [stage, setStage] = useState<Stage>('landing');
  const [consentBiometric, setConsentBiometric] = useState(false);
  const [consentPreview, setConsentPreview] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('idle');
  const [cameraError, setCameraError] = useState('');
  const [flowError, setFlowError] = useState('');
  const [sessionBusy, setSessionBusy] = useState(false);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [challengeTargets, setChallengeTargets] = useState<ChallengeTarget[]>(
    [],
  );
  const [verificationStatus, setVerificationStatus] =
    useState<VerificationStatus>('created');
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [documentBusy, setDocumentBusy] = useState(false);
  const [documentProgress, setDocumentProgress] = useState(0);
  const [documentProgressLabel, setDocumentProgressLabel] = useState('');
  const [documentPreviewUrl, setDocumentPreviewUrl] = useState('');
  const [documentEvidence, setDocumentEvidence] =
    useState<DocumentEvidence | null>(null);
  const [challengeStarted, setChallengeStarted] = useState(false);
  const [challengeProgress, setChallengeProgress] = useState(0);
  const [dotPosition, setDotPosition] = useState({ x: 50, y: 50 });
  const [targetNumber, setTargetNumber] = useState(0);
  const [challengeEvidence, setChallengeEvidence] =
    useState<ChallengeEvidence | null>(null);
  const [resultReasonCodes, setResultReasonCodes] = useState<string[]>([]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const latestEvidenceRef = useRef<LiveFaceEvidence | null>(null);
  const challengeFramesRef = useRef<LiveFaceEvidence[]>([]);
  const blinkSeenRef = useRef(false);
  const challengeRunRef = useRef(0);
  const decisionSavedRef = useRef(false);

  const canContinue = consentBiometric && consentPreview;
  const currentStage = useMemo(
    () => (stage === 'landing' ? null : stage),
    [stage],
  );
  const documentEmbedding = documentEvidence?.embedding;
  const faceAnalysisActive =
    (stage === 'face' || stage === 'challenge') && cameraStatus === 'ready';
  const {
    evidence: liveEvidence,
    modelStatus,
    error: modelError,
  } = useLocalFaceAnalysis({
    active: faceAnalysisActive,
    videoRef,
    documentEmbedding,
  });

  useEffect(() => {
    if (videoRef.current && mediaStream && cameraStatus === 'ready') {
      videoRef.current.srcObject = mediaStream;
      void videoRef.current.play().catch(() => undefined);
    }
  }, [cameraStatus, mediaStream, stage]);

  useEffect(() => {
    return () => {
      mediaStream?.getTracks().forEach((track) => track.stop());
    };
  }, [mediaStream]);

  useEffect(() => {
    latestEvidenceRef.current = liveEvidence;
    if (challengeStarted && liveEvidence) {
      challengeFramesRef.current.push(liveEvidence);
      if (liveEvidence.blink) blinkSeenRef.current = true;
    }
  }, [challengeStarted, liveEvidence]);

  useEffect(() => {
    if (
      stage !== 'processing' ||
      !documentEvidence ||
      !challengeEvidence ||
      decisionSavedRef.current
    ) {
      return;
    }
    decisionSavedRef.current = true;
    let active = true;
    const persist = async () => {
      try {
        if (!attemptId || !challengeToken) {
          throw new Error('The verification session is incomplete.');
        }
        const response = await fetch('/api/verification/session', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            attemptId,
            challengeToken,
            evidence: {
              document: {
                brightness: documentEvidence.brightness,
                sharpness: documentEvidence.sharpness,
                glareRatio: documentEvidence.glareRatio,
                textLength: documentEvidence.textLength,
                mrzValid: documentEvidence.mrzValid,
                barcodeDetected: documentEvidence.barcodeDetected,
                faceDetected: documentEvidence.faceDetected,
                expired: documentEvidence.expired,
              },
              challenge: {
                samples: challengeEvidence.samples,
                blinkObserved: challengeEvidence.blinkObserved,
                singleFaceRatio: challengeEvidence.singleFaceRatio,
                liveScore: challengeEvidence.liveScore,
                realScore: challengeEvidence.realScore,
                faceSimilarity: challengeEvidence.faceSimilarity,
              },
            },
          }),
        });
        const payload = (await response.json()) as {
          status?: VerificationStatus;
          reasonCodes?: string[];
          error?: string;
        };
        if (
          !response.ok ||
          !payload.status ||
          !Array.isArray(payload.reasonCodes)
        ) {
          throw new Error(payload.error ?? 'Could not save the result.');
        }
        if (active) {
          setVerificationStatus(payload.status);
          setResultReasonCodes(payload.reasonCodes);
        }
      } catch (error) {
        if (active) {
          setVerificationStatus('review');
          setResultReasonCodes(['server_decision_unavailable']);
          setFlowError(
            error instanceof Error
              ? error.message
              : 'The server could not make a verification decision.',
          );
        }
      }
      await new Promise((resolve) => window.setTimeout(resolve, 900));
      if (active) setStage('result');
    };
    void persist();
    return () => {
      active = false;
    };
  }, [attemptId, challengeEvidence, challengeToken, documentEvidence, stage]);

  async function requestCamera(
    facingMode: 'user' | 'environment',
    destination: 'document' | 'face',
  ) {
    setCameraError('');
    setCameraStatus('requesting');
    mediaStream?.getTracks().forEach((track) => track.stop());
    setMediaStream(null);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera access is not available in this browser.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
      });
      setMediaStream(stream);
      setCameraStatus('ready');
      setStage(destination);
    } catch (error) {
      setCameraStatus('error');
      setCameraError(
        error instanceof Error
          ? error.message
          : 'We could not access your camera. Check browser permissions and try again.',
      );
    }
  }

  async function beginVerification() {
    if (!canContinue) return;
    setSessionBusy(true);
    setFlowError('');
    setCameraError('');
    try {
      const response = await fetch('/api/verification/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ consentVersion: '2026-08-29-local-v1' }),
      });
      const payload = (await response.json()) as {
        mode?: 'local';
        attemptId?: string;
        challengeToken?: string;
        challengeTargets?: ChallengeTarget[];
        error?: string;
      };
      if (
        !response.ok ||
        !payload.attemptId ||
        !payload.challengeToken ||
        payload.challengeTargets?.length !== 6 ||
        payload.mode !== 'local'
      ) {
        throw new Error(payload.error ?? 'Could not start verification.');
      }
      setAttemptId(payload.attemptId);
      setChallengeToken(payload.challengeToken);
      setChallengeTargets(payload.challengeTargets);
      await requestCamera('environment', 'document');
    } catch (error) {
      setFlowError(
        error instanceof Error
          ? error.message
          : 'Could not start verification.',
      );
    } finally {
      setSessionBusy(false);
    }
  }

  async function captureDocument() {
    if (!videoRef.current) return;
    setDocumentBusy(true);
    setDocumentEvidence(null);
    setFlowError('');
    setDocumentProgress(2);
    setDocumentProgressLabel('Capturing the frame');
    try {
      const canvas = captureVideoFrame(videoRef.current, 0.13);
      setDocumentPreviewUrl(canvas.toDataURL('image/jpeg', 0.88));
      const evidence = await analyzeDocument(canvas, (progress, label) => {
        setDocumentProgress(progress);
        setDocumentProgressLabel(label);
      });
      setDocumentEvidence(evidence);
    } catch (error) {
      setFlowError(
        error instanceof Error
          ? error.message
          : 'The document could not be analyzed.',
      );
    } finally {
      setDocumentBusy(false);
    }
  }

  async function continueToFace() {
    setFlowError('');
    await requestCamera('user', 'face');
  }

  async function startChallenge() {
    const targets = challengeTargets;
    if (targets.length !== 6) {
      setFlowError('The server challenge is unavailable. Start again.');
      return;
    }
    const runId = challengeRunRef.current + 1;
    challengeRunRef.current = runId;
    challengeFramesRef.current = [];
    blinkSeenRef.current = false;
    setChallengeEvidence(null);
    setChallengeProgress(0);
    setTargetNumber(1);
    setChallengeStarted(true);
    const samples: ChallengeSample[] = [];

    for (let index = 0; index < targets.length; index += 1) {
      if (challengeRunRef.current !== runId) return;
      const target = targets[index];
      setDotPosition(target);
      setTargetNumber(index + 1);
      await new Promise((resolve) =>
        window.setTimeout(resolve, index === 0 ? 1400 : 1050),
      );
      if (challengeRunRef.current !== runId) return;
      const evidence = latestEvidenceRef.current;
      samples.push({
        targetX: target.x,
        targetY: target.y,
        yaw: evidence?.yaw ?? 0,
        pitch: evidence?.pitch ?? 0,
        faceCount: evidence?.faceCount ?? 0,
      });
      setChallengeProgress(((index + 1) / targets.length) * 100);
    }

    const scored = scoreChallenge(
      samples,
      challengeFramesRef.current,
      blinkSeenRef.current,
      targets.length,
    );
    setChallengeEvidence(scored);
    setChallengeStarted(false);
    mediaStream?.getTracks().forEach((track) => track.stop());
    setMediaStream(null);
    setCameraStatus('idle');
    setStage('processing');
  }

  function resetFlow() {
    challengeRunRef.current += 1;
    mediaStream?.getTracks().forEach((track) => track.stop());
    setMediaStream(null);
    setCameraStatus('idle');
    setSessionBusy(false);
    setAttemptId(null);
    setChallengeToken(null);
    setChallengeTargets([]);
    setFlowError('');
    setCameraError('');
    setVerificationStatus('created');
    setConsentBiometric(false);
    setConsentPreview(false);
    setDocumentEvidence(null);
    setDocumentPreviewUrl('');
    setDocumentProgress(0);
    setChallengeEvidence(null);
    setChallengeStarted(false);
    setChallengeProgress(0);
    setTargetNumber(0);
    setDotPosition({ x: 50, y: 50 });
    setResultReasonCodes([]);
    decisionSavedRef.current = false;
    setStage('landing');
  }

  if (stage === 'landing') {
    return (
      <main className="relative min-h-svh overflow-hidden bg-background text-foreground">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_76%_22%,oklch(0.91_0.07_171/.55),transparent_28%),radial-gradient(circle_at_16%_88%,oklch(0.93_0.045_83/.6),transparent_32%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,oklch(0.42_0.03_216/.045)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0.42_0.03_216/.045)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:linear-gradient(to_bottom,black,transparent_80%)]" />
        <Landing onStart={() => setStage('consent')} />
      </main>
    );
  }

  return (
    <main className="relative min-h-svh overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,oklch(0.91_0.07_171/.48),transparent_30%),radial-gradient(circle_at_7%_90%,oklch(0.93_0.045_83/.5),transparent_30%)]" />
      <BrandHeader compact />

      <section className="relative z-10 mx-auto w-full max-w-3xl px-4 pb-12 pt-4 sm:px-6 sm:pt-8">
        {currentStage && <FlowProgress stage={currentStage} />}

        <Card className="gap-0 rounded-[1.65rem] border border-white/80 bg-white/90 py-0 shadow-[0_24px_80px_oklch(0.25_0.04_210/.12)] ring-1 ring-foreground/5 backdrop-blur-xl">
          {stage === 'consent' && (
            <>
              <CardHeader className="border-b border-border/70 px-6 py-6 sm:px-8 sm:py-7">
                <Badge
                  variant="secondary"
                  className="mb-3 w-fit bg-primary/9 text-primary"
                >
                  Step 1 of 4
                </Badge>
                <CardTitle className="text-2xl font-semibold tracking-[-0.025em] sm:text-3xl">
                  Before we begin
                </CardTitle>
                <CardDescription className="mt-2 max-w-xl text-[15px] leading-6">
                  Camera frames are analyzed on this device. Validate sends only
                  coarse measurements for a server decision—not your ID or face
                  images.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 p-6 sm:p-8">
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    {
                      icon: Camera,
                      title: 'Camera',
                      detail: 'Requested after consent',
                    },
                    {
                      icon: Eye,
                      title: 'On-device checks',
                      detail: 'OCR, face match, and motion',
                    },
                    {
                      icon: LockKeyhole,
                      title: 'Minimal storage',
                      detail: 'No raw media in Validate',
                    },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.title}
                        className="rounded-xl border border-border/70 bg-background/60 p-4"
                      >
                        <Icon className="mb-3 size-5 text-primary" />
                        <p className="text-sm font-semibold">{item.title}</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {item.detail}
                        </p>
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-3">
                  <Label className="group cursor-pointer items-start gap-3 rounded-xl border border-border/70 p-4 leading-5 hover:bg-muted/40">
                    <Checkbox
                      checked={consentBiometric}
                      onCheckedChange={(checked) =>
                        setConsentBiometric(checked === true)
                      }
                      className="mt-0.5"
                    />
                    <span>
                      <span className="block font-semibold">
                        I consent to camera-based identity checks
                      </span>
                      <span className="mt-1 block text-xs font-normal leading-5 text-muted-foreground">
                        Frames are processed locally for document readability,
                        face matching, and live challenge signals.
                      </span>
                    </span>
                  </Label>
                  <Label className="group cursor-pointer items-start gap-3 rounded-xl border border-border/70 p-4 leading-5 hover:bg-muted/40">
                    <Checkbox
                      checked={consentPreview}
                      onCheckedChange={(checked) =>
                        setConsentPreview(checked === true)
                      }
                      className="mt-0.5"
                    />
                    <span>
                      <span className="block font-semibold">
                        I understand how my identity data is handled
                      </span>
                      <span className="mt-1 block text-xs font-normal leading-5 text-muted-foreground">
                        I understand this is a prototype—not a certified
                        authenticity or biometric decision—and low-confidence
                        checks may require manual review.
                      </span>
                    </span>
                  </Label>
                </div>

                {cameraStatus === 'error' && (
                  <Alert variant="destructive" className="p-3.5">
                    <CircleAlert />
                    <AlertTitle>Camera unavailable</AlertTitle>
                    <AlertDescription>{cameraError}</AlertDescription>
                  </Alert>
                )}

                {flowError && (
                  <Alert variant="destructive" className="p-3.5">
                    <CircleAlert />
                    <AlertTitle>Could not start verification</AlertTitle>
                    <AlertDescription>{flowError}</AlertDescription>
                  </Alert>
                )}

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <Button
                    variant="ghost"
                    className="h-11 rounded-xl px-4 text-muted-foreground"
                    onClick={() => setStage('landing')}
                  >
                    <ArrowLeft data-icon="inline-start" />
                    Back
                  </Button>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      className="h-11 rounded-xl px-5"
                      disabled={!canContinue || sessionBusy}
                      onClick={beginVerification}
                    >
                      {sessionBusy ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <ShieldCheck />
                      )}
                      {sessionBusy
                        ? 'Starting local checks…'
                        : 'Start on-device checks'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </>
          )}

          {stage === 'document' && (
            <>
              <CardHeader className="border-b border-border/70 px-6 py-6 sm:px-8 sm:py-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Badge
                      variant="secondary"
                      className="mb-3 w-fit bg-primary/9 text-primary"
                    >
                      Step 2 of 4
                    </Badge>
                    <CardTitle className="text-2xl font-semibold tracking-[-0.025em] sm:text-3xl">
                      Scan your identity document
                    </CardTitle>
                    <CardDescription className="mt-2 text-[15px] leading-6">
                      Hold the photo page or front of your ID inside the frame.
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="hidden sm:flex">
                    On-device prototype
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-5 sm:p-8">
                <CameraSurface
                  mediaStream={mediaStream}
                  cameraStatus={cameraStatus}
                  videoRef={videoRef}
                  className="aspect-[16/10]"
                >
                  {documentPreviewUrl && (
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 size-full bg-cover bg-center"
                      style={{
                        backgroundImage: `url(${documentPreviewUrl})`,
                      }}
                    />
                  )}
                  <div className="absolute inset-[13%] rounded-xl border-2 border-white/90 shadow-[0_0_0_999px_rgb(8_32_36/.2)]">
                    <span className="absolute -left-0.5 -top-0.5 size-7 rounded-tl-xl border-l-4 border-t-4 border-primary" />
                    <span className="absolute -right-0.5 -top-0.5 size-7 rounded-tr-xl border-r-4 border-t-4 border-primary" />
                    <span className="absolute -bottom-0.5 -left-0.5 size-7 rounded-bl-xl border-b-4 border-l-4 border-primary" />
                    <span className="absolute -bottom-0.5 -right-0.5 size-7 rounded-br-xl border-b-4 border-r-4 border-primary" />
                  </div>
                  <Badge className="absolute left-4 top-4 bg-black/55 text-white backdrop-blur">
                    <IdCard className="size-3.5" />
                    Passport or photo ID
                  </Badge>
                </CameraSurface>

                {documentBusy && (
                  <div className="mt-5 rounded-xl border border-border/70 bg-muted/45 p-4">
                    <div className="mb-2 flex items-center justify-between text-xs font-medium">
                      <span>{documentProgressLabel}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {documentProgress}%
                      </span>
                    </div>
                    <Progress value={documentProgress} />
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      The first run downloads open-source OCR and face models.
                    </p>
                  </div>
                )}

                {documentEvidence && (
                  <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
                    <EvidenceRow
                      label="Image quality"
                      detail={`Brightness ${documentEvidence.brightness}/255 · focus ${Math.round(documentEvidence.sharpness)}`}
                      passed={documentEvidence.qualityPassed}
                    />
                    <EvidenceRow
                      label="Document portrait"
                      detail={
                        documentEvidence.faceDetected
                          ? 'Face descriptor created locally'
                          : 'No face portrait detected'
                      }
                      passed={documentEvidence.faceDetected}
                    />
                    <EvidenceRow
                      label="Readable structure"
                      detail={
                        documentEvidence.mrzValid
                          ? 'MRZ check digits validated'
                          : documentEvidence.barcodeDetected
                            ? 'Document barcode detected'
                            : `${documentEvidence.textLength} text characters read`
                      }
                      passed={documentEvidence.structurePassed}
                    />
                    <EvidenceRow
                      label="Expiry signal"
                      detail={
                        documentEvidence.expired === null
                          ? 'No reliable expiry date read'
                          : documentEvidence.expired
                            ? 'Document appears expired'
                            : 'Read expiry date is current'
                      }
                      passed={documentEvidence.expired !== true}
                    />
                  </div>
                )}

                {(flowError || cameraError) && (
                  <Alert variant="destructive" className="mt-5 p-3.5">
                    <CircleAlert />
                    <AlertTitle>Document check needs attention</AlertTitle>
                    <AlertDescription>
                      {flowError || cameraError}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="flex items-center gap-2 text-xs leading-5 text-muted-foreground">
                    <CreditCard className="size-4 shrink-0 text-primary" />
                    Use the original physical document, not a screenshot.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant={documentEvidence ? 'outline' : 'default'}
                      className="h-11 rounded-xl px-5"
                      disabled={documentBusy || cameraStatus !== 'ready'}
                      onClick={() => {
                        setDocumentPreviewUrl('');
                        setDocumentEvidence(null);
                        void captureDocument();
                      }}
                    >
                      {documentBusy ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Camera />
                      )}
                      {documentBusy
                        ? 'Analyzing locally…'
                        : documentEvidence
                          ? 'Retake'
                          : 'Capture document'}
                    </Button>
                    {documentEvidence && (
                      <Button
                        className="h-11 rounded-xl px-5"
                        onClick={() => void continueToFace()}
                      >
                        Continue
                        <ChevronRight data-icon="inline-end" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </>
          )}

          {stage === 'face' && (
            <>
              <CardHeader className="border-b border-border/70 px-6 py-6 text-center sm:px-8 sm:py-7">
                <Badge
                  variant="secondary"
                  className="mx-auto mb-3 w-fit bg-primary/9 text-primary"
                >
                  Step 3 of 4
                </Badge>
                <CardTitle className="text-2xl font-semibold tracking-[-0.025em] sm:text-3xl">
                  Now let’s confirm it’s you
                </CardTitle>
                <CardDescription className="mx-auto mt-2 max-w-lg text-[15px] leading-6">
                  Center your face, remove anything covering it, and keep the
                  camera steady.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 sm:p-8">
                <CameraSurface
                  mediaStream={mediaStream}
                  cameraStatus={cameraStatus}
                  videoRef={videoRef}
                  mirror
                  className="mx-auto aspect-[4/3] max-w-[520px]"
                >
                  <div className="absolute left-1/2 top-1/2 h-[64%] w-[48%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-2 border-white/90 shadow-[0_0_0_999px_rgb(8_32_36/.12)]" />
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-white/80 bg-white/75 px-3 py-1.5 text-xs font-medium text-foreground backdrop-blur">
                    {modelStatus === 'loading'
                      ? 'Loading face models…'
                      : !liveEvidence?.faceCount
                        ? 'Position your face in the oval'
                        : liveEvidence.faceCount > 1
                          ? 'Only one person can be visible'
                          : 'Face detected'}
                  </div>
                </CameraSurface>
                <div className="mx-auto mt-5 grid max-w-[520px] gap-2 sm:grid-cols-3">
                  <EvidenceRow
                    label="One face"
                    detail={
                      liveEvidence
                        ? `${liveEvidence.faceCount} detected`
                        : 'Waiting for analysis'
                    }
                    passed={liveEvidence?.faceCount === 1}
                  />
                  <EvidenceRow
                    label="Holder match"
                    detail={
                      liveEvidence
                        ? percent(liveEvidence.similarity)
                        : 'Waiting for analysis'
                    }
                    passed={(liveEvidence?.similarity ?? 0) >= 0.5}
                  />
                  <EvidenceRow
                    label="Live signal"
                    detail={
                      liveEvidence ? percent(liveEvidence.live) : 'Waiting'
                    }
                    passed={(liveEvidence?.live ?? 0) >= 0.5}
                  />
                </div>
                {(modelError || cameraError) && (
                  <Alert
                    variant="destructive"
                    className="mx-auto mt-5 max-w-[520px] p-3.5"
                  >
                    <CircleAlert />
                    <AlertTitle>Face analysis unavailable</AlertTitle>
                    <AlertDescription>
                      {modelError || cameraError}
                    </AlertDescription>
                  </Alert>
                )}
                <div className="mt-6 flex justify-center">
                  <Button
                    className="h-11 rounded-xl px-6"
                    disabled={
                      modelStatus !== 'ready' || liveEvidence?.faceCount !== 1
                    }
                    onClick={() => setStage('challenge')}
                  >
                    Start live challenge
                    <ChevronRight data-icon="inline-end" />
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          {stage === 'challenge' && (
            <>
              <CardHeader className="border-b border-border/70 px-6 py-6 text-center sm:px-8 sm:py-7">
                <Badge
                  variant="secondary"
                  className="mx-auto mb-3 w-fit bg-primary/9 text-primary"
                >
                  Live challenge
                </Badge>
                <CardTitle className="text-2xl font-semibold tracking-[-0.025em] sm:text-3xl">
                  Follow the moving dot
                </CardTitle>
                <CardDescription className="mx-auto mt-2 max-w-lg text-[15px] leading-6">
                  Follow each unpredictable jump with your eyes and natural head
                  movement. Blink once during the challenge.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 sm:p-8">
                <CameraSurface
                  mediaStream={mediaStream}
                  cameraStatus={cameraStatus}
                  videoRef={videoRef}
                  mirror
                  className="mx-auto aspect-[16/10] max-w-[600px]"
                >
                  <div className="absolute inset-0 bg-black/8" />
                  <div
                    className={cn(
                      'absolute grid size-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[#f0a45d] shadow-[0_0_0_10px_rgb(240_164_93/.16),0_8px_20px_rgb(80_48_18/.22)] transition-[left,top,transform] duration-500 ease-in-out',
                      challengeStarted && 'scale-110',
                    )}
                    style={{
                      left: `${dotPosition.x}%`,
                      top: `${dotPosition.y}%`,
                    }}
                    aria-hidden="true"
                  >
                    <span className="size-2 rounded-full bg-white/90" />
                  </div>
                  <div className="absolute bottom-4 left-4 right-4 rounded-xl border border-white/70 bg-white/80 p-3 backdrop-blur">
                    <div className="mb-2 flex items-center justify-between text-xs font-medium">
                      <span>
                        {challengeStarted
                          ? `Measuring target ${targetNumber} of 6`
                          : 'Ready when you are'}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {Math.round(challengeProgress)}%
                      </span>
                    </div>
                    <Progress value={challengeProgress} />
                  </div>
                </CameraSurface>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs leading-5 text-muted-foreground">
                    Each server-issued random target is scored from a fresh
                    analyzed frame.
                  </p>
                  <Button
                    className="h-11 rounded-xl px-6"
                    disabled={challengeStarted}
                    onClick={() => void startChallenge()}
                  >
                    {challengeStarted ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Eye />
                    )}
                    {challengeStarted ? 'Keep following…' : 'Begin challenge'}
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          {stage === 'processing' && (
            <CardContent className="grid min-h-[520px] place-items-center p-8 text-center">
              <div>
                <div className="relative mx-auto grid size-24 place-items-center rounded-full bg-primary/10 text-primary">
                  <ScanFace className="size-10" strokeWidth={1.45} />
                  <span className="absolute inset-0 animate-ping rounded-full border border-primary/25" />
                </div>
                <h2 className="mt-7 text-2xl font-semibold tracking-[-0.025em] sm:text-3xl">
                  Combining verification signals
                </h2>
                <p className="mx-auto mt-3 max-w-md text-[15px] leading-6 text-muted-foreground">
                  Checking the document, holder match, and fresh challenge
                  response. Verification media and results are not persisted.
                </p>
                <div className="mx-auto mt-7 flex w-fit items-center gap-2 rounded-full bg-muted px-4 py-2 text-xs font-medium text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin text-primary" />
                  Scoring local evidence
                </div>
              </div>
            </CardContent>
          )}

          {stage === 'result' && (
            <>
              <CardContent className="p-6 sm:p-9">
                <div className="text-center">
                  <div
                    className={cn(
                      'mx-auto grid size-20 place-items-center rounded-full',
                      verificationStatus === 'verified'
                        ? 'bg-primary/10 text-primary'
                        : verificationStatus === 'rejected' ||
                            verificationStatus === 'error'
                          ? 'bg-destructive/10 text-destructive'
                          : 'bg-amber-500/10 text-amber-700',
                    )}
                  >
                    {verificationStatus === 'verified' ? (
                      <CheckCircle2 className="size-10" strokeWidth={1.8} />
                    ) : (
                      <CircleAlert className="size-10" strokeWidth={1.8} />
                    )}
                  </div>
                  <Badge className="mt-5 bg-primary/10 text-primary">
                    On-device prototype result
                  </Badge>
                  <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
                    {verificationStatus === 'verified'
                      ? 'Prototype checks passed'
                      : 'Manual review recommended'}
                  </h2>
                  <p className="mx-auto mt-3 max-w-lg text-[15px] leading-6 text-muted-foreground">
                    {verificationStatus === 'verified'
                      ? 'The captured document was readable, the faces were similar, and your movement tracked the fresh challenge.'
                      : `${resultReasonCodes.length} local signal${resultReasonCodes.length === 1 ? '' : 's'} need attention. This prototype never rejects a person automatically.`}
                  </p>
                </div>

                <div className="mx-auto mt-8 grid max-w-xl gap-2.5">
                  <EvidenceRow
                    label="Document readability"
                    detail={
                      documentEvidence?.mrzValid
                        ? 'MRZ checksums validated'
                        : documentEvidence?.barcodeDetected
                          ? 'Machine-readable barcode detected'
                          : `${documentEvidence?.textLength ?? 0} text characters read`
                    }
                    passed={Boolean(
                      documentEvidence?.qualityPassed &&
                      documentEvidence.structurePassed,
                    )}
                  />
                  <EvidenceRow
                    label="Holder similarity"
                    detail={percent(challengeEvidence?.faceSimilarity ?? null)}
                    passed={(challengeEvidence?.faceSimilarity ?? 0) >= 0.5}
                  />
                  <EvidenceRow
                    label="Fresh challenge response"
                    detail={`${challengeEvidence?.completedTargets ?? 0}/${challengeEvidence?.totalTargets ?? 6} targets · ${Math.round((challengeEvidence?.poseCorrelation ?? 0) * 100)}% motion correlation`}
                    passed={Boolean(challengeEvidence?.passed)}
                  />
                  <EvidenceRow
                    label="Anti-spoof model signal"
                    detail={`${percent(challengeEvidence?.realScore ?? null)} · prototype-only indicator`}
                    passed={(challengeEvidence?.realScore ?? 0) >= 0.5}
                  />
                </div>

                {flowError && (
                  <Alert
                    variant="destructive"
                    className="mx-auto mt-6 max-w-xl p-3.5"
                  >
                    <CircleAlert />
                    <AlertTitle>Audit save incomplete</AlertTitle>
                    <AlertDescription>{flowError}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
              <div className="flex flex-col gap-3 border-t border-border/70 bg-muted/45 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <VideoOff className="size-4 text-primary" />
                  Camera access has ended
                </p>
                <Button
                  variant="outline"
                  className="h-10 rounded-xl bg-white"
                  onClick={resetFlow}
                >
                  <RotateCcw />
                  Run preview again
                </Button>
              </div>
            </>
          )}
        </Card>

        <p className="mt-5 text-center text-xs leading-5 text-muted-foreground">
          On-device prototype · Raw frames stay in your browser · Not a
          certified identity decision
        </p>
      </section>
    </main>
  );
}
