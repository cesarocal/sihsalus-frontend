import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

import type {
  FractionationBatch,
  FractionationStep,
  FractionationWorkspace,
} from '../sections/laboratory/fractionation/fractionation.types';
import type { CollectionConcept } from '../sections/collection/collection.types';
import { getActiveConceptSet } from './collection-label-concepts.api';

export type FractionationCatalogField = 'anticoagulant' | 'storageTemperature' | 'antibodies';

export interface FractionationApi {
  listLabelConcepts(field: FractionationCatalogField): Promise<CollectionConcept[]>;
  getModifierLocation?: () => Promise<string>;
  modifierLocationUuid?: string;
  list(): Promise<FractionationWorkspace>;
  start(sourceIds: string[], locationUuid?: string): Promise<FractionationBatch>;
  save(batch: FractionationBatch, completedStep?: FractionationStep): Promise<FractionationBatch>;
  finalize(batch: FractionationBatch): Promise<FractionationBatch>;
  recordPrint?: (batch: FractionationBatch, operationUuid: string) => Promise<void>;
}

const labelCatalog = {
  anticoagulant: '03b13291-d348-570f-9928-b2143f621c4e',
  storageTemperature: '450f0d95-55b9-5ca3-9d68-c3066eef9303',
  antibodies: '0be27f96-43d4-5c22-b1e6-2422678b807c',
} as const;

export const fractionationEndpoints = {
  workspace: '/ws/rest/v1/bloodbank/fractionation',
  start: '/ws/rest/v1/bloodbank/fractionation/start',
  save: (uuid: string) => `/ws/rest/v1/bloodbank/fractionation/${encodeURIComponent(uuid)}`,
  finalize: (uuid: string) => `/ws/rest/v1/bloodbank/fractionation/${encodeURIComponent(uuid)}/finalize`,
  print: (uuid: string) => `/ws/rest/v1/bloodbank/fractionation/${encodeURIComponent(uuid)}/labels/print`,
} as const;
export const openmrsFractionationApi: FractionationApi = {
  async listLabelConcepts(field) {
    if (field !== 'antibodies') return getActiveConceptSet(labelCatalog[field]);
    const { data } = await openmrsFetch<{
      uuid: string;
      retired: boolean;
      answers: Array<CollectionConcept & { retired: boolean }>;
    }>(`${restBaseUrl}/concept/${labelCatalog.antibodies}?v=custom:(uuid,retired,answers:(uuid,display,retired))`, {
      rejectOnAuthFailure: true,
    });
    if (data?.uuid !== labelCatalog.antibodies || data.retired || !Array.isArray(data.answers)) {
      throw new Error('FRACTIONATION_CONCEPTS_NOT_CONFIGURED');
    }
    return data.answers.filter(({ uuid, display, retired }) => Boolean(uuid && display && retired === false));
  },
  async list() {
    const response = await openmrsFetch<FractionationWorkspace>(fractionationEndpoints.workspace, { rejectOnAuthFailure: true });
    return response.data;
  },
  async start(sourceIds, locationUuid) {
    const response = await openmrsFetch<FractionationBatch>(fractionationEndpoints.start, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: { sourceIds, ...(locationUuid ? { locationUuid } : {}) },
      rejectOnAuthFailure: true,
    });
    return response.data;
  },
  async save(batch, completedStep) {
    const response = await openmrsFetch<FractionationBatch>(fractionationEndpoints.save(batch.id), {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: { batch, step: completedStep ?? null },
      rejectOnAuthFailure: true,
    });
    return response.data;
  },
  async finalize(batch) {
    const response = await openmrsFetch<FractionationBatch>(fractionationEndpoints.finalize(batch.id), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: batch,
      rejectOnAuthFailure: true,
    });
    return response.data;
  },
  async recordPrint(batch, operationUuid) {
    await openmrsFetch(fractionationEndpoints.print(batch.id), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: { revision: batch.revision, operationUuid },
      rejectOnAuthFailure: true,
    });
  },
};
