import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import type { BloodBankConfig } from '../config-schema';
import type {
  DisposalSignatories,
  InventoryOperation,
  InventoryWorkspace,
  QualitySealReprintRequest,
} from '../sections/inventory/inventory.types';

export interface InventoryApi {
  list(): Promise<InventoryWorkspace>;
  getDisposalSignatories(): Promise<DisposalSignatories | null>;
  saveDraft(operation: InventoryOperation): Promise<InventoryOperation>;
  saveDisposalSelection(operation: InventoryOperation): Promise<InventoryOperation>;
  saveDisposalDetails(operation: InventoryOperation): Promise<InventoryOperation>;
  prepareSeal(operation: InventoryOperation): Promise<InventoryOperation>;
  requestSealPrint(operation: InventoryOperation, operator: string): Promise<InventoryOperation>;
  requestSealReprint(operation: InventoryOperation, request: QualitySealReprintRequest): Promise<InventoryOperation>;
  confirmSeal(operation: InventoryOperation, operator?: string): Promise<InventoryOperation>;
  dispose(operation: InventoryOperation): Promise<InventoryOperation>;
}
export const inventoryEndpoints = {
  inventory: '/ws/rest/v1/bloodbank/inventory',
  disposalSignatories: '/ws/rest/v1/bloodbank/inventory/disposal-signatories',
  operations: '/ws/rest/v1/bloodbank/inventory/operations',
  draft: '/ws/rest/v1/bloodbank/inventory/operations/:uuid',
  disposalSelection: '/ws/rest/v1/bloodbank/inventory/operations/:uuid/disposal-selection',
  disposalDetails: '/ws/rest/v1/bloodbank/inventory/operations/:uuid/disposal-details',
  prepareSeal: '/ws/rest/v1/bloodbank/inventory/operations/:uuid/prepare-seal',
  requestPrint: '/ws/rest/v1/bloodbank/inventory/operations/:uuid/request-print',
  requestReprint: '/ws/rest/v1/bloodbank/inventory/operations/:uuid/request-reprint',
  confirmSeal: '/ws/rest/v1/bloodbank/inventory/operations/:uuid/confirm-seal',
  dispose: '/ws/rest/v1/bloodbank/inventory/operations/:uuid/dispose',
} as const;

async function request<T>(url: string, method = 'GET', body?: object): Promise<T> {
  const { data } = await openmrsFetch<T>(url, {
    method,
    ...(body ? { headers: { 'Content-Type': 'application/json' }, body } : {}),
    rejectOnAuthFailure: true,
  });
  return data;
}

function save(
  operation: InventoryOperation,
  endpoint: string,
  action: string,
  reprint?: QualitySealReprintRequest,
) {
  const body = { operation, ...(reprint ? { reprint } : {}) };
  if (!operation.id) {
    return request<InventoryOperation>(inventoryEndpoints.operations, 'POST', { ...body, action });
  }
  return request<InventoryOperation>(
    endpoint.replace(':uuid', encodeURIComponent(operation.id)),
    action === 'draft' ? 'PUT' : 'POST',
    body,
  );
}

export const openmrsInventoryApi: InventoryApi = {
  list: () => request<InventoryWorkspace>(inventoryEndpoints.inventory),
  getDisposalSignatories: () => request<DisposalSignatories>(inventoryEndpoints.disposalSignatories),
  saveDraft: (operation) => save(operation, inventoryEndpoints.draft, 'draft'),
  saveDisposalSelection: (operation) => save(operation, inventoryEndpoints.disposalSelection, 'disposal-selection'),
  saveDisposalDetails: (operation) => save(operation, inventoryEndpoints.disposalDetails, 'disposal-details'),
  prepareSeal: (operation) => save(operation, inventoryEndpoints.prepareSeal, 'prepare-seal'),
  requestSealPrint: (operation) => save(operation, inventoryEndpoints.requestPrint, 'request-print'),
  requestSealReprint: (operation, reprint) => save(operation, inventoryEndpoints.requestReprint, 'request-reprint', reprint),
  confirmSeal: (operation) => save(operation, inventoryEndpoints.confirmSeal, 'confirm-seal'),
  dispose: (operation) => save(operation, inventoryEndpoints.dispose, 'dispose'),
};

interface OpenmrsSignatoryPerson {
  uuid: string;
  preferredName?: { display?: string };
}

export interface DisposalSignatoryPerson {
  uuid: string;
  name: string;
}

const signatoryPersonRepresentation = 'custom:(uuid,preferredName:(display))';

export async function searchDisposalSignatories(query: string, signal: AbortSignal): Promise<DisposalSignatoryPerson[]> {
  const params = new URLSearchParams({ q: query, v: signatoryPersonRepresentation, limit: '12' });
  const { data } = await openmrsFetch<{ results: OpenmrsSignatoryPerson[] }>(`${restBaseUrl}/person?${params}`, {
    rejectOnAuthFailure: true,
    signal,
  });
  return data.results.flatMap((person) => {
    const name = person.preferredName?.display?.trim();
    return person.uuid && name ? [{ uuid: person.uuid, name }] : [];
  });
}

export async function getDisposalSignatoryName(uuid?: string): Promise<string> {
  const personUuid = uuid?.trim();
  if (!personUuid) return '';
  const { data } = await openmrsFetch<OpenmrsSignatoryPerson>(
    `${restBaseUrl}/person/${encodeURIComponent(personUuid)}?v=${signatoryPersonRepresentation}`,
    { rejectOnAuthFailure: true },
  );
  if (data?.uuid !== personUuid) throw new Error('INVENTORY_SIGNATORY_UNAVAILABLE');
  return data.preferredName?.display?.trim() ?? '';
}

export function createDisposalSignatoriesLoader(config: BloodBankConfig['inventoryDisposalSignatories']) {
  return async (): Promise<DisposalSignatories> => {
    const [serviceResponsible, epidemiologyResponsible] = await Promise.all([
      getDisposalSignatoryName(config?.servicePersonUuid),
      getDisposalSignatoryName(config?.epidemiologyPersonUuid),
    ]);
    return { serviceResponsible, epidemiologyResponsible };
  };
}
