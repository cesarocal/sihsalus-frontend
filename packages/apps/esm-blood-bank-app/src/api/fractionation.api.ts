import type {
  FractionationBatch,
  FractionationStep,
  FractionationWorkspace,
} from '../sections/laboratory/fractionation/fractionation.types';

export interface FractionationApi {
  list(): Promise<FractionationWorkspace>;
  start(sourceIds: string[]): Promise<FractionationBatch>;
  save(batch: FractionationBatch, completedStep?: FractionationStep): Promise<FractionationBatch>;
  finalize(batch: FractionationBatch): Promise<FractionationBatch>;
}

/** Proposed OMOD contracts. No backend request is made until the capability is implemented. */
export const fractionationEndpoints = {
  queue: '/ws/rest/v1/bloodbank/fractionation/queue',
  history: '/ws/rest/v1/bloodbank/fractionation',
  start: '/ws/rest/v1/bloodbank/fractionation/start',
  save: '/ws/rest/v1/bloodbank/fractionation/:uuid',
  finalize: '/ws/rest/v1/bloodbank/fractionation/:uuid/finalize',
} as const;
const unavailable = async (): Promise<never> => {
  throw new Error('BACKEND_NOT_IMPLEMENTED');
};
export const openmrsFractionationApi: FractionationApi = {
  list: unavailable,
  start: unavailable,
  save: unavailable,
  finalize: unavailable,
};
