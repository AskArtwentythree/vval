export const verificationStatuses = [
  'created',
  'pending',
  'processing',
  'verified',
  'review',
  'rejected',
  'error',
] as const;

export type VerificationStatus = (typeof verificationStatuses)[number];

export type PublicVerificationAttempt = {
  attemptId: string;
  mode: 'local';
  status: VerificationStatus;
  reasonCode: string | null;
  updatedAt: number;
};
