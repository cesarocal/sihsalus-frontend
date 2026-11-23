import { openmrsFetch } from '@openmrs/esm-framework';

import type {
  CollectionConcept,
  CollectionConceptField,
  CollectionRecord,
  CollectionStep,
} from '../sections/collection/collection.types';
import type { DonorReactionUpdate } from '../sections/collection/donor-reaction';
import type {
  ApheresisCandidate,
  ApheresisDraft,
  ScreeningRecord,
  ScreeningRepeatInput,
  ScreeningRepeatRound,
  ScreeningRepeatStep,
  ScreeningStep,
} from '../sections/laboratory/screening/screening.types';

export interface CollectionApi {
  listCollections(): Promise<CollectionRecord[]>;
  listLabelConcepts(field: CollectionConceptField): Promise<CollectionConcept[]>;
  saveCollection(record: CollectionRecord, step?: CollectionStep): Promise<CollectionRecord>;
  saveDonorReaction(collectionId: string, revision: number, update: DonorReactionUpdate): Promise<CollectionRecord>;
  recordPrint?(collectionId: string, kind: 'unit' | 'sample' | 'certificate', operationUuid: string): Promise<void>;
}
export interface ScreeningApi {
  listAdditionalTestConcepts(): Promise<CollectionConcept[]>;
  listScreenings(): Promise<ScreeningRecord[]>;
  saveScreening(record: ScreeningRecord, step?: ScreeningStep): Promise<ScreeningRecord>;
  saveScreeningRepeat(
    screeningId: string,
    input: ScreeningRepeatInput,
    step?: ScreeningRepeatStep,
  ): Promise<ScreeningRepeatRound>;
  listApheresisCandidates(): Promise<ApheresisCandidate[]>;
  getApheresisDraft(): Promise<ApheresisDraft | null>;
  saveApheresisDraft(candidate: ApheresisCandidate, revision: number): Promise<ApheresisDraft>;
  registerApheresisSample(draft: ApheresisDraft): Promise<ScreeningRecord>;
}
/** Opt-in experimental OMOD endpoints. The server enforces privileges and its local-only feature flag. */
export const processingEndpoints = {
  collections: '/ws/rest/v1/bloodbank/collections',
  donorReactions: (collectionId: string) =>
    `/ws/rest/v1/bloodbank/collections/${encodeURIComponent(collectionId)}/donor-reactions`,
  screenings: '/ws/rest/v1/bloodbank/screenings',
  screeningRepeats: (screeningId: string) =>
    `/ws/rest/v1/bloodbank/screenings/${encodeURIComponent(screeningId)}/repeats`,
  apheresisCandidates: '/ws/rest/v1/bloodbank/screenings/apheresis/candidates',
  apheresisDraft: '/ws/rest/v1/bloodbank/screenings/apheresis/draft',
  apheresisSamples: '/ws/rest/v1/bloodbank/screenings/apheresis/samples',
};
export const openmrsCollectionApi: CollectionApi = {
  async listCollections() {
    const response = await openmrsFetch<CollectionRecord[]>(processingEndpoints.collections);
    return response.data;
  },
  async listLabelConcepts() {
    throw new Error('COLLECTION_CONCEPTS_NOT_CONFIGURED');
  },
  async saveCollection(record, step) {
    const isNew = record.id.startsWith('new-collection-');
    const url = isNew ? processingEndpoints.collections : `${processingEndpoints.collections}/${encodeURIComponent(record.id)}`;
    const response = await openmrsFetch<CollectionRecord>(url, {
      method: isNew ? 'POST' : 'PUT',
      headers: { 'content-type': 'application/json' },
      body: { record, step: step ?? null },
    });
    return response.data;
  },
  async saveDonorReaction(collectionId, revision, update) {
    const response = await openmrsFetch<CollectionRecord>(processingEndpoints.donorReactions(collectionId), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: { revision, update },
    });
    return response.data;
  },
  async recordPrint(collectionId, kind, operationUuid) {
    await openmrsFetch(`${processingEndpoints.collections}/${encodeURIComponent(collectionId)}/prints`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: { kind, operationUuid },
    });
  },
};
export const openmrsScreeningApi: ScreeningApi = {
  async listAdditionalTestConcepts() {
    throw new Error('SCREENING_CONCEPTS_NOT_CONFIGURED');
  },
  async listScreenings() {
    const response = await openmrsFetch<ScreeningRecord[]>(processingEndpoints.screenings);
    return response.data;
  },
  async saveScreening(record, step) {
    const response = await openmrsFetch<ScreeningRecord>(
      `${processingEndpoints.screenings}/${encodeURIComponent(record.id)}`,
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: { record, step: step ?? null },
      },
    );
    return response.data;
  },
  async saveScreeningRepeat(screeningId, input, step) {
    const response = await openmrsFetch<ScreeningRepeatRound>(processingEndpoints.screeningRepeats(screeningId), {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: { input, step: step ?? null },
    });
    return response.data;
  },
  async listApheresisCandidates() {
    const response = await openmrsFetch<ApheresisCandidate[]>(processingEndpoints.apheresisCandidates);
    return response.data;
  },
  async getApheresisDraft() {
    const response = await openmrsFetch<ApheresisDraft | null>(processingEndpoints.apheresisDraft);
    return response.data ?? null;
  },
  async saveApheresisDraft(candidate, revision) {
    const response = await openmrsFetch<ApheresisDraft>(processingEndpoints.apheresisDraft, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: { candidate, revision },
    });
    return response.data;
  },
  async registerApheresisSample(draft) {
    const response = await openmrsFetch<ScreeningRecord>(processingEndpoints.apheresisSamples, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: draft,
    });
    return response.data;
  },
};
