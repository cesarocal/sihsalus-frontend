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
export interface ScreeningRecord {
  id: string;
  revision: number;
  collectionId: string;
  // The sole physical origin is the unit. Application data is display context, not a second FK.
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
