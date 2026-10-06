export const screeningSteps = ['reception', 'results', 'validation'] as const;
export type ScreeningStep = (typeof screeningSteps)[number];
export const screeningTests = ['hbsag', 'antiHbc', 'antiHcv', 'hiv', 'htlv', 'chagas', 'syphilis'] as const;
export type ScreeningTest = (typeof screeningTests)[number];
export type ScreeningResult = '' | 'nonReactive' | 'reactive' | 'inconclusive';
export interface ScreeningTestResult {
  result: ScreeningResult;
  reagent: string;
  brand: string;
  lot: string;
}
export type ScreeningOrigin =
  | { type: 'postExtraction'; collectionId: string }
  | { type: 'apheresis'; applicationId: string }
  | { type: 'followUp'; followUpId: string; subject: 'donor' | 'recipient' };
export type ScreeningCategory = 'donors' | 'followUps';
/** Laboratory projection: deliberately excludes interview answers and exclusion reasons. */
export interface ApheresisCandidate {
  applicationId: string;
  applicationRevision: number;
  applicationNumber: string;
  applicantName: string;
  documentNumber: string;
  admissionDate: string;
  donationType: string;
  donorCode: string;
}
export interface ApheresisDraft {
  revision: number;
  candidate: ApheresisCandidate;
}
export interface ScreeningRecord {
  id: string;
  revision: number;
  collectionId: string;
  /** Missing only in legacy mock records, whose origin is post-extraction. */
  origin?: ScreeningOrigin;
  // Unit/collection identifiers are empty for pre-extraction and follow-up samples.
  unitCode: string;
  sampleCode: string;
  applicationNumber: string;
  applicantName: string;
  documentNumber: string;
  sampleType: string;
  sampleContainer: string;
  collectedOn: string;
  receivedOn: string;
  receivedBy: string;
  identityVerified: boolean;
  performedOn: string;
  performedBy: string;
  tests: Record<ScreeningTest, ScreeningTestResult>;
  observations: string;
  validatedBy: string;
  validatedAt: string | null;
  result: ScreeningResult;
  completedSteps: ScreeningStep[];
  status: 'pending' | 'inProgress' | 'validated';
}
