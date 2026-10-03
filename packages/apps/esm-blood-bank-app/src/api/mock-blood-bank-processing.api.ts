import { newCollection, validateCollection } from '../sections/collection/collection-rules';
import { collectionSteps } from '../sections/collection/collection.types';
import {
  globalScreeningResult,
  newScreening,
  validateScreening,
} from '../sections/laboratory/screening/screening-rules';
import { screeningSteps } from '../sections/laboratory/screening/screening.types';
import type { ApplicantSelectionApi } from './applicant-selection.api';
import type { CollectionApi, ScreeningApi } from './blood-bank-processing.api';
import { readProcessingState, writeProcessingState, type MockStorage } from './mock-processing-store';

export function createMockProcessingApi(
  selection: ApplicantSelectionApi,
  getStorage: () => MockStorage = () => globalThis.sessionStorage,
): { collection: CollectionApi; screening: ScreeningApi } {
  const collection: CollectionApi = {
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
    async listScreenings() {
      return structuredClone(readProcessingState(getStorage).screenings);
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
      const record = structuredClone({
        ...previous,
        receivedOn: input.receivedOn,
        receivedBy: input.receivedBy,
        identityVerified: input.identityVerified,
        performedOn: input.performedOn,
        performedBy: input.performedBy,
        tests: input.tests,
        observations: input.observations,
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
