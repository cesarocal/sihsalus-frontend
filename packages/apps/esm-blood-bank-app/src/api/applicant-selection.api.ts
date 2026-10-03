import type {
  AdmissionData,
  ApplicantHistory,
  SelectionApplication,
  SelectionStep,
} from '../sections/applicant-selection/selection.types';

/** DTO facade: person/identifiers + banco_postulante + selection encounter/obs. */
export interface ApplicantSelectionApi {
  listApplications(): Promise<SelectionApplication[]>;
  lookupApplicant(
    identity: Pick<AdmissionData, 'documentType' | 'documentNumber' | 'donorCode'>,
  ): Promise<ApplicantHistory | null>;
  saveDraft(application: SelectionApplication): Promise<SelectionApplication>;
  completeStep(application: SelectionApplication, step: SelectionStep): Promise<SelectionApplication>;
  finalizeSelection(application: SelectionApplication): Promise<SelectionApplication>;
}

/** Proposed OMOD contract, not existing OpenMRS REST resources. No requests are enabled yet. */
export const applicantSelectionEndpoints = {
  applications: '/ws/rest/v1/bloodbank/applications',
  history: '/ws/rest/v1/bloodbank/applicants/history',
  draft: (id: string) => `/ws/rest/v1/bloodbank/applications/${encodeURIComponent(id)}/draft`,
  step: (id: string) => `/ws/rest/v1/bloodbank/applications/${encodeURIComponent(id)}/steps`,
  finalize: (id: string) => `/ws/rest/v1/bloodbank/applications/${encodeURIComponent(id)}/selection`,
};

const unavailable = async (): Promise<never> => {
  throw new Error('APPLICANT_SELECTION_BACKEND_NOT_IMPLEMENTED');
};

// Replace these adapters after validating OMOD endpoints, authorization and clinical mappings.
export const openmrsApplicantSelectionApi: ApplicantSelectionApi = {
  listApplications: unavailable,
  lookupApplicant: unavailable,
  saveDraft: unavailable,
  completeStep: unavailable,
  finalizeSelection: unavailable,
};
