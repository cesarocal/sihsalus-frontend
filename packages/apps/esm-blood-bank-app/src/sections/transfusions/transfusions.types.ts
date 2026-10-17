import type { ComponentType } from '../laboratory/fractionation/fractionation.types';
import type { TransferUnit } from '../transfers/transfers.types';

export type TransfusionStatus =
  | 'pending'
  | 'reviewed'
  | 'sampleReady'
  | 'testing'
  | 'incompatible'
  | 'compatible'
  | 'delivered';
export type TransfusionPriority = 'scheduled' | 'urgent' | 'veryUrgent';
export interface TransfusionOrder {
  id: string;
  number: string;
  /** Synthetic references only; not OpenMRS UUIDs. */
  patientId: string;
  encounterId: string;
  orderer: string;
  doctorLicense: string;
  requestedAt: string;
  priority: TransfusionPriority;
  patientName: string;
  historyNumber: string;
  document: string;
  age: string;
  sex: 'M' | 'F';
  bloodGroup: string;
  service: string;
  ward: string;
  bed: string;
  diagnosis: string;
  hemoglobin: string;
  hematocrit: string;
  platelets: string;
  priorTransfusions: 'yes' | 'no' | 'unknown';
  priorReactions: 'yes' | 'no' | 'unknown';
  pregnancies: string;
  abortions: string;
  maternalIncompatibility: string;
  items: { component: ComponentType; quantity: number }[];
  history: { id: string; date: string; component: ComponentType; unit: string; reaction: string }[];
}
export interface RecipientSample {
  code: string;
  historyNumber: string;
  collectedAt: string;
  collectedBy: string;
  identityVerified: boolean;
}
export interface TransfusionDraft {
  reviewer: string;
  reviewVerified: boolean;
  consentVerified: boolean;
  sample: RecipientSample;
  selectedUnitIds: string[];
  selectionVerified: boolean;
  collectorName: string;
  collectorDocument: string;
  deliveredBy: string;
  releaseVerified: boolean;
}
export interface TransfusionAssignment {
  unit: TransferUnit;
  roundId: string | null;
  unitSampleCode: string | null;
  assignedAt: string;
  active: boolean;
  result: 'pending' | 'compatible' | 'incompatible' | 'notRequired';
  resultAt: string | null;
  testedBy: string;
}
export interface CompatibilityRound {
  id: string;
  createdAt: string;
  completedAt: string | null;
  sample: RecipientSample;
  identityVerified: boolean;
  pretransfusionVerified: boolean;
  operator: string;
  results: Record<string, '' | 'compatible' | 'incompatible'>;
}
export interface TransfusionRequest {
  id: string;
  revision: number;
  status: TransfusionStatus;
  order: TransfusionOrder;
  draft: TransfusionDraft;
  receivedAt: string | null;
  sample: RecipientSample | null;
  assignments: TransfusionAssignment[];
  rounds: CompatibilityRound[];
  events: { id?: string; at: string; status: TransfusionStatus; actor: string }[];
  deliveredAt: string | null;
  requesterStatus: 'PENDIENTE' | 'ATENDIDA';
}
/** FR10 is an issue/dispatch record, not evidence of administration to the patient. */
export interface TransfusionBookEntry {
  id: string;
  kind: 'transfusionDispatch';
  requestId: string;
  orderNumber: string;
  unitCode: string;
  seal: string;
  component: ComponentType;
  patientName: string;
  historyNumber: string;
  service: string;
  doctor: string;
  doctorLicense: string;
  attendedBy: string;
  collectorName: string;
  collectorDocument: string;
  at: string;
}
export interface TransfusionStore {
  requests: TransfusionRequest[];
  bookEntries: TransfusionBookEntry[];
}
export interface TransfusionWorkspace extends TransfusionStore {
  units: TransferUnit[];
}
