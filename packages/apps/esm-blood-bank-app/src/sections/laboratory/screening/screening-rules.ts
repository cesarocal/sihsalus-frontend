import type { CollectionRecord } from '../../collection/collection.types';
import { isDate } from '../../applicant-selection/selection-rules';
import { fullName } from '../../collection/collection-rules';
import { normalizeSearch } from '../../../shared/normalize-search';
import {
  screeningTests,
  type ApheresisCandidate,
  type ScreeningCategory,
  type ScreeningRecord,
  type ScreeningStep,
} from './screening.types';

export function localDateTime() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
export function newScreening(collection: CollectionRecord): ScreeningRecord {
  return newScreeningSample({
    id: `mock-screening-${collection.id}`,
    collectionId: collection.id,
    origin: { type: 'postExtraction', collectionId: collection.id },
    unitCode: collection.unitCode,
    sampleCode: collection.sampleCode,
    applicationNumber: collection.application.number,
    applicantName: fullName(collection.application),
    documentNumber: collection.application.admission.documentNumber,
    sampleType: collection.label.sampleType,
    sampleContainer: collection.label.sampleContainer,
  });
}
/** Common empty panel; provenance and identity must be supplied by the source adapter. */
export function newScreeningSample(
  identity: Pick<
    ScreeningRecord,
    | 'id'
    | 'origin'
    | 'collectionId'
    | 'unitCode'
    | 'sampleCode'
    | 'applicationNumber'
    | 'applicantName'
    | 'documentNumber'
    | 'sampleType'
    | 'sampleContainer'
  >,
): ScreeningRecord {
  return {
    ...identity,
    revision: 0,
    collectedOn: localDateTime(),
    receivedOn: '',
    receivedBy: '',
    identityVerified: false,
    performedOn: '',
    performedBy: '',
    tests: Object.fromEntries(
      screeningTests.map((test) => [test, { result: '', reagent: '', brand: '', lot: '' }]),
    ) as ScreeningRecord['tests'],
    observations: '',
    validatedBy: '',
    validatedAt: null,
    result: '',
    completedSteps: [],
    status: 'pending',
  };
}
export function screeningCategory(record: ScreeningRecord): ScreeningCategory | null {
  const origin = record.origin?.type;
  if (origin === 'followUp') return 'followUps';
  if (origin === 'postExtraction' || origin === 'apheresis') return 'donors';
  // Only legacy unit-associated samples may be treated as post-extraction.
  return !record.origin && record.collectionId && record.unitCode ? 'donors' : null;
}
export function matchesScreeningSearch(record: ScreeningRecord, search: string) {
  return normalizeSearch(
    `${record.sampleCode} ${record.unitCode} ${record.applicationNumber} ${record.documentNumber} ${record.applicantName} ${record.origin?.type === 'followUp' ? record.origin.followUpId : ''}`,
  ).includes(normalizeSearch(search.trim()));
}
export function screeningOriginLabel(record: ScreeningRecord) {
  if (record.origin?.type === 'followUp')
    return record.origin.subject === 'donor' ? 'donorFollowUp' : 'recipientFollowUp';
  return record.origin?.type === 'apheresis' ? 'apheresisSample' : 'postExtractionSample';
}
export function newApheresisScreening(candidate: ApheresisCandidate): ScreeningRecord {
  return newScreeningSample({
    id: `mock-apheresis-${candidate.applicationId}`,
    origin: { type: 'apheresis', applicationId: candidate.applicationId },
    collectionId: '',
    unitCode: '',
    sampleCode: `M-AF-${candidate.applicationNumber}`,
    applicationNumber: candidate.applicationNumber,
    applicantName: candidate.applicantName,
    documentNumber: candidate.documentNumber,
    sampleType: 'Sangre (DEMO)',
    sampleContainer: 'Tubo (DEMO)',
  });
}
export function globalScreeningResult(record: ScreeningRecord) {
  const results = screeningTests.map((test) => record.tests[test]?.result);
  if (results.some((result) => !result)) return '';
  if (results.includes('reactive')) return 'reactive';
  if (results.includes('inconclusive')) return 'inconclusive';
  return 'nonReactive';
}
function validTime(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return false;
  if (!isDate(value.slice(0, 10)) || Number(value.slice(11, 13)) > 23 || Number(value.slice(14, 16)) > 59) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && value <= localDateTime();
}
export function validateScreening(record: ScreeningRecord, step: ScreeningStep): string[] {
  const missing: string[] = [];
  if (step === 'reception') {
    if (!record.identityVerified) missing.push('identityVerified');
    if (!validTime(record.receivedOn) || record.receivedOn < record.collectedOn) missing.push('receivedOn');
    if (!record.receivedBy.trim()) missing.push('receivedBy');
  }
  if (step === 'results') {
    if (!validTime(record.performedOn) || record.performedOn < record.receivedOn) missing.push('performedOn');
    if (!record.performedBy.trim()) missing.push('performedBy');
    for (const test of screeningTests) {
      const result = record.tests[test];
      if (
        !result ||
        !['nonReactive', 'reactive', 'inconclusive'].includes(result.result) ||
        !result.reagent.trim() ||
        !result.brand.trim() ||
        !result.lot.trim()
      )
        missing.push(test);
    }
  }
  if (step === 'validation') {
    missing.push(...validateScreening(record, 'reception'), ...validateScreening(record, 'results'));
    if (!record.validatedBy.trim()) missing.push('validatedBy');
  }
  return [...new Set(missing)];
}
