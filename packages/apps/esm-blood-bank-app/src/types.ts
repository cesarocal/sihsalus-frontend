export type PrototypeView =
  | 'dashboard'
  | 'donors'
  | 'selection'
  | 'collection'
  | 'processing'
  | 'inventory'
  | 'donor-followup'
  | 'recipient-followup'
  | 'transfusion'
  | 'reactions'
  | 'audit';

export type SelectionDecision = 'pending' | 'eligible' | 'temporary' | 'permanent';

export interface SelectionDraft {
  applicationNumber: string;
  donorCode: string;
  interviewDate: string;
  bloodGroup: string;
  rhFactor: string;
  documentType: string;
  documentNumber: string;
  donationType: string;
  procedureType: string;
  familyName: string;
  givenName: string;
  sex: string;
  birthDate: string;
  phone: string;
  address: string;
  placeOfBirth: string;
  origin: string;
  district: string;
  province: string;
  department: string;
  civilStatus: string;
  occupation: string;
  email: string;
  workplace: string;
  permanence: string;
  weight: string;
  height: string;
  bloodPressure: string;
  pulse: string;
  generalAppearance: string;
  venousAccess: string;
  answers: Record<string, string>;
  answerNotes: Record<string, string>;
  lastMenstruation: string;
  pregnant: string;
  breastfeeding: string;
  lastBirth: string;
  pregnancyCount: string;
  decision: SelectionDecision;
  reason: string;
  returnDate: string;
  interviewer: string;
  validator: string;
}

export interface PrototypeRecord {
  id: string;
  primary: string;
  secondary: string;
  tertiary: string;
  status: string;
  tone: 'blue' | 'cyan' | 'green' | 'gray' | 'magenta' | 'purple' | 'red' | 'teal' | 'warm-gray';
}

export interface InventoryRecord {
  id: string;
  component: string;
  bloodGroup: string;
  location: string;
  expiresAt: string;
  status: string;
  tone: PrototypeRecord['tone'];
  reference: string;
  preparedAt?: string;
  method?: string;
  containerLot?: string;
  specialConditions?: string;
  result?: string;
  rejectionReason?: string;
}

export interface FractionationPlan {
  id: string;
  sourceUnitCode: string;
  bagType: string;
  initialVolume: string;
  plannedComponents: string;
  protocol: string;
  scheduledAt: string;
  responsible: string;
  status: string;
  startedAt: string;
  finishedAt: string;
}

export interface DonationTrace {
  id: string;
  date: string;
  donationType: string;
  procedure: string;
  volume: string;
  unitCode: string;
  components: string;
  status: string;
  responsible: string;
  observation: string;
}

export interface DonorRecord {
  id: string;
  donorCode: string;
  familyName: string;
  givenName: string;
  documentType: string;
  documentNumber: string;
  sex: string;
  birthDate: string;
  phone: string;
  address: string;
  placeOfBirth: string;
  origin: string;
  district: string;
  province: string;
  department: string;
  civilStatus: string;
  occupation: string;
  email: string;
  workplace: string;
  permanence: string;
  bloodGroup: string;
  rhFactor: string;
  donationCount: number;
  lastDonationDate: string;
  status: string;
  donations: DonationTrace[];
}
