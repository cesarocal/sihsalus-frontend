import { ageOnDate, calculateReturnDate, isDate, today } from '../applicant-selection/selection-rules';
import type { SelectionApplication } from '../applicant-selection/selection.types';
import type { CollectionRecord, CollectionStep } from './collection.types';
import { bagLotExceedsLimit } from '../../shared/text-field-contracts';

export const collectionSampleDefaults = { sampleType: 'Sangre', sampleContainer: 'Tubo' };

export function fullName(application: SelectionApplication) {
  return `${application.personal.givenName} ${application.personal.familyName}`.trim();
}
export function newCollection(application: SelectionApplication): CollectionRecord {
  const date = today();
  return {
    id: `mock-collection-${application.id}`,
    revision: 0,
    application: structuredClone(application),
    unitCode: `BB-${application.number}`,
    sampleCode: `M-${application.number}`,
    completedSteps: [],
    status: 'pending',
    unitStatus: 'prepared',
    label: {
      component: '',
      anticoagulant: '',
      preservative: '',
      sedimentingAgent: '',
      service: '',
      collectedBy: '',
      leukocytesReduced: false,
      recipientName: application.admission.beneficiaryName,
      recipientDocument: application.admission.beneficiaryDocument,
      recipientService: '',
      recipientHistory: '',
      ...collectionSampleDefaults,
    },
    extractedVolume: '',
    registry: { date, bagLot: '', complications: '', extractionStatus: '', attendedBy: '' },
    certificate: {
      resultsAvailableOn: calculateReturnDate(date, '10', 'days') ?? '',
      emailConsent: '',
      email: application.personal.email,
    },
    updatedAt: '',
  };
}
// Storage bounds (DECIMAL(8,2)), not a clinical collection-volume recommendation.
export const validVolume = (value: string) => /^\d{1,6}(\.\d{1,2})?$/.test(value) && Number(value) > 0;

export function validateCollectionDraft(record: CollectionRecord): string[] {
  const errors = bagLotExceedsLimit(record.registry.bagLot) ? ['bagLotTooLong'] : [];
  if (!record.completedSteps.includes('registry') && record.registry.date > today()) errors.push('collectionDate');
  return errors;
}

export function validateCollection(record: CollectionRecord, step: CollectionStep): string[] {
  const missing = validateCollectionDraft(record);
  if (step === 'label') {
    if (!record.label.component.trim()) missing.push('component');
    if (!record.label.collectedBy.trim()) missing.push('collectionOperatorUnavailable');
    const savedLabel = record.completedSteps.includes('label');
    if (!record.label.service.trim() || (!savedLabel && !record.label.serviceConceptUuid)) missing.push('service');
    const hasAnticoagulant = record.label.anticoagulant.trim() && (savedLabel || record.label.anticoagulantConceptUuid);
    if (!hasAnticoagulant && !record.label.preservative.trim()) missing.push('anticoagulantOrPreservative');
    if (record.application.admission.donationType === 'autologous')
      for (const field of ['recipientName', 'recipientDocument'] as const)
        if (!record.label[field].trim()) missing.push(field);
  }
  if (step === 'volume' && !validVolume(record.extractedVolume)) missing.push('extractedVolume');
  if (step === 'registry') {
    if (!isDate(record.registry.date) || record.registry.date < record.application.admission.date)
      missing.push('collectionDate');
    if (!record.registry.bagLot.trim()) missing.push('bagLot');
    if (!['yes', 'no'].includes(record.registry.complications)) missing.push('complications');
    if (!['complete', 'incomplete'].includes(record.registry.extractionStatus)) missing.push('extractionStatus');
    if (!record.registry.attendedBy.trim()) missing.push('attendedBy');
  }
  if (step === 'certificate') {
    if (
      !fullName(record.application) ||
      ageOnDate(record.application.personal.birthDate, record.registry.date) === null
    )
      missing.push('applicantData');
    if (
      !record.application.physical.bloodGroup ||
      !record.application.physical.rh ||
      !record.application.physical.hemoglobin ||
      !record.application.physical.hematocrit
    )
      missing.push('bloodData');
    if (!isDate(record.certificate.resultsAvailableOn) || record.certificate.resultsAvailableOn < record.registry.date)
      missing.push('resultsAvailableOn');
    if (!['yes', 'no'].includes(record.certificate.emailConsent)) missing.push('emailConsent');
    if (record.certificate.emailConsent === 'yes' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.certificate.email))
      missing.push('email');
  }
  return missing;
}
