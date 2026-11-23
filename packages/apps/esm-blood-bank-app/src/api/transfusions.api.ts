import { openmrsFetch } from '@openmrs/esm-framework';
import type {
  CompatibilityRound,
  RecipientSample,
  TransfusionDraft,
  TransfusionOrder,
  TransfusionRequest,
  TransfusionReturn,
  TransfusionReturnInspection,
  TransfusionReturnReceipt,
  TransfusionReturnView,
  TransfusionWorkspace,
} from '../sections/transfusions/transfusions.types';
import { openmrsCompatibilityApi, type PersistedCompatibilityApi } from './compatibility.api';

export interface TransfusionsApi {
  compatibility?: PersistedCompatibilityApi;
  list(): Promise<TransfusionWorkspace>;
  /** Starts the bank workflow for an issued OpenMRS order. */
  prepareIssuedRequest?(order: TransfusionOrder): Promise<TransfusionRequest>;
  cancelIssuedRequest?(id: string, decision: NonNullable<TransfusionRequest['consentClosure']>): Promise<boolean>;
  receiveReturnedUnit?(
    dispatchId: string,
    consentDecisionUuid: string,
    receipt: TransfusionReturnReceipt,
  ): Promise<TransfusionReturn>;
  inspectReturnedUnit?(dispatchId: string, inspection: TransfusionReturnInspection): Promise<TransfusionReturn>;
  saveDraft(id: string, revision: number, draft: TransfusionDraft): Promise<TransfusionRequest>;
  review(id: string, revision: number, draft: TransfusionDraft): Promise<TransfusionRequest>;
  saveSample(id: string, revision: number, sample: RecipientSample): Promise<TransfusionRequest>;
  assign(id: string, revision: number, unitIds: string[], verified: boolean): Promise<TransfusionRequest>;
  saveCompatibility(
    id: string,
    revision: number,
    round: CompatibilityRound,
    finalize: boolean,
  ): Promise<TransfusionRequest>;
  communicateCompatibility(id: string, revision: number, roundId: string, actor: string): Promise<TransfusionRequest>;
  deliver(id: string, revision: number, draft: TransfusionDraft): Promise<TransfusionRequest>;
}

export async function listCompatibilityRequests(api: TransfusionsApi): Promise<TransfusionRequest[]> {
  return api.compatibility ? api.compatibility.list() : (await api.list()).requests;
}

export const transfusionEndpoints = {
  requests: '/ws/rest/v1/bloodbank/transfusion-requests',
  request: '/ws/rest/v1/bloodbank/transfusion-requests/:uuid',
  draft: '/ws/rest/v1/bloodbank/transfusion-requests/:uuid/draft',
  review: '/ws/rest/v1/bloodbank/transfusion-requests/:uuid/review',
  sample: '/ws/rest/v1/bloodbank/transfusion-requests/:uuid/recipient-sample',
  assignments: '/ws/rest/v1/bloodbank/transfusion-requests/:uuid/assignments',
  compatibility: '/ws/rest/v1/bloodbank/transfusion-requests/:uuid/compatibility/:roundUuid',
  communication: '/ws/rest/v1/bloodbank/transfusion-requests/:uuid/compatibility/:roundUuid/communication',
  deliver: '/ws/rest/v1/bloodbank/transfusion-requests/:uuid/deliver',
  cancellation: '/ws/rest/v1/bloodbank/transfusion-requests/:uuid/cancellation',
  returns: '/ws/rest/v1/bloodbank/transfusion-returns',
  returnReceipt: '/ws/rest/v1/bloodbank/transfusion-returns/:uuid/receipt',
  returnInspection: '/ws/rest/v1/bloodbank/transfusion-returns/:uuid/inspection',
} as const;

async function clinicalRequest<T>(path: string, id?: string, method = 'GET', body?: object): Promise<T> {
  const url = id ? path.replace(':uuid', encodeURIComponent(id)) : path;
  const { data } = await openmrsFetch<T>(url, {
    method,
    ...(body ? { headers: { 'Content-Type': 'application/json' }, body } : {}),
    rejectOnAuthFailure: true,
  });
  return data;
}

const getRequest = (id: string) => clinicalRequest<TransfusionRequest>(transfusionEndpoints.request, id);

export const openmrsTransfusionsApi: TransfusionsApi = {
  compatibility: openmrsCompatibilityApi,
  async list() {
    const [workspace, returns] = await Promise.all([
      clinicalRequest<TransfusionWorkspace>(transfusionEndpoints.requests),
      clinicalRequest<TransfusionReturnView[]>(transfusionEndpoints.returns),
    ]);
    return { ...workspace, returns };
  },
  prepareIssuedRequest: (order) => clinicalRequest<TransfusionRequest>(transfusionEndpoints.request, order.id, 'POST'),
  async cancelIssuedRequest(id, consent) {
    const result = await clinicalRequest<{ cancelled: boolean }>(transfusionEndpoints.cancellation, id, 'POST', {
      consentUuid: consent.uuid,
    });
    return result.cancelled;
  },
  receiveReturnedUnit: (dispatchId, consentDecisionUuid, receipt) =>
    clinicalRequest<TransfusionReturn>(transfusionEndpoints.returnReceipt, dispatchId, 'POST', {
      consentDecisionUuid,
      receipt,
    }),
  inspectReturnedUnit: (dispatchId, inspection) =>
    clinicalRequest<TransfusionReturn>(transfusionEndpoints.returnInspection, dispatchId, 'POST', inspection),
  saveDraft: (id, revision, draft) =>
    clinicalRequest<TransfusionRequest>(transfusionEndpoints.draft, id, 'PUT', { revision, draft }),
  review: (id, revision, draft) =>
    clinicalRequest<TransfusionRequest>(transfusionEndpoints.review, id, 'POST', { revision, draft }),
  saveSample: (id, revision, sample) =>
    clinicalRequest<TransfusionRequest>(transfusionEndpoints.sample, id, 'POST', { revision, sample }),
  assign: (id, revision, unitIds, verified) =>
    clinicalRequest<TransfusionRequest>(transfusionEndpoints.assignments, id, 'POST', { revision, unitIds, verified }),
  async saveCompatibility(id, _revision, round, finalize) {
    await openmrsCompatibilityApi.save(await getRequest(id), round, finalize);
    return getRequest(id);
  },
  async communicateCompatibility(id, _revision, roundId) {
    const request = await getRequest(id);
    const round = request.rounds.find(({ id }) => id === roundId);
    if (!round) throw new Error('COMPATIBILITY_ROUND_NOT_FOUND');
    await openmrsCompatibilityApi.communicate(request, round);
    return getRequest(id);
  },
  deliver: (id, revision, draft) =>
    clinicalRequest<TransfusionRequest>(transfusionEndpoints.deliver, id, 'POST', { revision, draft }),
};
