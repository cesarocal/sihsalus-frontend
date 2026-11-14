import type { ProcessingTranslate } from '../../shared/processing-page.component';

export function transfusionBloodGroupLabel(value: string, t: ProcessingTranslate) {
  const group = /^(AB|A|B|O)\s*([+−-])$/.exec(value.trim());
  if (!group) return value || '—';
  const [, abo, rh] = group;
  return `${abo} ${t(rh === '+' ? 'labelRhPositive' : 'labelRhNegative')} (${rh === '+' ? '+' : '-'})`;
}
