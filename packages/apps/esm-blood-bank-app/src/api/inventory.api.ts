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
/** Proposed OMOD contracts: authorization, transactions and idempotency must be enforced server-side. */
export const inventoryEndpoints = {
  inventory: '/ws/rest/v1/bloodbank/inventory',
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
const unavailable = async (): Promise<never> => {
  throw new Error('BACKEND_NOT_IMPLEMENTED');
};
export const openmrsInventoryApi: InventoryApi = {
  list: unavailable,
  getDisposalSignatories: unavailable,
  saveDraft: unavailable,
  saveDisposalSelection: unavailable,
  saveDisposalDetails: unavailable,
  prepareSeal: unavailable,
  requestSealPrint: unavailable,
  requestSealReprint: unavailable,
  confirmSeal: unavailable,
  dispose: unavailable,
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
