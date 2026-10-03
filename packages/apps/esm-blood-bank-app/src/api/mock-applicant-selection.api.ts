import { applicantProfilesMock, applicationsMock } from '../mocks/applicant-selection.mock';
import {
  calculateReturnDate,
  hasActiveExclusion,
  isFinal,
  today,
  validateFinal,
  validateStep,
} from '../sections/applicant-selection/selection-rules';
import {
  selectionSteps,
  type AdmissionData,
  type ApplicantHistory,
  type SelectionApplication,
  type SelectionStep,
} from '../sections/applicant-selection/selection.types';
import type { ApplicantSelectionApi } from './applicant-selection.api';
import { readProcessingState } from './mock-processing-store';

export const selectionStorageKey = 'sihsalus.blood-bank.selection.mock.v1';
interface MockState {
  version: 1;
  sequence: number;
  applications: SelectionApplication[];
}

/** Per-tab synthetic persistence. Storage failures are surfaced; never claim a failed save succeeded. */
export function createMockApplicantSelectionApi(
  getStorage: () => Pick<Storage, 'getItem' | 'setItem'> = () => globalThis.sessionStorage,
): ApplicantSelectionApi {
  const read = (): MockState => {
    const text = getStorage().getItem(selectionStorageKey);
    if (!text) return { version: 1, sequence: 4, applications: applicationsMock() };
    const state: MockState = JSON.parse(text);
    if (state.version !== 1 || !Number.isInteger(state.sequence) || !Array.isArray(state.applications))
      throw new Error('INVALID_MOCK_STORAGE');
    return state;
  };
  const history = (
    identity: Pick<AdmissionData, 'documentType' | 'documentNumber' | 'donorCode'>,
  ): ApplicantHistory | null => {
    const donationProfiles: ApplicantHistory[] = readProcessingState(getStorage)
      .collections.filter((record) => record.completedSteps.includes('registry'))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((record) => ({
        donorCode: record.application.admission.donorCode || `DON-${record.application.number}`,
        documentType: record.application.admission.documentType,
        documentNumber: record.application.admission.documentNumber,
        personal: record.application.personal,
        patientUuid: record.application.patientUuid,
      }));
    const profiles = [...donationProfiles, ...applicantProfilesMock()];
    const code = identity.donorCode.trim().toUpperCase();
    const byCode = profiles.find((profile) => code && profile.donorCode === code);
    const matches = read().applications.filter(
      (a) =>
        a.admission.documentType === identity.documentType &&
        a.admission.documentNumber === identity.documentNumber.trim(),
    );
    const latest = matches.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    const byDocument = profiles.find(
      (profile) =>
        profile.documentType === identity.documentType && profile.documentNumber === identity.documentNumber.trim(),
    );
    if (
      byCode &&
      identity.documentNumber &&
      (byCode.documentType !== identity.documentType || byCode.documentNumber !== identity.documentNumber.trim())
    )
      return { identityConflict: true };
    if (code && !byCode) return null;
    const profile = byCode ?? byDocument;
    if (!profile && !latest) return null;
    const exclusion =
      matches.find((a) => a.status === 'excluded') ??
      matches.find((a) => a.status === 'deferred' && (!a.returnDate || a.returnDate > today()));
    return structuredClone({
      ...profile,
      ...(latest
        ? {
            personal: latest.personal,
            documentType: latest.admission.documentType,
            documentNumber: latest.admission.documentNumber,
            patientUuid: latest.patientUuid,
          }
        : {}),
      ...(exclusion
        ? {
            exclusion: {
              kind: exclusion.status === 'excluded' ? 'permanent' : 'temporary',
              returnDate: exclusion.returnDate,
            },
          }
        : {}),
    });
  };

  const persist = (input: SelectionApplication, step?: SelectionStep, finalize = false): SelectionApplication => {
    const state = read();
    const previous = state.applications.find((a) => a.id === input.id);
    if (input.id && !previous) throw new Error('APPLICATION_NOT_FOUND');
    if (previous && (previous.revision !== input.revision || isFinal(previous)))
      throw new Error('APPLICATION_CONFLICT');
    if (previous?.completedSteps.includes('physical')) {
      for (const section of ['admission', 'personal', 'physical'] as const) {
        if (JSON.stringify(previous[section]) !== JSON.stringify(input[section])) throw new Error('LOCKED_SECTION');
      }
    }
    const found = history(input.admission);
    if (found?.identityConflict || (input.admission.donorCode && !found)) throw new Error('IDENTITY_CONFLICT');
    if (step && validateStep(input, step).length) throw new Error('INCOMPLETE_STAGE');
    if (step) {
      const required = selectionSteps
        .slice(0, selectionSteps.indexOf(step))
        .filter((s) => !(input.stoppedAfterPhysical && s === 'interview'));
      if (required.some((s) => !input.completedSteps.includes(s))) throw new Error('STAGE_ORDER');
    }
    if (
      finalize &&
      (validateFinal(input).length ||
        !input.completedSteps.includes('qualification') ||
        (input.qualification.result === 'eligible' && hasActiveExclusion(found, input.admission.date)))
    )
      throw new Error('SELECTION_NOT_READY');
    const application = structuredClone(input);
    application.id ||= `mock-application-${++state.sequence}`;
    application.number ||= String(state.sequence).padStart(6, '0');
    application.revision = (previous?.revision ?? 0) + 1;
    application.updatedAt = new Date().toISOString();
    if (step && !application.completedSteps.includes(step)) application.completedSteps.push(step);
    if (step === 'admission') application.status = 'admitted';
    if (step === 'physical')
      application.status = application.stoppedAfterPhysical ? 'awaitingQualification' : 'awaitingInterview';
    if (step === 'interview') application.status = 'inInterview';
    application.returnDate =
      application.qualification.result === 'temporary'
        ? calculateReturnDate(
            application.admission.date,
            application.qualification.duration,
            application.qualification.durationUnit,
          )
        : null;
    if (finalize) {
      application.status =
        application.qualification.result === 'eligible'
          ? 'selected'
          : application.qualification.result === 'temporary'
            ? 'deferred'
            : 'excluded';
      application.completedSteps.push('review');
    }
    state.applications = [application, ...state.applications.filter((a) => a.id !== application.id)];
    getStorage().setItem(selectionStorageKey, JSON.stringify(state));
    return structuredClone(application);
  };
  return {
    async listApplications() {
      const donatedIds = new Set(
        readProcessingState(getStorage)
          .collections.filter((record) => record.status === 'completed')
          .map((record) => record.application.id),
      );
      return structuredClone(read().applications.filter((application) => !donatedIds.has(application.id)));
    },
    async lookupApplicant(identity) {
      return history(identity);
    },
    async saveDraft(application) {
      return persist(application);
    },
    async completeStep(application, step) {
      return persist(application, step);
    },
    async finalizeSelection(application) {
      return persist(application, undefined, true);
    },
  };
}
