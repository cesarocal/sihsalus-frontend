import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { disposalOperation, sealOperation } from '../sections/inventory/inventory-test-fixtures';
import {
  candidateForRequest,
  completeTransferSelection,
  newTransferRequest,
  transferDirection,
  validateTransferRequest,
} from '../sections/transfers/transfers-rules';
import { createMockFractionationApi } from './mock-fractionation.api';
import { createMockInventoryApi } from './mock-inventory.api';
import { processingStorageKey, readProcessingState, writeProcessingState } from './mock-processing-store';
import { createMockTransfersApi } from './mock-transfers.api';
import { openmrsTransfersApi, transferEndpoints } from './transfers.api';

async function readyUnits() {
  const inventory = createMockInventoryApi();
  const units = (await inventory.list()).units.filter((unit) =>
    ['BB-SELLO-DEMO-001', 'BB-SELLO-DEMO-003'].includes(unit.id),
  );
  const prepared = await inventory.prepareSeal(sealOperation(units));
  const requested = await inventory.requestSealPrint(prepared);
  await inventory.confirmSeal(requested);
  return units.map((unit) => unit.id);
}
async function preparation(api = createMockTransfersApi()) {
  const ids = await readyUnits();
  const request = (await api.list()).requests[0];
  return api.savePreparation(request.id, request.revision, {
    unitIds: ids,
    certificateOffice: 'CONSTANCIA-MANUAL-2026',
    responsible: 'Profesional DEMO',
    evaluationVerified: true,
  });
}
async function delivery(api = createMockTransfersApi()) {
  const selected = await preparation(api);
  const prepared = await api.reserve(selected.id, selected.revision);
  return api.saveDelivery(prepared.id, prepared.revision, {
    collectorName: 'Transportista DEMO',
    collectorDocument: '90000999',
    deliveredBy: 'Entrega DEMO',
    transportVerified: true,
  });
}
describe('transfer requests, stock commitments and administrative logbook', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-14T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it('adds received examples without writes and preserves only the explicitly pre-approved fixture stock', async () => {
    const api = createMockTransfersApi();
    const before = sessionStorage.getItem(processingStorageKey);
    const workspace = await api.list();
    expect(workspace.requests).toHaveLength(3);
    expect(workspace.requests.every((item) => item.status === 'received')).toBe(true);
    const candidates = workspace.units.filter((unit) => candidateForRequest(unit, workspace.requests[0]));
    expect(candidates.map((unit) => unit.id)).toEqual(['BB-TX-DEMO-009']);
    expect(candidates[0].sealId).toBe('Q-TX-DEMO-009');
    expect(
      workspace.units
        .filter((unit) => unit.id.startsWith('BB-SELLO-DEMO-'))
        .every((unit) => unit.status === 'Cuarentena' && !unit.sealId),
    ).toBe(true);
    expect(sessionStorage.getItem(processingStorageKey)).toBe(before);
  });
  it('preserves drafts, requires full FR09 data for submission and retains external identities', async () => {
    const api = createMockTransfersApi();
    const partial = newTransferRequest();
    partial.data.patientName = 'Paciente externo DEMO';
    const saved = await api.saveRequest(partial, false);
    expect(saved.status).toBe('draft');
    expect(
      (await createMockTransfersApi().list()).requests.find((item) => item.id === saved.id)?.data.patientName,
    ).toBe(partial.data.patientName);
    await expect(api.saveRequest(saved, true)).rejects.toThrow('INVALID_TRANSFER_REQUEST');
    const template = (await api.list()).requests[0];
    const full = { ...saved, data: { ...template.data, office: 'MANUAL-001', externalId: 'EXTERNA-001' } };
    const received = await api.saveRequest(full, true);
    expect(received.status).toBe('received');
    expect(received.data.patientHistory).toBe(template.data.patientHistory);
    expect(received).not.toHaveProperty('patientUuid');
    expect(await api.saveRequest(full, true)).toEqual(received);
  });
  it('deduplicates exact external submissions and rejects conflicting reuse of the reference', async () => {
    const api = createMockTransfersApi();
    const template = (await api.list()).requests[0];
    const incoming = {
      ...newTransferRequest(),
      data: { ...template.data, office: 'API-DEMO', channel: 'api' as const, externalId: 'EXT-API-DEMO' },
    };
    const first = await api.saveRequest(incoming, true);
    expect((await api.saveRequest(incoming, true)).id).toBe(first.id);
    await expect(
      api.saveRequest({ ...incoming, data: { ...incoming.data, diagnosis: 'Otra información DEMO' } }, true),
    ).rejects.toThrow('TRANSFER_DUPLICATE');
  });
  it('generates outgoing requests idempotently without committing local stock or adding book entries', async () => {
    const api = createMockTransfersApi();
    const before = await api.list();
    const incoming = before.requests[0];
    const request = { ...newTransferRequest('outgoing'), data: { ...incoming.data, office: 'SALIDA-DEMO-001' } };
    const draft = await api.saveRequest(request, false);
    expect(draft.status).toBe('draft');
    expect(transferDirection(draft)).toBe('outgoing');
    const generated = await api.saveRequest(draft, true);
    expect(generated.status).toBe('issued');
    expect(generated.certificateUnits).toEqual([]);
    expect(await api.saveRequest(draft, true)).toEqual(generated);
    const reloaded = await createMockTransfersApi().list();
    expect(reloaded.units).toEqual(before.units);
    expect(reloaded.bookEntries).toEqual([]);
    expect(reloaded.requests.find((item) => item.id === generated.id)).toEqual(generated);
    await expect(
      api.saveRequest({ ...generated, data: { ...generated.data, office: 'EDITADO' } }, false),
    ).rejects.toThrow('TRANSFER_CONFLICT');
    await expect(api.savePreparation(generated.id, generated.revision, incoming.preparation)).rejects.toThrow(
      'TRANSFER_CONFLICT',
    );
    await expect(api.reserve(generated.id, generated.revision)).rejects.toThrow('TRANSFER_CONFLICT');
    await expect(api.deliver(generated.id, generated.revision)).rejects.toThrow('TRANSFER_CONFLICT');
    await expect(api.reject(generated.id, generated.revision, 'No aplica')).rejects.toThrow('TRANSFER_CONFLICT');
  });
  it('keeps incoming and outgoing reference namespaces separate and never changes a saved direction', async () => {
    const api = createMockTransfersApi();
    const incoming = (await api.list()).requests[0];
    const outgoing = await api.saveRequest({ ...newTransferRequest('outgoing'), data: incoming.data }, false);
    expect(outgoing.id).not.toBe(incoming.id);
    await expect(api.saveRequest({ ...outgoing, direction: 'incoming' }, false)).rejects.toThrow('TRANSFER_CONFLICT');
    await expect(
      api.saveRequest(
        { ...newTransferRequest('outgoing'), data: { ...incoming.data, diagnosis: 'Otro diagnóstico DEMO' } },
        true,
      ),
    ).rejects.toThrow('TRANSFER_DUPLICATE');
    expect((await api.list()).requests.filter((item) => transferDirection(item) === 'incoming')).toHaveLength(3);
  });
  it('reads previous incoming records without a direction without rewriting the saved document', async () => {
    const api = createMockTransfersApi();
    const incoming = (await api.list()).requests[0];
    const state = readProcessingState(() => sessionStorage);
    const legacy = { ...incoming };
    delete legacy.direction;
    writeProcessingState(() => sessionStorage, { ...state, transfers: { requests: [legacy], bookEntries: [] } });
    const before = sessionStorage.getItem(processingStorageKey);
    const loaded = await api.list();
    expect(transferDirection(loaded.requests[0])).toBe('incoming');
    expect(loaded.requests[0].data).toEqual(incoming.data);
    expect(sessionStorage.getItem(processingStorageKey)).toBe(before);
  });
  it('rejects quantities and duplicate component/group lines before admission', async () => {
    const request = (await createMockTransfersApi().list()).requests[0];
    for (const quantity of [0, -1, 1.5, Number.NaN])
      expect(validateTransferRequest({ ...request.data, items: [{ ...request.data.items[0], quantity }] })).toContain(
        'transferItemsRequired',
      );
    expect(
      validateTransferRequest({
        ...request.data,
        items: [...request.data.items, { ...request.data.items[0], id: 'other' }],
      }),
    ).toContain('transferItemsRequired');
  });
  it('requires exact quantities per component and accepted group, not merely total bag count', async () => {
    const api = createMockTransfersApi();
    const selected = await preparation(api);
    const workspace = await api.list();
    expect(completeTransferSelection(selected, workspace.units)).toBe(true);
    const partial = {
      ...selected,
      preparation: { ...selected.preparation, unitIds: selected.preparation.unitIds.slice(0, 1) },
    };
    expect(completeTransferSelection(partial, workspace.units)).toBe(false);
    const mixed = {
      ...selected,
      data: {
        ...selected.data,
        items: [
          { ...selected.data.items[0], quantity: 1 },
          { ...selected.data.items[0], id: 'plasma', component: 'freshFrozenPlasma' as const, quantity: 1 },
        ],
      },
    };
    expect(completeTransferSelection(mixed, workspace.units)).toBe(false);
  });
  it('reserves atomically, exposes Por transferir in stock and excludes all competing workflows', async () => {
    const api = createMockTransfersApi();
    const selected = await preparation(api);
    const reserved = await api.reserve(selected.id, selected.revision);
    expect(reserved.status).toBe('prepared');
    expect(reserved.preparation.certificateOffice).toBe('CONSTANCIA-MANUAL-2026');
    expect(reserved.certificateUnits).toHaveLength(2);
    const inventory = createMockInventoryApi();
    const units = (await inventory.list()).units.filter((unit) => selected.preparation.unitIds.includes(unit.id));
    expect(units.every((unit) => unit.status === 'Por transferir' && !unit.canDispose)).toBe(true);
    await expect(inventory.dispose(disposalOperation(units))).rejects.toThrow('INVENTORY_NOT_ELIGIBLE');
    const fractions = await createMockFractionationApi().list();
    expect(fractions.units.some((unit) => selected.preparation.unitIds.includes(unit.id))).toBe(false);
    const other = (await api.list()).requests[1];
    const contender = await api.savePreparation(other.id, other.revision, {
      ...selected.preparation,
      unitIds: [selected.preparation.unitIds[0]],
      certificateOffice: 'OTRA-CONSTANCIA',
    });
    await expect(api.reserve(contender.id, contender.revision)).rejects.toThrow('INVALID_TRANSFER_PREPARATION');
    expect(await api.reserve(selected.id, selected.revision)).toEqual(reserved);
  });
  it('rejection releases the complete reservation and retains its reason and historical certificate', async () => {
    const api = createMockTransfersApi();
    const selected = await preparation(api);
    const reserved = await api.reserve(selected.id, selected.revision);
    const rejected = await api.reject(reserved.id, reserved.revision, 'Sin necesidad pendiente DEMO');
    expect(rejected.status).toBe('rejected');
    expect(rejected.certificateUnits).toHaveLength(2);
    expect(
      (await createMockInventoryApi().list()).units
        .filter((unit) => selected.preparation.unitIds.includes(unit.id))
        .every((unit) => unit.status === 'APTO'),
    ).toBe(true);
    expect((await api.list()).bookEntries).toHaveLength(0);
  });
  it('keeps a stale revision from overwriting another preparer and never reserves partial quantities', async () => {
    const api = createMockTransfersApi();
    const selected = await preparation(api);
    await expect(api.savePreparation(selected.id, selected.revision - 1, selected.preparation)).rejects.toThrow(
      'TRANSFER_CONFLICT',
    );
    const partial = await api.savePreparation(selected.id, selected.revision, {
      ...selected.preparation,
      unitIds: selected.preparation.unitIds.slice(0, 1),
    });
    await expect(api.reserve(partial.id, partial.revision)).rejects.toThrow('INVALID_TRANSFER_PREPARATION');
    expect((await createMockInventoryApi().list()).units.some((unit) => unit.status === 'Por transferir')).toBe(false);
  });

  it('never reuses an issued certificate number after releasing a rejected request', async () => {
    const api = createMockTransfersApi();
    const selected = await preparation(api);
    const first = await api.reserve(selected.id, selected.revision);
    await api.reject(first.id, first.revision, 'Cancelación DEMO');
    const other = (await api.list()).requests[1];
    const next = await api.savePreparation(other.id, other.revision, {
      ...selected.preparation,
      unitIds: selected.preparation.unitIds.slice(0, 1),
    });
    await expect(api.reserve(next.id, next.revision)).rejects.toThrow('TRANSFER_OFFICE_DUPLICATE');
  });
  it('does not invent eligibility for reactive, expired or unknown collection dates', async () => {
    const api = createMockTransfersApi();
    const selected = await preparation(api);
    const unit = (await api.list()).units.find((item) => item.id === selected.preparation.unitIds[0]);
    if (!unit) throw new Error('TEST_FIXTURE_MISSING');
    expect(candidateForRequest({ ...unit, screeningResult: 'reactive' }, selected)).toBe(false);
    expect(candidateForRequest({ ...unit, collectedOn: '' }, selected)).toBe(false);
    expect(candidateForRequest({ ...unit, collectedOn: '2026-10-01' }, selected)).toBe(false);
  });
  it('records pickup details without removing stock or adding logbook entries', async () => {
    const request = await delivery();
    expect(request.status).toBe('prepared');
    expect(request.pickupRecordedAt).toBe(new Date().toISOString());
    expect(request.deliveredAt).toBeNull();
    expect((await createMockTransfersApi().list()).bookEntries).toHaveLength(0);
    expect(
      (await createMockInventoryApi().list()).units.filter((unit) => request.preparation.unitIds.includes(unit.id)),
    ).toHaveLength(2);
  });
  it('goes directly from prepared to delivered, removing stock and writing one transfer entry per unit exactly once', async () => {
    const api = createMockTransfersApi();
    const ready = await delivery(api);
    const completed = await api.deliver(ready.id, ready.revision);
    expect(completed.status).toBe('delivered');
    expect(completed.deliveredAt).toBe(new Date().toISOString());
    expect(
      (await createMockInventoryApi().list()).units.some((unit) => completed.preparation.unitIds.includes(unit.id)),
    ).toBe(false);
    const entries = (await api.list()).bookEntries;
    expect(entries).toHaveLength(2);
    expect(
      entries.every(
        (entry) => entry.kind === 'transfer' && entry.patientHistory === completed.data.patientHistory && !!entry.seal,
      ),
    ).toBe(true);
    expect(entries[0]).not.toHaveProperty('hemoglobin');
    expect(entries[0]).not.toHaveProperty('transfusionAt');
    expect(await api.deliver(ready.id, ready.revision)).toEqual(completed);
    expect((await createMockTransfersApi().list()).bookEntries).toHaveLength(2);
    await expect(api.reject(completed.id, completed.revision, 'Rechazo posterior')).rejects.toThrow(
      'TRANSFER_CONFLICT',
    );
  });
  it('revalidates expiry at pickup without releasing stock or creating partial entries', async () => {
    const api = createMockTransfersApi();
    const ready = await delivery(api);
    vi.setSystemTime(new Date('2026-11-01T12:00:00Z'));
    const before = sessionStorage.getItem(processingStorageKey);
    await expect(api.deliver(ready.id, ready.revision)).rejects.toThrow('TRANSFER_STOCK_CONFLICT');
    expect(sessionStorage.getItem(processingStorageKey)).toBe(before);
    expect((await api.list()).bookEntries).toHaveLength(0);
  });
  it('retains both stock and logbook when the atomic storage write fails', async () => {
    const request = await delivery();
    const before = sessionStorage.getItem(processingStorageKey);
    const api = createMockTransfersApi(() => ({
      getItem: (key) => sessionStorage.getItem(key),
      setItem: () => {
        throw new Error('Storage unavailable');
      },
    }));
    await expect(api.deliver(request.id, request.revision)).rejects.toThrow('Storage unavailable');
    expect(sessionStorage.getItem(processingStorageKey)).toBe(before);
    expect((await createMockTransfersApi().list()).bookEntries).toHaveLength(0);
  });
  it('does not accept incomplete handover data or overwrite canonical request data through a preparation', async () => {
    const api = createMockTransfersApi();
    const selected = await preparation(api);
    const reserved = await api.reserve(selected.id, selected.revision);
    await expect(api.deliver(reserved.id, reserved.revision)).rejects.toThrow('INVALID_TRANSFER_DELIVERY');
    const before = readProcessingState(() => sessionStorage);
    writeProcessingState(() => sessionStorage, before);
    expect((await api.list()).requests.find((item) => item.id === reserved.id)?.data).toEqual(reserved.data);
  });
  it('keeps live adapters disabled and exposes the proposed reception contract', async () => {
    expect(transferEndpoints.requests).toBe('/ws/rest/v1/bloodbank/transfer-requests');
    await expect(openmrsTransfersApi.list()).rejects.toThrow('TRANSFER_BACKEND_NOT_IMPLEMENTED');
    await expect(openmrsTransfersApi.saveRequest(newTransferRequest(), true)).rejects.toThrow(
      'TRANSFER_BACKEND_NOT_IMPLEMENTED',
    );
    await expect(openmrsTransfersApi.deliver('uuid', 1)).rejects.toThrow('TRANSFER_BACKEND_NOT_IMPLEMENTED');
  });
});
