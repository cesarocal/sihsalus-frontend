import type {
  InventoryOperation,
  InventoryWorkspace,
  QualitySealReprintRequest,
} from '../sections/inventory/inventory.types';

export interface InventoryApi {
  list(): Promise<InventoryWorkspace>;
  saveDraft(operation: InventoryOperation): Promise<InventoryOperation>;
  prepareSeal(operation: InventoryOperation): Promise<InventoryOperation>;
  requestSealPrint(operation: InventoryOperation, operator: string): Promise<InventoryOperation>;
  requestSealReprint(operation: InventoryOperation, request: QualitySealReprintRequest): Promise<InventoryOperation>;
  confirmSeal(operation: InventoryOperation): Promise<InventoryOperation>;
  dispose(operation: InventoryOperation): Promise<InventoryOperation>;
}
/** Proposed OMOD contracts: authorization, transactions and idempotency must be enforced server-side. */
export const inventoryEndpoints = {
  inventory: '/ws/rest/v1/bloodbank/inventory',
  operations: '/ws/rest/v1/bloodbank/inventory/operations',
  draft: '/ws/rest/v1/bloodbank/inventory/operations/:uuid',
  prepareSeal: '/ws/rest/v1/bloodbank/inventory/operations/:uuid/prepare-seal',
  requestPrint: '/ws/rest/v1/bloodbank/inventory/operations/:uuid/request-print',
  requestReprint: '/ws/rest/v1/bloodbank/inventory/operations/:uuid/request-reprint',
  confirmSeal: '/ws/rest/v1/bloodbank/inventory/operations/:uuid/confirm-seal',
  dispose: '/ws/rest/v1/bloodbank/inventory/operations/:uuid/dispose',
} as const;
const unavailable = async (): Promise<never> => {
  throw new Error('BACKEND_NOT_IMPLEMENTED');
};
export const openmrsInventoryApi: InventoryApi = {
  list: unavailable,
  saveDraft: unavailable,
  prepareSeal: unavailable,
  requestSealPrint: unavailable,
  requestSealReprint: unavailable,
  confirmSeal: unavailable,
  dispose: unavailable,
};
