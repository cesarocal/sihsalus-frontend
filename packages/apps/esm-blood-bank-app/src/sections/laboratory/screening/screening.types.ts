export const screeningSteps = ['reception', 'results', 'validation'] as const;
export type ScreeningStep = (typeof screeningSteps)[number];
export const screeningTests = ['hbsag', 'antiHbc', 'antiHcv', 'hiv', 'htlv', 'chagas', 'syphilis'] as const;
export type ScreeningTest = (typeof screeningTests)[number];
export const screeningTableTests = [
  'hiv',
  'hbsag',
  'antiHcv',
  'antiHbc',
  'htlv',
  'syphilis',
  'chagas',
] as const satisfies readonly ScreeningTest[];
export const screeningResultOptions = ['reactive', 'nonReactive', 'inconclusive'] as const;
export type ScreeningResult = '' | (typeof screeningResultOptions)[number];
export interface ScreeningTestResult {
  result: ScreeningResult;
  // Kept for records created before reagent details were removed from the form.
  reagent?: string;
  brand?: string;
  lot?: string;
}
export const screeningBloodGroups = ['O', 'A', 'B', 'AB'] as const;
export const screeningRhFactors = ['+', '-'] as const;
export const screeningBloodFields = ['aboGroup', 'rhFactor', 'hematocrit', 'hemoglobin'] as const;
export type ScreeningBloodData = Record<(typeof screeningBloodFields)[number], string>;
export const screeningSpecialties = ['gastroenterology', 'infectiousDiseases', 'procets'] as const;
export type ScreeningRecommendations = Record<(typeof screeningSpecialties)[number], '' | 'yes' | 'no'>;
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
  collectedBy?: string;
  historyNumber?: string;
  receivedOn: string;
  receivedBy: string;
  identityVerified: boolean;
  performedOn: string;
  performedBy: string;
  tests: Record<ScreeningTest, ScreeningTestResult>;
  bloodData?: ScreeningBloodData;
  additionalTest?: { name: string; result: ScreeningResult };
  recommendations?: ScreeningRecommendations;
  observations?: string;
  validatedBy: string;
  validatedAt: string | null;
  result: ScreeningResult;
  completedSteps: ScreeningStep[];
  status: 'pending' | 'inProgress' | 'validated';
}
