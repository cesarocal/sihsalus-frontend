import { newCollection, validateCollection, validateCollectionDraft } from '../sections/collection/collection-rules';
import { collectionSteps } from '../sections/collection/collection.types';
import {
  globalScreeningResult,
  localDateTime,
  newApheresisScreening,
  newScreening,
  validateScreening,
} from '../sections/laboratory/screening/screening-rules';
import { screeningRepeatDraft, screeningRepeatTests } from '../sections/laboratory/screening/screening-repeat-rules';
import {
  screeningResultOptions,
  screeningSteps,
  type ScreeningRepeatRound,
} from '../sections/laboratory/screening/screening.types';
import type { ApplicantSelectionApi } from './applicant-selection.api';
import type { CollectionApi, ScreeningApi } from './blood-bank-processing.api';
import type { ApheresisCandidate, ScreeningRecord } from '../sections/laboratory/screening/screening.types';
import { fullName } from '../sections/collection/collection-rules';
import { readProcessingState, writeProcessingState, type MockStorage } from './mock-processing-store';

function screeningResultData({ tests, bloodData, additionalTest, recommendations }: ScreeningRecord) {
  return JSON.stringify([tests, bloodData, additionalTest, recommendations]);
}

export function createMockProcessingApi(
  selection: ApplicantSelectionApi,
  getStorage: () => MockStorage = () => globalThis.sessionStorage,
): { collection: CollectionApi; screening: ScreeningApi } {
  const candidates = async (): Promise<ApheresisCandidate[]> => {
    const applications = await selection.listApplications();
    const state = readProcessingState(getStorage);
    return applications
      .filter(
        (item) =>
          ['admitted', 'awaitingInterview', 'inInterview', 'awaitingQualification', 'selected'].includes(item.status) &&
          item.admission.modality === 'apheresis' &&
          !!item.admission.documentNumber.trim() &&
          !!item.personal.givenName.trim() &&
          !!item.personal.familyName.trim() &&
          !state.screenings.some(
            (sample) => sample.origin?.type === 'apheresis' && sample.origin.applicationId === item.id,
          ),
      )
      .map((item) => ({
        applicationId: item.id,
        applicationRevision: item.revision,
        applicationNumber: item.number,
        applicantName: fullName(item),
        documentNumber: item.admission.documentNumber,
        admissionDate: item.admission.date,
        donationType: item.admission.donationType,
        donorCode: item.admission.donorCode,
      }));
  };
  const collection: CollectionApi = {
    async listLabelConcepts(field) {
      return field === 'service'
        ? [
            { uuid: 'mock-collection-blood-bank', display: 'UPSS Banco de Sangre' },
            { uuid: 'mock-collection-campaign', display: 'Campaña de donación' },
          ]
        : [{ uuid: 'mock-collection-cpda1', display: 'CPDA-1' }];
    },
    async listCollections() {
      const applications = await selection.listApplications();
      const state = readProcessingState(getStorage);
      return structuredClone([
        ...applications
          .filter((item) => item.status === 'selected')
          .filter((item) => !state.collections.some((record) => record.application.id === item.id))
          .map(newCollection),
        ...state.collections,
      ]);
    },
    async saveCollection(input, step) {
      const applications = await selection.listApplications();
      const state = readProcessingState(getStorage);
      const previous = state.collections.find((record) => record.id === input.id);
      const application = applications.find((item) => item.id === input.application.id && item.status === 'selected');
      if (!application || previous?.status === 'completed') throw new Error('COLLECTION_NOT_AVAILABLE');
      if ((previous?.revision ?? 0) !== input.revision) throw new Error('COLLECTION_CONFLICT');
      const canonical = previous ?? newCollection(application);
      if (
        input.id !== canonical.id ||
        input.unitCode !== canonical.unitCode ||
        input.sampleCode !== canonical.sampleCode
      )
        throw new Error('COLLECTION_IDENTITY_CONFLICT');
      if (canonical.completedSteps.includes('label') && JSON.stringify(input.label) !== JSON.stringify(canonical.label))
        throw new Error('COLLECTION_LABEL_LOCKED');
      if (canonical.completedSteps.includes('volume') && input.extractedVolume !== canonical.extractedVolume)
        throw new Error('COLLECTION_VOLUME_LOCKED');
      if (
        canonical.completedSteps.includes('registry') &&
        JSON.stringify(input.registry) !== JSON.stringify(canonical.registry)
      )
        throw new Error('COLLECTION_REGISTRY_LOCKED');
      const record = structuredClone({
        ...canonical,
        label: input.label,
        extractedVolume: input.extractedVolume,
        registry: input.registry,
        certificate: input.certificate,
        application: canonical.application,
      });
      // Drafts and completed stages share the same bound; never crop historical input.
      const draftErrors = validateCollectionDraft(record);
      if (draftErrors.includes('bagLotTooLong')) throw new Error('COLLECTION_TEXT_LIMIT');
      if (!step && draftErrors.length) throw new Error('COLLECTION_INCOMPLETE');
      if (step) {
        const index = collectionSteps.indexOf(step);
        if (
          index < 0 ||
          collectionSteps.slice(0, index).some((required) => !canonical.completedSteps.includes(required))
        )
          throw new Error('COLLECTION_STAGE_ORDER');
        if (validateCollection(record, step).length) throw new Error('COLLECTION_INCOMPLETE');
        if (!record.completedSteps.includes(step)) record.completedSteps.push(step);
      }
      record.revision++;
      record.status = record.completedSteps.includes('certificate') ? 'completed' : 'inProgress';
      record.unitStatus = record.completedSteps.includes('volume') ? 'quarantine' : 'prepared';
      record.updatedAt = new Date().toISOString();
      if (step === 'label' && !state.screenings.some((item) => item.collectionId === record.id))
        state.screenings.push(newScreening(record));
      state.collections = [record, ...state.collections.filter((item) => item.id !== record.id)];
      // The unit, sample and stage transition share one atomic per-tab storage write.
      writeProcessingState(getStorage, state);
      return structuredClone(record);
    },
  };
  const screening: ScreeningApi = {
    listApheresisCandidates: candidates,
    async getApheresisDraft() {
      return structuredClone(readProcessingState(getStorage).apheresisDraft ?? null);
    },
    async saveApheresisDraft(input, revision) {
      const canonical = (await candidates()).find((item) => item.applicationId === input.applicationId);
      if (!canonical || canonical.applicationRevision !== input.applicationRevision)
        throw new Error('APHERESIS_APPLICATION_NOT_AVAILABLE');
      const state = readProcessingState(getStorage);
      if ((state.apheresisDraft?.revision ?? 0) !== revision) throw new Error('APHERESIS_DRAFT_CONFLICT');
      const draft = { candidate: canonical, revision: revision + 1 };
      state.apheresisDraft = draft;
      writeProcessingState(getStorage, state);
      return structuredClone(draft);
    },
    async registerApheresisSample(input) {
      const available = await candidates();
      const state = readProcessingState(getStorage);
      const existing = state.screenings.find(
        (item) => item.origin?.type === 'apheresis' && item.origin.applicationId === input.candidate.applicationId,
      );
      // A retry after a lost response returns the same sample, never a second tube.
      if (existing) return structuredClone(existing);
      const draft = state.apheresisDraft;
      const canonical = available.find((item) => item.applicationId === input.candidate.applicationId);
      if (
        !draft ||
        draft.revision !== input.revision ||
        draft.candidate.applicationId !== input.candidate.applicationId ||
        !canonical ||
        canonical.applicationRevision !== draft.candidate.applicationRevision ||
        canonical.applicationRevision !== input.candidate.applicationRevision
      )
        throw new Error('APHERESIS_REGISTRATION_CONFLICT');
      const record = newApheresisScreening(canonical);
      state.screenings.push(record);
      state.apheresisDraft = null;
      // Registration does not create a unit/donation or change the selection decision.
      writeProcessingState(getStorage, state);
      return structuredClone(record);
    },
    async listScreenings() {
      return structuredClone(readProcessingState(getStorage).screenings);
    },
    async saveScreeningRepeat(screeningId, input, step) {
      const state = readProcessingState(getStorage);
      const record = state.screenings.find((item) => item.id === screeningId);
      const previous = record && screeningRepeatDraft(record);
      if (!record || !previous || previous.id !== input.roundId || previous.revision !== input.revision)
        throw new Error('SCREENING_REPEAT_CONFLICT');
      if (validateScreening(record, 'validation').length) throw new Error('SCREENING_REPEAT_INVALID_SOURCE');
      const tests = screeningRepeatTests(previous);
      if (
        Object.keys(input.results).length !== tests.length ||
        tests.some((test) => {
          const outcome = input.results[test];
          return outcome !== '' && !screeningResultOptions.some((option) => option === outcome);
        })
      )
        throw new Error('SCREENING_REPEAT_INVALID_TESTS');
      const changed = tests.some((test) => previous.results[test] !== input.results[test]);
      const operator = input.operatorName.trim();
      if (step && (!operator || tests.some((test) => !input.results[test])))
        throw new Error('SCREENING_REPEAT_INCOMPLETE');
      if (step === 'validation' && (previous.status !== 'readyForValidation' || changed))
        throw new Error('SCREENING_REPEAT_NOT_SAVED');

      const next: ScreeningRepeatRound = { ...previous, results: input.results, revision: previous.revision + 1 };
      if (step === 'results') {
        next.status = 'readyForValidation';
        next.performedOn = localDateTime();
        next.performedBy = operator;
      } else if (step === 'validation') {
        next.status = 'validated';
        next.validatedBy = operator;
        next.validatedAt = new Date().toISOString();
      } else if (changed) {
        next.status = 'draft';
        next.performedOn = '';
        next.performedBy = '';
      }

      const rounds = record.repeatRounds ?? [];
      record.repeatRounds = rounds.at(-1)?.id === next.id ? [...rounds.slice(0, -1), next] : [...rounds, next];
      writeProcessingState(getStorage, state);
      return structuredClone(next);
    },
    async saveScreening(input, step) {
      const state = readProcessingState(getStorage);
      const previous = state.screenings.find((record) => record.id === input.id);
      if (!previous || previous.status === 'validated' || previous.revision !== input.revision)
        throw new Error('SCREENING_CONFLICT');
      if (
        previous.completedSteps.includes('reception') &&
        (input.receivedOn !== previous.receivedOn ||
          input.receivedBy !== previous.receivedBy ||
          input.identityVerified !== previous.identityVerified)
      )
        throw new Error('SCREENING_RECEPTION_LOCKED');
      const resultsChanged = screeningResultData(previous) !== screeningResultData(input);
      if (step === 'validation' && previous.completedSteps.includes('results') && resultsChanged)
        throw new Error('SCREENING_RESULTS_NOT_SAVED');
      const reopenResults = !step && resultsChanged && previous.completedSteps.includes('results');
      const record = structuredClone({
        ...previous,
        receivedOn: input.receivedOn,
        receivedBy: input.receivedBy,
        identityVerified: input.identityVerified,
        completedSteps: reopenResults
          ? previous.completedSteps.filter((completed) => completed !== 'results')
          : previous.completedSteps,
        performedOn: step === 'results' ? input.performedOn : reopenResults ? '' : previous.performedOn,
        performedBy: step === 'results' ? input.performedBy : reopenResults ? '' : previous.performedBy,
        tests: input.tests,
        bloodData: input.bloodData,
        additionalTest: input.additionalTest,
        recommendations: input.recommendations,
        validatedBy: input.validatedBy,
      });
      if (step) {
        const index = screeningSteps.indexOf(step);
        if (index < 0 || screeningSteps.slice(0, index).some((required) => !previous.completedSteps.includes(required)))
          throw new Error('SCREENING_STAGE_ORDER');
        if (validateScreening(record, step).length) throw new Error('SCREENING_INCOMPLETE');
        if (!record.completedSteps.includes(step)) record.completedSteps.push(step);
      }
      record.revision++;
      record.status = step === 'validation' ? 'validated' : 'inProgress';
      if (step === 'validation') {
        record.result = globalScreeningResult(record);
        record.validatedAt = new Date().toISOString();
      }
      state.screenings = [record, ...state.screenings.filter((item) => item.id !== record.id)];
      // Screening results never make a unit available for transfusion in this prototype.
      writeProcessingState(getStorage, state);
      return structuredClone(record);
    },
  };
  return { collection, screening };
}
