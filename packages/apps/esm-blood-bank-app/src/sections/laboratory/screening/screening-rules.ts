import type { CollectionRecord } from '../../collection/collection.types';
import { isDate } from '../../applicant-selection/selection-rules';
import { collectionSampleDefaults, fullName } from '../../collection/collection-rules';
import { normalizeSearch } from '../../../shared/normalize-search';
import {
  screeningBloodGroups,
  screeningResultOptions,
  screeningRhFactors,
  screeningSpecialties,
  screeningTests,
  type ApheresisCandidate,
  type ScreeningCategory,
  type ScreeningRecord,
  type ScreeningResult,
  type ScreeningStep,
} from './screening.types';

export function localDateTime(now = new Date()) {
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function formatScreeningCollectionTime(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})/.exec(value);
  return match ? `${match[3]}-${match[2]}-${match[1]} ${match[4]}` : value;
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
    sampleType: collection.label.sampleType.trim() || collectionSampleDefaults.sampleType,
    sampleContainer: collection.label.sampleContainer.trim() || collectionSampleDefaults.sampleContainer,
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
    tests: Object.fromEntries(screeningTests.map((test) => [test, { result: '' }])) as ScreeningRecord['tests'],
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
function validMeasurement(value: string, maximum = Infinity) {
  const normalized = value.trim().replace(',', '.');
  const measurement = Number(normalized);
  return (
    /^\d+(?:\.\d+)?$/.test(normalized) && Number.isFinite(measurement) && measurement > 0 && measurement <= maximum
  );
}

function hasTestResult(result: ScreeningResult | undefined) {
  return screeningResultOptions.some((option) => option === result);
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
    const bloodData = record.bloodData;
    // Previously validated panels are still checked by Inventory and keep their original contract.
    const historical = record.status === 'validated' && !bloodData && !record.recommendations && !record.additionalTest;
    for (const test of screeningTests) {
      const outcome = record.tests[test];
      if (
        !hasTestResult(outcome?.result) ||
        (historical && (!outcome?.reagent?.trim() || !outcome.brand?.trim() || !outcome.lot?.trim()))
      )
        missing.push(`screeningTest_${test}`);
    }
    if (historical) return missing;
    if (!screeningBloodGroups.some((value) => value === bloodData?.aboGroup)) missing.push('aboGroup');
    if (!screeningRhFactors.some((value) => value === bloodData?.rhFactor)) missing.push('rhFactor');
    if (!validMeasurement(bloodData?.hematocrit ?? '', 100)) missing.push('hematocrit');
    if (!validMeasurement(bloodData?.hemoglobin ?? '')) missing.push('hemoglobin');
    const additional = record.additionalTest;
    if (additional?.name.trim() || additional?.result) {
      if (!additional.name.trim()) missing.push('screeningAdditionalTest');
      if (!hasTestResult(additional.result)) missing.push('screeningAdditionalResult');
    }
    for (const specialty of screeningSpecialties) {
      const indicated = record.recommendations?.[specialty];
      if (indicated !== 'yes' && indicated !== 'no') missing.push(specialty);
    }
  }
  if (step === 'validation') {
    missing.push(...validateScreening(record, 'reception'), ...validateScreening(record, 'results'));
    if (!record.validatedBy.trim()) missing.push('validatedBy');
  }
  return [...new Set(missing)];
}
