import type { ProcessingTranslate } from './processing-page.component';

export function BloodGroupLabel({ value, t }: { value: string; t: ProcessingTranslate }) {
  const bloodGroup = /^(AB|A|B|O)\s*([+−-])$/.exec(value.trim());
  if (!bloodGroup) return null;
  const [, abo, rh] = bloodGroup;
  return (
    <p data-blood-group>
      <strong>
        {abo}
        {rh === '+' ? '+' : '-'}
      </strong>
      <span>{t(rh === '+' ? 'labelRhPositive' : 'labelRhNegative')}</span>
    </p>
  );
}
