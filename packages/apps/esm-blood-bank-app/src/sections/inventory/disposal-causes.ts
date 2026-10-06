/** Eight causes listed in EG10-PC01's annotation to identifying units for disposal. Mock catalog, not concept IDs. */
export const disposalCauses = [
  'expired',
  'openCircuit',
  'lowVolume',
  'brokenBag',
  'reactiveSerology',
  'positiveIrregularAntibodies',
  'hemolysis',
  'coldChainBreak',
] as const;
export type DisposalCause = (typeof disposalCauses)[number];
export function isDisposalCause(value: string | undefined): value is DisposalCause {
  return disposalCauses.some((cause) => cause === value);
}
/** Retain historical free-text causes for viewing/printing; new entries use the catalog. */
export function disposalCauseText(value: string | undefined, t: (key: string) => string) {
  return value && isDisposalCause(value) ? t(`inventoryCause_${value}`) : value || '—';
}
