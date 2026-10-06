import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { canSeal } from '../sections/inventory/inventory-rules';
import {
  disposalOperation,
  sealOperation,
  seedInventoryReadyUnits,
} from '../sections/inventory/inventory-test-fixtures';
import { reviewBatch } from '../sections/laboratory/fractionation/fractionation-test-fixtures';
import { createMockFractionationApi, fractionationStore } from './mock-fractionation.api';
import { createMockInventoryApi } from './mock-inventory.api';
import { mockBloodBankApi } from './mock-blood-bank.api';
import { processingStorageKey, readProcessingState, writeProcessingState } from './mock-processing-store';
import { openmrsInventoryApi } from './inventory.api';
import { withInventoryFixtures } from '../mocks/inventory.mock';

describe('mock inventory state transitions and retained traceability', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-06T12:00:00'));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    sessionStorage.clear();
  });
  const api = () => createMockInventoryApi();
  const ready = async () => {
    seedInventoryReadyUnits();
    return (await api().list()).units.filter((unit) => unit.id.startsWith('PFC-'));
  };
  it('adds the inventory projection without writing or resetting previous processing records', async () => {
    const state = readProcessingState(() => sessionStorage);
    writeProcessingState(() => sessionStorage, state);
    const before = sessionStorage.getItem(processingStorageKey);
    expect((await api().list()).units).toHaveLength(9);
    expect(sessionStorage.getItem(processingStorageKey)).toBe(before);
    expect(await mockBloodBankApi.getInventory()).toEqual((await api().list()).units);
  });
  it('keeps pending, missing or unrelated screenings ineligible', async () => {
    expect((await api().list()).units.filter((unit) => !unit.id.startsWith('BB-SELLO-DEMO-')).filter(canSeal)).toEqual(
      [],
    );
    const units = await ready();
    expect(units.every(canSeal)).toBe(true);
    const state = readProcessingState(() => sessionStorage);
    const panel = state.screenings.find((item) => item.unitCode === 'ST-DEMO-002');
    if (!panel) throw new Error('TEST_FIXTURE_MISSING');
    panel.origin = { type: 'followUp', followUpId: 'DEMO', subject: 'donor' };
    writeProcessingState(() => sessionStorage, state);
    expect((await api().list()).units.find((unit) => unit.id === units[0].id)?.qualityIssues).toContain(
      'inventoryScreeningPending',
    );
  });
  it.each([
    'reactive',
    'inconclusive',
    '',
  ] as const)('rejects %s panels despite forged aggregate non-reactive results', async (result) => {
    const units = await ready();
    const state = readProcessingState(() => sessionStorage);
    const panel = state.screenings.find((item) => item.unitCode === 'ST-DEMO-002');
    if (!panel) throw new Error('TEST_FIXTURE_MISSING');
    panel.tests.hiv.result = result;
    writeProcessingState(() => sessionStorage, state);
    await expect(api().prepareSeal(sealOperation([units[0]]))).rejects.toThrow('INVENTORY_NOT_ELIGIBLE');
    expect((await api().list()).operations).toHaveLength(0);
  });
  it('requires complete identity, valid expiration and inspection checks', async () => {
    const units = await ready();
    await expect(api().prepareSeal({ ...sealOperation(units), integrityVerified: false })).rejects.toThrow(
      'INVALID_INVENTORY_FIELDS',
    );
    const state = readProcessingState(() => sessionStorage);
    state.fractionation = fractionationStore(state);
    const source = state.fractionation.units.find((item) => item.code === units[0].id);
    if (!source) throw new Error('TEST_FIXTURE_MISSING');
    source.label.expiresAt = '2020-01-01';
    source.label.bloodGroup = '';
    writeProcessingState(() => sessionStorage, state);
    const unit = (await api().list()).units.find((item) => item.id === units[0].id);
    expect(unit?.qualityIssues).toContain('inventoryExpiryInvalid');
    expect(unit?.qualityIssues).toContain('inventoryIdentityIncomplete');
  });
  it('assigns once, requests printing once, and only confirms APTO through explicit confirmation', async () => {
    const units = await ready();
    const instance = api();
    const assigned = await instance.prepareSeal(sealOperation(units));
    expect(assigned.stage).toBe('ready');
    expect(
      (await instance.list()).units.filter((unit) => units.some((item) => item.id === unit.id)).filter(canSeal),
    ).toHaveLength(0);
    await expect(instance.prepareSeal(sealOperation(units))).rejects.toThrow('INVENTORY_NOT_ELIGIBLE');
    await expect(instance.confirmSeal(assigned)).rejects.toThrow('INVENTORY_LOCKED');
    const requested = await instance.requestSealPrint(assigned);
    expect(
      (await instance.list()).units
        .filter((unit) => units.some((item) => item.id === unit.id))
        .every((unit) => unit.status === 'Cuarentena'),
    ).toBe(true);
    await expect(instance.requestSealPrint(requested)).rejects.toThrow('INVENTORY_LOCKED');
    await expect(instance.requestSealPrint(assigned)).rejects.toThrow('INVENTORY_CONFLICT');
    const completed = await instance.confirmSeal(requested);
    expect(completed.outcome).toBe('APTO');
    expect((await mockBloodBankApi.getInventory()).filter((unit) => unit.status === 'APTO')).toHaveLength(2);
    const before = sessionStorage.getItem(processingStorageKey);
    expect(await instance.confirmSeal(requested)).toEqual(completed);
    expect(sessionStorage.getItem(processingStorageKey)).toBe(before);
  });
  it('preserves draft selection and free text; identical draft saves are no-ops', async () => {
    const units = await ready();
    const input = {
      ...disposalOperation(units),
      witnesses: `á<>&${'x'.repeat(2000)}`,
    };
    const saved = await api().saveDraft(input);
    const before = sessionStorage.getItem(processingStorageKey);
    expect(await api().saveDraft(saved)).toEqual(saved);
    expect(sessionStorage.getItem(processingStorageKey)).toBe(before);
    expect((await createMockInventoryApi().list()).operations[0].witnesses).toBe(input.witnesses);
    expect((await api().list()).units).toHaveLength(11);
  });
  it('rejects unknown, duplicate, tampered and stale unit snapshots without any stock change', async () => {
    const units = await ready();
    for (const selected of [
      [],
      [units[0], units[0]],
      [{ ...units[0], id: 'unknown' }],
      [{ ...units[0], bloodGroup: 'O+' }],
    ]) {
      await expect(api().dispose(disposalOperation(selected))).rejects.toThrow();
    }
    expect((await api().list()).operations).toHaveLength(0);
    const draft = await api().saveDraft(disposalOperation(units));
    await api().saveDraft({ ...draft, witnesses: 'Nuevo testigo DEMO' });
    await expect(api().dispose(draft)).rejects.toThrow('INVENTORY_CONFLICT');
  });
  it('requires causes, date, witnesses and signatories before disposing a whole batch atomically', async () => {
    const units = await ready();
    const input = disposalOperation(units);
    for (const invalid of [
      { ...input, causes: {} },
      { ...input, causes: { ...input.causes, [units[0].id]: 'free text outside the BPMN catalog' } },
      { ...input, witnesses: '' },
      { ...input, serviceResponsible: '' },
      { ...input, epidemiologyResponsible: '' },
      { ...input, date: '2026-02-30' },
      { ...input, date: '2027-01-01' },
    ]) {
      await expect(api().dispose(invalid)).rejects.toThrow('INVALID_INVENTORY_FIELDS');
    }
    const completed = await api().dispose(input);
    expect(completed.stage).toBe('completed');
    expect(completed.outcome).toBe('ELIMINADAS');
    expect((await api().list()).units.some((unit) => units.some((item) => item.id === unit.id))).toBe(false);
    expect((await api().list()).operations[0].units.map((unit) => unit.id)).toEqual(units.map((unit) => unit.id));
    const before = sessionStorage.getItem(processingStorageKey);
    expect(await api().dispose({ ...completed, revision: 0 })).toEqual(completed);
    expect(sessionStorage.getItem(processingStorageKey)).toBe(before);
    expect((await mockBloodBankApi.getInventory()).some((unit) => units.some((item) => item.id === unit.id))).toBe(
      false,
    );
  });
  it('prevents disposed or reserved-for-print units from starting fractionation, including stale requests', async () => {
    const units = await ready();
    await api().dispose(disposalOperation([units[0]]));
    await api().prepareSeal(sealOperation([units[1]]));
    expect(
      (await createMockFractionationApi().list()).units.some((unit) => units.some((item) => item.id === unit.id)),
    ).toBe(false);
    for (const unit of units)
      await expect(createMockFractionationApi().start([unit.id])).rejects.toThrow('FRACTIONATION_INVALID_SELECTION');
  });
  it('does not seal or dispose units already in the fractionation laboratory', async () => {
    const units = await ready();
    await createMockFractionationApi().start([units[0].id]);
    const lab = (await api().list()).units.find((unit) => unit.id === units[0].id);
    if (!lab) throw new Error('TEST_FIXTURE_MISSING');
    expect(lab.canDispose).toBe(false);
    await expect(api().dispose(disposalOperation([lab]))).rejects.toThrow('INVENTORY_NOT_ELIGIBLE');
    await expect(api().prepareSeal(sealOperation([lab]))).rejects.toThrow('INVENTORY_NOT_ELIGIBLE');
  });
  it('retains seals and the act if a sealed unit is subsequently disposed', async () => {
    const units = await ready();
    const requested = await api().requestSealPrint(await api().prepareSeal(sealOperation([units[0]])));
    await api().confirmSeal(requested);
    const unit = (await api().list()).units.find((item) => item.id === units[0].id);
    if (!unit) throw new Error('TEST_FIXTURE_MISSING');
    await api().dispose(disposalOperation([unit]));
    expect((await api().list()).operations.map((op) => op.outcome)).toEqual(['APTO', 'ELIMINADAS']);
  });
  it('allows final sealed plasma to be fractionated; new children stay in quarantine without inherited seals', async () => {
    const units = await ready();
    await api().confirmSeal(await api().requestSealPrint(await api().prepareSeal(sealOperation([units[0]]))));
    const fractionation = createMockFractionationApi();
    let batch = await fractionation.start([units[0].id]);
    expect((await api().list()).units.find((item) => item.id === units[0].id)?.status).toBe('En laboratorio');
    batch = await reviewBatch(fractionation, batch);
    await fractionation.finalize(batch);
    const children = (await api().list()).units.filter((unit) => unit.id.startsWith(`${units[0].id}-`));
    expect(children).toHaveLength(2);
    expect(children.every((unit) => unit.status === 'Cuarentena' && !unit.sealId && !unit.qualityIssues.length)).toBe(
      true,
    );
  });
  it('failed storage writes cannot leave partial seals or stock exits', async () => {
    const units = await ready();
    const before = sessionStorage.getItem(processingStorageKey);
    const bad = createMockInventoryApi(() => ({
      getItem: (key) => sessionStorage.getItem(key),
      setItem: () => {
        throw new Error('STORAGE_FULL');
      },
    }));
    await expect(bad.dispose(disposalOperation(units))).rejects.toThrow('STORAGE_FULL');
    await expect(bad.prepareSeal(sealOperation(units))).rejects.toThrow('STORAGE_FULL');
    expect(sessionStorage.getItem(processingStorageKey)).toBe(before);
  });
  it('real adapters fail closed without making any write requests', async () => {
    for (const action of Object.values(openmrsInventoryApi))
      await expect(action({} as never)).rejects.toThrow('BACKEND_NOT_IMPLEMENTED');
  });
  it('adds three validated non-reactive and two reactive demo units, but rejects seals for reactive units', async () => {
    const units = (await api().list()).units.filter((unit) => unit.id.startsWith('BB-SELLO-DEMO-'));
    const nonReactive = units.filter((unit) => unit.screeningResult === 'nonReactive');
    const reactive = units.filter((unit) => unit.screeningResult === 'reactive');
    expect(nonReactive).toHaveLength(3);
    expect(nonReactive.every(canSeal)).toBe(true);
    expect(reactive).toHaveLength(2);
    expect(reactive.every((unit) => !canSeal(unit))).toBe(true);
    for (const unit of reactive)
      await expect(api().prepareSeal(sealOperation([unit]))).rejects.toThrow('INVENTORY_NOT_ELIGIBLE');
    expect(sessionStorage.getItem(processingStorageKey)).toBeNull();
  });
  it('never replaces existing panel results, expiry or other workflows when adding demo stock', async () => {
    const state = withInventoryFixtures(readProcessingState(() => sessionStorage));
    state.screenings[2].tests.hiv.result = 'reactive';
    const unit = state.fractionation?.units.find((unit) => unit.code === 'BB-SELLO-DEMO-001');
    if (!unit) throw new Error('TEST_FIXTURE_MISSING');
    unit.label.expiresAt = '2020-01-01';
    const snapshot = structuredClone(state);
    expect(withInventoryFixtures(state)).toEqual(snapshot);
    expect(state).toEqual(snapshot);
    writeProcessingState(() => sessionStorage, state);
    const before = sessionStorage.getItem(processingStorageKey);
    const current = (await api().list()).units.find((unit) => unit.id === 'BB-SELLO-DEMO-001');
    expect(current?.screeningResult).toBe('reactive');
    expect(current?.qualityIssues).toContain('inventoryExpiryInvalid');
    expect(sessionStorage.getItem(processingStorageKey)).toBe(before);
  });
  it('keeps removed and fractionated demo stock out of inventory across fresh API instances', async () => {
    const units = (await api().list()).units.filter((unit) => unit.id.startsWith('BB-SELLO-DEMO-'));
    await api().dispose(disposalOperation([units[0]]));
    const state = readProcessingState(() => sessionStorage);
    const source = state.fractionation?.units.find((unit) => unit.code === units[1].id);
    if (!source) throw new Error('TEST_FIXTURE_MISSING');
    source.state = 'fractionated';
    writeProcessingState(() => sessionStorage, state);
    const current = (await createMockInventoryApi().list()).units;
    expect(current.some((unit) => unit.id === units[0].id || unit.id === units[1].id)).toBe(false);
  });
});
