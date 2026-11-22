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
  assessment?: DonorReactionAssessment & { evaluatedBy: string; evaluatedAt: string };
}

export type DonorReactionUpdate =
  | { action: 'report'; id: string; report: DonorReactionReport; actor: string }
  | { action: 'assess'; id: string; assessment: DonorReactionAssessment; actor: string };

export interface DonorReactionIdentity {
  name: string;
  applicationNumber: string;
  document: string;
  unitCode: string;
  modality: string;
  bagLot: string;
  volume: string;
  age?: string;
  sex?: string;
  weight?: string;
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
    validVitals(report.finalVitals)
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
