export const selectionSteps = ['admission', 'personal', 'physical', 'interview', 'qualification', 'review'] as const;
export type SelectionStep = (typeof selectionSteps)[number];
export type ApplicationStatus =
  | 'draft'
  | 'admitted'
  | 'awaitingInterview'
  | 'awaitingQualification'
  | 'inInterview'
  | 'selected'
  | 'deferred'
  | 'excluded';
export type Qualification = '' | 'eligible' | 'temporary' | 'permanent';
export type Answer = '' | 'yes' | 'no';

export interface AdmissionData {
  date: string;
  documentType: 'DNI' | 'CE' | 'PASSPORT';
  documentNumber: string;
  donorCode: string;
  donationType: '' | 'voluntary' | 'replacement' | 'autologous';
  modality: '' | 'wholeBlood' | 'apheresis';
  beneficiaryName: string;
  beneficiaryDocument: string;
}

export interface PersonalData {
  givenName: string;
  familyName: string;
  sex: '' | 'M' | 'F';
  birthDate: string;
  birthPlace: string;
  maritalStatus: string;
  provenance: string;
  address: string;
  district: string;
  province: string;
  department: string;
  occupation: string;
  phone: string;
  mobile: string;
  email: string;
  workplace: string;
  travelPlace: string;
  travelDuration: string;
  travelDate: string;
}

export interface PhysicalData {
  weight: string;
  height: string;
  systolic: string;
  diastolic: string;
  pulse: string;
  temperature: string;
  bloodGroup: string;
  rh: string;
  hemoglobin: string;
  hematocrit: string;
  armInspection: string;
  observations: string;
  warningAcknowledgement: string;
}

export interface InterviewData {
  answers: Record<string, Answer>;
  details: Record<string, string>;
  lastPeriod: string;
  pregnant: Answer;
  breastfeeding: Answer;
  lastDelivery: string;
  pregnancies: string;
  observations: string;
}

export interface QualificationData {
  result: Qualification;
  duration: string;
  durationUnit: 'days' | 'months' | 'years';
  reason: string;
  applicantName: string;
  interviewerName: string;
  interviewerLicense: string;
  validatedBy: string;
  observations: string;
}

/** Future patient/visit UUIDs are references, never invented OpenMRS identifiers. */
export interface SelectionApplication {
  id: string;
  number: string;
  revision: number;
  patientUuid?: string;
  visitUuid?: string;
  status: ApplicationStatus;
  completedSteps: SelectionStep[];
  stoppedAfterPhysical: boolean;
  admission: AdmissionData;
  personal: PersonalData;
  physical: PhysicalData;
  interview: InterviewData;
  qualification: QualificationData;
  returnDate: string | null;
  updatedAt: string;
}

export interface ApplicantHistory {
  patientUuid?: string;
  donorCode?: string;
  documentType?: AdmissionData['documentType'];
  documentNumber?: string;
  personal?: PersonalData;
  exclusion?: { kind: 'temporary' | 'permanent'; returnDate: string | null };
  identityConflict?: boolean;
}

export type SelectionTranslate = (key: string) => string;
