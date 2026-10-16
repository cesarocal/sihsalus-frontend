import type {
  TransferDelivery,
  TransferPreparation,
  TransferRequest,
  TransferWorkspace,
} from '../sections/transfers/transfers.types';

/** Proposed POST DTO. The server must authenticate sender identity and resolve external identifiers. */
export interface IncomingTransferPayload {
  schemaVersion: 1;
  sourceSystem: string;
  externalRequestId: string;
  request: TransferRequest['data'];
}
/** Proposed local request generation DTO; creation is not proof of external delivery. */
export interface OutgoingTransferPayload {
  schemaVersion: 1;
  direction: 'outgoing';
  request: TransferRequest['data'];
}

export interface TransfersApi {
  list(): Promise<TransferWorkspace>;
  saveRequest(request: TransferRequest, submit: boolean): Promise<TransferRequest>;
  savePreparation(id: string, revision: number, preparation: TransferPreparation): Promise<TransferRequest>;
  reserve(id: string, revision: number): Promise<TransferRequest>;
  saveDelivery(id: string, revision: number, delivery: TransferDelivery): Promise<TransferRequest>;
  deliver(id: string, revision: number): Promise<TransferRequest>;
  reject(id: string, revision: number, reason: string): Promise<TransferRequest>;
}
/** Proposed backend routes, not a running HTTP receiver. Prefix /openmrs is supplied by OpenMRS. */
export const transferEndpoints = {
  requests: '/ws/rest/v1/bloodbank/transfer-requests',
  request: '/ws/rest/v1/bloodbank/transfer-requests/:uuid',
  preparation: '/ws/rest/v1/bloodbank/transfer-requests/:uuid/preparation',
  reserve: '/ws/rest/v1/bloodbank/transfer-requests/:uuid/reserve',
  delivery: '/ws/rest/v1/bloodbank/transfer-requests/:uuid/delivery',
  deliver: '/ws/rest/v1/bloodbank/transfer-requests/:uuid/deliver',
  reject: '/ws/rest/v1/bloodbank/transfer-requests/:uuid/reject',
} as const;
const unavailable = async (): Promise<never> => {
  throw new Error('TRANSFER_BACKEND_NOT_IMPLEMENTED');
};
export const openmrsTransfersApi: TransfersApi = {
  list: unavailable,
  saveRequest: unavailable,
  savePreparation: unavailable,
  reserve: unavailable,
  saveDelivery: unavailable,
  deliver: unavailable,
  reject: unavailable,
};
