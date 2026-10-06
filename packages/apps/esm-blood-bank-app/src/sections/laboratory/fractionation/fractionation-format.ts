import { formatDatetime } from '@openmrs/esm-framework';

/** Same locale-aware formatter as the OpenMRS header; native date inputs are unchanged. */
export function fractionationDateTime(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? formatDatetime(date) : '—';
}
