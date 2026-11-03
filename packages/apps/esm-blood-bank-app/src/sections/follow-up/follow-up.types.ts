import type { ScreeningRecord } from '../laboratory/screening/screening.types';

export type FollowUpKind = 'donor' | 'recipient';
export const followUpStages = ['detection', 'tracing', 'notification', 'testing', 'information'] as const;
export interface FollowUpPerson {
  id: string;
  name: string;
  document: string;
  history: string;
  age: string;
  sex: '' | 'male' | 'female';
  address: string;
  phone: string;
  mobile: string;
}
/** A confirmed administration link, not an inventory dispatch or a compatibility result. */
export interface FollowUpTrace {
  id: string;
  donor: FollowUpPerson;
  recipient: FollowUpPerson;
  unit: string;
  component: string;
  seal: string;
  donationDate: string;
  transfusionDate: string;
  previousHere: '' | 'yes' | 'no' | 'unknown';
  previousElsewhere: '' | 'yes' | 'no' | 'unknown';
}
export interface FollowUpDetection {
  person: FollowUpPerson;
  test: string;
  testedOn: string;
  reagent: string;
  brand: string;
  lot: string;
  confirmed: boolean;
  confirmationReference: string;
  reportedBy: string;
  treatingDoctor: string;
  notes: string;
}
export interface FollowUpSubject {
  person: FollowUpPerson;
  notifiedOn: string;
  notifiedBy: string;
  method: '' | 'phone' | 'inPerson' | 'document';
  collectedOn: string;
  collectedBy: string;
  identityVerified: boolean;
  sampleId: string;
  confirmationReference: string;
  confirmedOn: string;
  confirmationResult: '' | 'reactive' | 'nonReactive';
  confirmationBy: string;
  informedOn: string;
  informedBy: string;
  referral: string;
}
export interface FollowUpCase {
  id: string;
  revision: number;
  kind: FollowUpKind;
  status: 'open' | 'closed';
  stage: number;
  createdAt: string;
  updatedAt: string;
  closedAt: string;
  detection: FollowUpDetection;
  traces: FollowUpTrace[];
  relatedTraces: FollowUpTrace[];
  subjects: FollowUpSubject[];
  responsible: string;
  reportDate: string;
  conclusion: string;
  informedDoctorOn: string;
  informedDirectorOn: string;
}
export interface FollowUpWorkspace {
  cases: FollowUpCase[];
  candidates: FollowUpDetection[];
  traces: FollowUpTrace[];
  screenings: ScreeningRecord[];
}
