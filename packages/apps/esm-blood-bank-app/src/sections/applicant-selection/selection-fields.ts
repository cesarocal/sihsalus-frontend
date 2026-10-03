import type { PersonalData, PhysicalData } from './selection.types';

export const personalFields: Array<{ key: keyof PersonalData; type?: 'date' | 'email' | 'tel' }> = [
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
  { key: 'travelPlace' },
  { key: 'travelDuration' },
  { key: 'travelDate', type: 'date' },
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

export interface InterviewQuestion {
  id: string;
  group: 'general' | 'nextDay' | 'lastTwoWeeks' | 'lastMonth' | 'lastYear' | 'lifetime' | 'withInterviewer';
  detail?: string;
  positiveDetail?: boolean;
}

// RM 241-2018/MINSA, Annex 1 (PDF pages 28–29). The old EG05-FR01 is not this questionnaire.
export const interviewQuestions: InterviewQuestion[] = [
  { id: 'understoodInformation', group: 'general' },
  { id: 'over18', group: 'general' },
  { id: 'over50kg', group: 'general' },
  { id: 'recentDonation', group: 'general', detail: 'donationWhere', positiveDetail: true },
  { id: 'medication', group: 'general', detail: 'medicationWhich', positiveDetail: true },
  { id: 'awaitingConsultation', group: 'general', detail: 'consultationWhy', positiveDetail: true },
  { id: 'feelsWell', group: 'general' },
  { id: 'strenuousActivity', group: 'nextDay' },
  { id: 'recentIllness', group: 'lastTwoWeeks' },
  { id: 'vaccinated', group: 'lastMonth', detail: 'vaccineWhich', positiveDetail: true },
  { id: 'infectiousContact', group: 'lastMonth' },
  { id: 'tattoosExposure', group: 'lastYear' },
  { id: 'surgery', group: 'lastYear' },
  { id: 'chronicCondition', group: 'lifetime', detail: 'conditionWhich', positiveDetail: true },
  { id: 'infectionConcern', group: 'withInterviewer' },
  { id: 'illicitDrugs', group: 'withInterviewer' },
  { id: 'sexualRisk', group: 'withInterviewer' },
  { id: 'hivTest', group: 'withInterviewer' },
  { id: 'infectedPartner', group: 'withInterviewer' },
  { id: 'sti', group: 'withInterviewer' },
];

export const stiQuestions = ['syphilis', 'gonorrhea', 'chancroid', 'otherSti'] as const;
