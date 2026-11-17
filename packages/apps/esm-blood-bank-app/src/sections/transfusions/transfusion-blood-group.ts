import type { ProcessingTranslate } from '../../shared/processing-page.component';

export function transfusionRhLabel(rh: string, t: ProcessingTranslate) {
  if (rh === '+') return `${t('labelRhPositive')} (+)`;
  if (rh === '-' || rh === '−') return `${t('labelRhNegative')} (-)`;
  return '—';
}

export function transfusionBloodGroupLabel(value: string, t: ProcessingTranslate) {
  const group = /^(AB|A|B|O)\s*([+−-])$/.exec(value.trim());
  if (!group) return value || '—';
  const [, abo, rh] = group;
  return `${abo} ${transfusionRhLabel(rh, t)}`;
}
