import { openmrsFetch } from '@openmrs/esm-framework';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { newInventoryOperation } from '../sections/inventory/inventory-rules';
import { openmrsInventoryApi } from './inventory.api';

vi.mock('@openmrs/esm-framework', () => ({ openmrsFetch: vi.fn() }));

const fetchMock = vi.mocked(openmrsFetch);
const base = '/ws/rest/v1/bloodbank/inventory';

function respond<T>(data: T) {
  fetchMock.mockResolvedValueOnce(Object.assign(new Response(null), { data }));
}

describe('clinical inventory API', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('reads stock and authoritative signatories from the OMOD', async () => {
    respond({ units: [], operations: [] });
    expect(await openmrsInventoryApi.list()).toEqual({ units: [], operations: [] });
    expect(fetchMock).toHaveBeenLastCalledWith(base, { method: 'GET', rejectOnAuthFailure: true });
    const signatories = { serviceResponsible: 'Servicio', epidemiologyResponsible: 'Epidemiología' };
    respond(signatories);
    expect(await openmrsInventoryApi.getDisposalSignatories()).toEqual(signatories);
    expect(fetchMock).toHaveBeenLastCalledWith(`${base}/disposal-signatories`, {
      method: 'GET',
      rejectOnAuthFailure: true,
    });
  });

  it('creates a seal operation then sends the previous revision on each saved transition', async () => {
    const draft = newInventoryOperation('qualitySeal');
    const ready = { ...draft, id: 'seal/test', stage: 'ready', revision: 1 } as const;
    respond(ready);
    expect(await openmrsInventoryApi.prepareSeal(draft)).toEqual(ready);
    expect(fetchMock).toHaveBeenLastCalledWith(`${base}/operations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { operation: draft, action: 'prepare-seal' },
      rejectOnAuthFailure: true,
    });
    respond({ ...ready, stage: 'printRequested', revision: 2 });
    await openmrsInventoryApi.requestSealPrint(ready, 'Operator');
    expect(fetchMock).toHaveBeenLastCalledWith(`${base}/operations/seal%2Ftest/request-print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { operation: ready },
      rejectOnAuthFailure: true,
    });
  });
});
