import type { ApplicantTrip, InterviewData, InterviewListKey, PersonalData, PhysicalData } from './selection.types';

export const personalFields: Array<{ key: Exclude<keyof PersonalData, 'trips'>; type?: 'date' | 'email' | 'tel' }> = [
  { key: 'familyName' },
  { key: 'givenName' },
  { key: 'birthDate', type: 'date' },
  { key: 'birthPlace' },
  { key: 'provenance' },
  { key: 'address' },
  { key: 'district' },
  { key: 'province' },
  { key: 'department' },
  { key: 'occupation' },
  { key: 'phone', type: 'tel' },
  { key: 'mobile', type: 'tel' },
  { key: 'email', type: 'email' },
  { key: 'workplace' },
];

export const tripFields: Array<{ key: Exclude<keyof ApplicantTrip, 'id'>; label: string; type: 'text' | 'date' }> = [
  { key: 'place', label: 'travelPlace', type: 'text' },
  { key: 'duration', label: 'travelDuration', type: 'text' },
  { key: 'date', label: 'travelDate', type: 'date' },
];

/** Capture units, not eligibility limits. Limits are evaluated in selection-rules.ts. */
export const physicalFields: Array<{ key: keyof PhysicalData; unit: string; required?: boolean }> = [
  { key: 'weight', unit: 'kg', required: true },
  { key: 'height', unit: 'cm', required: true },
  { key: 'systolic', unit: 'mmHg', required: true },
  { key: 'diastolic', unit: 'mmHg', required: true },
  { key: 'pulse', unit: 'lpm', required: true },
  { key: 'temperature', unit: '°C', required: true },
  { key: 'hemoglobin', unit: 'g/dL' },
  { key: 'hematocrit', unit: '%' },
];

export const interviewGeneralGroups = [
  'general',
  'nextDay',
  'lastTwoWeeks',
  'lastMonth',
  'lastYear',
  'lifetime',
] as const;

export const interviewListFields = {
  medicationWhich: { item: 'medicationItem', add: 'addMedication', required: true },
  vaccineWhich: { item: 'vaccineItem', add: 'addVaccine', required: false },
  conditionWhich: { item: 'conditionItem', add: 'addCondition', required: true },
} as const;

export function interviewListEntries(interview: InterviewData, key: InterviewListKey) {
  const legacyValue = interview.details[key];
  return interview.listDetails?.[key] ?? (legacyValue ? [{ id: 1, value: legacyValue }] : []);
}

export interface InterviewQuestion {
  id: string;
  group: (typeof interviewGeneralGroups)[number] | 'withInterviewer';
  detail?: string;
  list?: InterviewListKey;
}

// RM 241-2018/MINSA, Annex 1 (PDF pages 28–29). The old EG05-FR01 is not this questionnaire.
export const interviewQuestions: InterviewQuestion[] = [
  { id: 'understoodInformation', group: 'general' },
  { id: 'over18', group: 'general' },
  { id: 'over50kg', group: 'general' },
  { id: 'recentDonation', group: 'general', detail: 'donationWhere' },
  { id: 'medication', group: 'general', list: 'medicationWhich' },
  { id: 'awaitingConsultation', group: 'general', detail: 'consultationWhy' },
  { id: 'feelsWell', group: 'general' },
  { id: 'strenuousActivity', group: 'nextDay' },
  { id: 'recentIllness', group: 'lastTwoWeeks' },
  { id: 'vaccinated', group: 'lastMonth', list: 'vaccineWhich' },
  { id: 'infectiousContact', group: 'lastMonth' },
  { id: 'tattoosExposure', group: 'lastYear' },
  { id: 'surgery', group: 'lastYear' },
  { id: 'chronicCondition', group: 'lifetime', list: 'conditionWhich' },
  { id: 'infectionConcern', group: 'withInterviewer' },
  { id: 'illicitDrugs', group: 'withInterviewer' },
  { id: 'sexualRisk', group: 'withInterviewer' },
  { id: 'hivTest', group: 'withInterviewer' },
  { id: 'infectedPartner', group: 'withInterviewer' },
  { id: 'sti', group: 'withInterviewer' },
];

export const stiQuestions = ['syphilis', 'chancroid', 'gonorrhea', 'otherSti'] as const;
