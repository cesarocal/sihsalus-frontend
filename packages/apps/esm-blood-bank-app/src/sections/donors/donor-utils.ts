import type { DonorSummary } from '../../types/blood-bank.types';

export const donorStatusKey: Record<DonorSummary['status'], string> = {
  Apto: 'donorEligible',
  Diferido: 'donorDeferred',
  'En evaluación': 'donorUnderEvaluation',
};

export function formatDonorDate(value: string) {
  if (!value) return '—';
  // ISO dates are date-only; do not convert through UTC and change the displayed day.
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T|$)/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}
