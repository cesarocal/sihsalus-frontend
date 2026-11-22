import type {
  CompatibilityRound,
  RecipientSample,
  TransfusionDraft,
  TransfusionOrder,
  TransfusionRequest,
  TransfusionReturn,
  TransfusionReturnInspection,
  TransfusionReturnReceipt,
  TransfusionWorkspace,
} from '../sections/transfusions/transfusions.types';

export interface TransfusionsApi {
  list(): Promise<TransfusionWorkspace>;
  /** Starts the local stock workflow for an OpenMRS order in mock mode. */
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
/** Proposed OMOD routes for inventory, compatibility and dispatch of existing orders. */
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
} as const;
const unavailable = async (): Promise<never> => {
  throw new Error('TRANSFUSION_BACKEND_NOT_IMPLEMENTED');
};
export const openmrsTransfusionsApi: TransfusionsApi = {
  list: unavailable,
  saveDraft: unavailable,
  review: unavailable,
  saveSample: unavailable,
  assign: unavailable,
  saveCompatibility: unavailable,
  communicateCompatibility: unavailable,
  deliver: unavailable,
};
