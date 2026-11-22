export const donorReactionTypes = [
  'vasovagal',
  'hematoma',
  'arterialPuncture',
  'delayedBleeding',
  'nerveInjury',
  'armPain',
  'localInflammation',
  'citrate',
  'apheresisComplication',
  'allergic',
  'other',
] as const;

export const donorReactionSeverities = ['mild', 'moderate', 'severe'] as const;
export const donorReactionPhases = ['during', 'observation', 'afterDischarge'] as const;
export const donorCollectionDecisions = ['continue', 'stopWithUnit', 'stopWithoutUnit', 'alreadyEnded'] as const;
export const donorVitalFields = ['systolic', 'diastolic', 'pulse', 'respirations', 'oxygen'] as const;
export type DonorVitals = Partial<Record<(typeof donorVitalFields)[number], string>>;

export const donorReactionOptions = {
  site: ['hospital', 'campaign', 'mobileUnit'],
  donorFrequency: ['firstTime', 'regular', 'occasional'],
  donorConditions: ['previousReactions', 'anxiety', 'inaccessibleVein', 'fastingOverFiveHours'],
  environment: ['adequate', 'excessiveHeat', 'cold'],
  localReactions: ['hematoma', 'arterialPuncture', 'nervePuncture', 'inflammation', 'thrombophlebitis', 'cellulitis'],
  consciousness: ['lost', 'preserved'],
  vasovagalSite: ['onSite', 'offSite'],
  generalSymptoms: [
    'pallor',
    'weakness',
    'headache',
    'dizziness',
    'blurredVision',
    'nausea',
    'vomiting',
    'chills',
    'cyanosis',
  ],
  severeSymptoms: ['stroke', 'myocardialInfarction', 'seizures', 'death'],
} as const;

type ReactionOption<K extends keyof typeof donorReactionOptions> = (typeof donorReactionOptions)[K][number];
export type DonorBloodPressure = Pick<DonorVitals, 'systolic' | 'diastolic'>;

export interface InstitutionalDonorReaction {
  site?: ReactionOption<'site'>;
  donorFrequency?: ReactionOption<'donorFrequency'>;
  donorConditions?: Array<ReactionOption<'donorConditions'>>;
  environment?: ReactionOption<'environment'>;
  localReactions?: Array<ReactionOption<'localReactions'>>;
  consciousness?: ReactionOption<'consciousness'>;
  vasovagalSite?: ReactionOption<'vasovagalSite'>;
  generalSymptoms?: Array<ReactionOption<'generalSymptoms'>>;
  severeSymptoms?: Array<ReactionOption<'severeSymptoms'>>;
  donationStartPressure?: DonorBloodPressure;
  twentyMinutePressure?: DonorBloodPressure;
  profession?: string;
}

export interface DonorReactionReport {
  phase: (typeof donorReactionPhases)[number];
  occurredAt: string;
  type: (typeof donorReactionTypes)[number];
  signs: string;
  initialCare: string;
  notifiedTo: string;
  notifiedAt: string;
  initialVitals: DonorVitals;
  finalVitals: DonorVitals;
  institutional?: InstitutionalDonorReaction;
}

export interface DonorReactionAssessment {
  severity: (typeof donorReactionSeverities)[number];
  diagnosis: string;
  care: string;
  recommendations: string;
  outcome: string;
  collectionDecision: (typeof donorCollectionDecisions)[number];
}

export interface DonorReaction extends DonorReactionReport {
  id: string;
  reportedBy: string;
  reportedAt: string;
  assessment?: DonorReactionAssessment & {
    evaluatedBy: string;
    evaluatedAt: string;
  };
}

export type DonorReactionUpdate =
  | { action: 'report'; id: string; report: DonorReactionReport; actor: string }
  | {
      action: 'assess';
      id: string;
      assessment: DonorReactionAssessment;
      actor: string;
    };

export interface DonorReactionIdentity {
  name: string;
  applicationNumber: string;
  document: string;
  unitCode: string;
  modality: string;
  bagLot: string;
  volume: string;
  donationType?: string;
  donationDate?: string;
  collectionService?: string;
  age?: string;
  sex?: string;
  weight?: string;
  height?: string;
  hemoglobin?: string;
  hematocrit?: string;
}

export interface DonorReactionView {
  identity: DonorReactionIdentity;
  reports: DonorReaction[];
}

const text = (value: string) => Boolean(value.trim()) && value.length <= 500;
const validVitals = (values: DonorVitals) =>
  Object.values(values).every((value) => !value || /^\d{1,3}(\.\d{1,2})?$/.test(value));

function validInstitutionalReport(report?: InstitutionalDonorReaction) {
  if (!report) return true;
  const validOptions = Object.entries(donorReactionOptions).every(([key, options]) => {
    const value = report[key as keyof typeof donorReactionOptions];
    const allowed: readonly string[] = options;
    return !value || (Array.isArray(value) ? value.every((item) => allowed.includes(item)) : allowed.includes(value));
  });
  return (
    validOptions &&
    validVitals(report.donationStartPressure ?? {}) &&
    validVitals(report.twentyMinutePressure ?? {}) &&
    (report.profession?.length ?? 0) <= 120
  );
}

export function validDonorReactionReport(report: DonorReactionReport) {
  const occurred = Date.parse(report.occurredAt);
  const notified = Date.parse(report.notifiedAt);
  return (
    donorReactionPhases.includes(report.phase) &&
    donorReactionTypes.includes(report.type) &&
    Number.isFinite(occurred) &&
    occurred <= notified &&
    notified <= Date.now() &&
    text(report.signs) &&
    text(report.initialCare) &&
    text(report.notifiedTo) &&
    validVitals(report.initialVitals) &&
    validVitals(report.finalVitals) &&
    validInstitutionalReport(report.institutional)
  );
}

export function validDonorReactionAssessment(assessment: DonorReactionAssessment) {
  return (
    donorReactionSeverities.includes(assessment.severity) &&
    donorCollectionDecisions.includes(assessment.collectionDecision) &&
    text(assessment.diagnosis) &&
    text(assessment.care) &&
    text(assessment.outcome) &&
    assessment.recommendations.length <= 500
  );
}
