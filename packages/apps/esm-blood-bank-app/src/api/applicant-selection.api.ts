import { openmrsFetch } from '@openmrs/esm-framework';

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

/** Versioned OMOD applicant workflow. */
export const applicantSelectionEndpoints = {
  applications: '/ws/rest/v1/bloodbank/applications',
  admitNew: '/ws/rest/v1/bloodbank/applications/admission',
  history: '/ws/rest/v1/bloodbank/applicants/history',
  draft: (id: string) => `/ws/rest/v1/bloodbank/applications/${encodeURIComponent(id)}/draft`,
  step: (id: string) => `/ws/rest/v1/bloodbank/applications/${encodeURIComponent(id)}/steps`,
  finalize: (id: string) => `/ws/rest/v1/bloodbank/applications/${encodeURIComponent(id)}/selection`,
};

export const openmrsApplicantSelectionApi: ApplicantSelectionApi = {
  async listApplications() {
    const response = await openmrsFetch<SelectionApplication[]>(applicantSelectionEndpoints.applications);
    return response.data;
  },
  async lookupApplicant(identity) {
    const params = new URLSearchParams({
      documentType: identity.documentType,
      documentNumber: identity.documentNumber.trim(),
      donorCode: identity.donorCode.trim(),
    });
    const response = await openmrsFetch<ApplicantHistory | null>(`${applicantSelectionEndpoints.history}?${params}`);
    return response.data ?? null;
  },
  async saveDraft(application) {
    const response = await openmrsFetch<SelectionApplication>(
      application.id ? applicantSelectionEndpoints.draft(application.id) : applicantSelectionEndpoints.applications,
      {
        method: application.id ? 'PUT' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: application,
      },
    );
    return response.data;
  },
  async completeStep(application, step) {
    const isNew = step === 'admission' && !application.id;
    const response = await openmrsFetch<SelectionApplication>(
      isNew ? applicantSelectionEndpoints.admitNew : applicantSelectionEndpoints.step(application.id),
      {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'content-type': 'application/json' },
        body: isNew ? application : { step, application },
      },
    );
    return response.data;
  },
  async finalizeSelection(application) {
    const response = await openmrsFetch<SelectionApplication>(applicantSelectionEndpoints.finalize(application.id), {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: application,
    });
    return response.data;
  },
};
