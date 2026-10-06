import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockBloodBankApi } from './mock-blood-bank.api';
import { createMockFractionationApi, fractionationInventory, fractionationStore } from './mock-fractionation.api';
import { openmrsFractionationApi } from './fractionation.api';
import { processingStorageKey, readProcessingState, writeProcessingState } from './mock-processing-store';
import {
  finalNodes,
  positiveVolume,
  splitNode,
  validateFractionation,
  validTree,
} from '../sections/laboratory/fractionation/fractionation-rules';
import {
  labeledBatch,
  plannedBatch,
  reviewBatch,
} from '../sections/laboratory/fractionation/fractionation-test-fixtures';

describe('atomic synthetic fractionation and inventory', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });
  const api = () => createMockFractionationApi();
  it('adds fractionation sources without resetting old collections, screenings or drafts', async () => {
    const state = readProcessingState(() => sessionStorage);
    writeProcessingState(() => sessionStorage, state);
    const before = sessionStorage.getItem(processingStorageKey);
    expect((await api().list()).units.filter((unit) => unit.component === 'freshFrozenPlasma')).toHaveLength(2);
    expect(sessionStorage.getItem(processingStorageKey)).toBe(before); // Reads do not write.
    await api().start(['PFC-2026-002']);
    const after = readProcessingState(() => sessionStorage);
    expect(after.collections).toEqual(state.collections);
    expect(after.screenings).toEqual(state.screenings);
    expect(after.apheresisDraft).toEqual(state.apheresisDraft);
  });
  it('rejects mixed, unknown, empty and duplicate sources without starting a process', async () => {
    const instance = api();
    const whole = (await instance.list()).units.find((unit) => unit.component === 'wholeBlood');
    expect(whole).toBeDefined();
    for (const ids of [[], ['unknown'], ['PFC-2026-002', 'PFC-2026-002'], ['PFC-2026-002', whole?.id ?? '']]) {
      await expect(instance.start(ids)).rejects.toThrow('FRACTIONATION_INVALID_SELECTION');
      expect((await instance.list()).batches).toHaveLength(0);
    }
  });
  it('locks a homogeneous batch in laboratory and prevents overlapping selection', async () => {
    const instance = api();
    const batch = await instance.start(['PFC-2026-002', 'PFC-2026-003']);
    expect(batch.sources).toHaveLength(2);
    expect((await mockBloodBankApi.getInventory()).filter((unit) => unit.status === 'En laboratorio')).toHaveLength(2);
    await expect(instance.start(['PFC-2026-002'])).rejects.toThrow('FRACTIONATION_INVALID_SELECTION');
  });
  it('keeps separate trees, parent genealogy and final children in quarantine, with idempotent completion', async () => {
    const instance = api();
    const batch = await reviewBatch(instance, await instance.start(['PFC-2026-002', 'PFC-2026-003']));
    const finalized = await instance.finalize(batch);
    expect(finalized.status).toBe('completed');
    const workspace = await instance.list();
    expect(workspace.units.filter((unit) => unit.state === 'fractionated')).toHaveLength(2);
    const children = workspace.units.filter((unit) => unit.batchId === batch.id && unit.parentId);
    expect(children).toHaveLength(4);
    for (const child of children) {
      expect(child.state).toBe('quarantine');
      expect(child.code.startsWith(child.parentId ?? 'missing')).toBe(true);
      expect(child.originalWholeBloodCode).toMatch(/^ST-DEMO/);
    }
    const stock = await mockBloodBankApi.getInventory();
    expect(stock.some((unit) => ['PFC-2026-002', 'PFC-2026-003'].includes(unit.id))).toBe(false);
    expect(
      stock
        .filter((unit) => children.some((child) => child.code === unit.id))
        .every((unit) => unit.status === 'Cuarentena'),
    ).toBe(true);
    const before = sessionStorage.getItem(processingStorageKey);
    expect(await instance.finalize(batch)).toEqual(finalized);
    expect(sessionStorage.getItem(processingStorageKey)).toBe(before);
  });
  it('preserves PRP as a final component with required labels, volume and quarantine inventory', async () => {
    const instance = api();
    const source = (await instance.list()).units.find((unit) => unit.component === 'wholeBlood');
    if (!source) throw new Error('SYNTHETIC_UNIT_MISSING');
    let batch = plannedBatch(await instance.start([source.id]));
    const prp = batch.nodes.find((node) => node.component === 'plateletRichPlasma');
    if (!prp) throw new Error('SYNTHETIC_PRP_MISSING');
    batch = splitNode(batch, prp.id, null);
    expect(validateFractionation(batch, 'fractionationPlan')).toEqual([]);
    batch = await instance.save(batch, 'fractionationPlan');
    batch = labeledBatch(batch);
    expect(validateFractionation(batch, 'fractionationLabels')).toContain('fractionationLabelsRequired');
    await expect(instance.save(batch, 'fractionationLabels')).rejects.toThrow('INVALID_FRACTIONATION_STEP');
    const finalPrp = finalNodes(batch).find((node) => node.component === 'plateletRichPlasma');
    if (!finalPrp) throw new Error('SYNTHETIC_PRP_MISSING');
    // Explicit synthetic input, not a clinical storage default for PRP.
    finalPrp.label.storageTemperature = 'Temperatura DEMO';
    batch = await instance.save(batch, 'fractionationLabels');
    expect(validateFractionation(batch, 'fractionationVolumes')).toContain('fractionationVolumesRequired');
    for (const node of finalNodes(batch)) node.volume = node.estimatedVolume;
    batch = await instance.save(batch, 'fractionationVolumes');
    batch.finalChecks = true;
    const completed = await instance.finalize(batch);
    expect(finalNodes(completed).map((node) => node.component)).toEqual(['redCells', 'plateletRichPlasma']);
    const storedPrp = (await instance.list()).units.find((unit) => unit.code === finalPrp.code);
    expect(storedPrp).toMatchObject({
      component: 'plateletRichPlasma',
      state: 'quarantine',
      parentId: source.id,
      volume: '100',
      originalWholeBloodCode: source.originalWholeBloodCode,
    });
    const stock = await mockBloodBankApi.getInventory();
    expect(stock.find((unit) => unit.id === finalPrp.code)).toMatchObject({ status: 'Cuarentena' });
    expect(stock.some((unit) => unit.id === source.code)).toBe(false);
  });
  it('saves partial progress, reloads it, and performs no write or revision bump for unchanged drafts', async () => {
    const instance = api();
    const initial = await instance.start(['PFC-2026-002']);
    const input = plannedBatch(initial);
    input.observations = 'Observación DEMO '.repeat(100);
    const saved = await instance.save(input);
    expect((await api().list()).batches[0]).toEqual(saved);
    const before = sessionStorage.getItem(processingStorageKey);
    expect(await instance.save(saved)).toEqual(saved);
    expect(sessionStorage.getItem(processingStorageKey)).toBe(before);
    await expect(instance.save(initial)).rejects.toThrow('FRACTIONATION_CONFLICT');
  });
  it('does not accept client-supplied completion steps, identities or untracked branches', async () => {
    const instance = api();
    const batch = await instance.start(['PFC-2026-002']);
    batch.completedSteps = ['fractionationPlan', 'fractionationLabels', 'fractionationVolumes'];
    await expect(instance.finalize(batch)).rejects.toThrow('INVALID_FRACTIONATION_STEP');
    batch.sources[0].volume = '999';
    await expect(instance.save(batch)).rejects.toThrow('FRACTIONATION_IDENTITY_CONFLICT');
    const original = (await instance.list()).batches[0];
    original.nodes.push({ ...original.nodes[0], id: 'rogue', parentId: original.nodes[0].id });
    await expect(instance.save(original)).rejects.toThrow('INVALID_FRACTIONATION_TREE');
  });
  it('requires ordered stages, verified labels and final physical review', async () => {
    const instance = api();
    let batch = await instance.start(['PFC-2026-002']);
    batch = plannedBatch(batch);
    await expect(instance.save(batch, 'fractionationLabels')).rejects.toThrow('INVALID_FRACTIONATION_STEP');
    batch = await instance.save(batch, 'fractionationPlan');
    batch = labeledBatch(batch);
    batch.labelsVerified = false;
    await expect(instance.save(batch, 'fractionationLabels')).rejects.toThrow('INVALID_FRACTIONATION_STEP');
    batch.labelsVerified = true;
    batch = await instance.save(batch, 'fractionationLabels');
    for (const node of finalNodes(batch)) node.volume = node.estimatedVolume;
    batch = await instance.save(batch, 'fractionationVolumes');
    await expect(instance.finalize(batch)).rejects.toThrow('INVALID_FRACTIONATION_STEP');
  });
  it('invalidates subsequent stages after a changed division and rejects stale bag data', async () => {
    const instance = api();
    const initial = await instance.start(['PFC-2026-002']);
    const ready = await reviewBatch(instance, initial);
    const cleared = await instance.save(splitNode(ready, ready.nodes[0].id, null));
    expect(cleared.completedSteps).toEqual([]);
    expect(cleared.labelsVerified).toBe(false);
    await expect(instance.finalize(ready)).rejects.toThrow('FRACTIONATION_CONFLICT');
  });
  it('rejects invalid volumes and volume creation independently for every source', async () => {
    const instance = api();
    let batch = await instance.start(['PFC-2026-002', 'PFC-2026-003']);
    batch = await instance.save(plannedBatch(batch), 'fractionationPlan');
    batch = await instance.save(labeledBatch(batch), 'fractionationLabels');
    for (const node of finalNodes(batch)) node.volume = node.sourceId === 'PFC-2026-002' ? '200' : '1';
    await expect(instance.save(batch, 'fractionationVolumes')).rejects.toThrow('INVALID_FRACTIONATION_STEP');
    expect(validateFractionation(batch, 'fractionationVolumes')).toContain('fractionationVolumeExceeded');
    finalNodes(batch)[0].volume = '-2';
    expect(validateFractionation(batch, 'fractionationVolumes')).toContain('fractionationVolumesRequired');
  });
  it('does not release units or change screening outcomes when fractionation completes', async () => {
    const instance = api();
    const before = readProcessingState(() => sessionStorage).screenings;
    const batch = await reviewBatch(instance, await instance.start(['PFC-2026-002']));
    await instance.finalize(batch);
    expect(readProcessingState(() => sessionStorage).screenings).toEqual(before);
    const stock = fractionationInventory(readProcessingState(() => sessionStorage));
    expect(stock.every((unit) => unit.status === 'Cuarentena')).toBe(true);
  });
  it('cannot leave parent exits without child entries when storage fails', async () => {
    const instance = api();
    const batch = await reviewBatch(instance, await instance.start(['PFC-2026-002']));
    const before = sessionStorage.getItem(processingStorageKey);
    const failing = createMockFractionationApi(() => ({
      getItem: (key) => sessionStorage.getItem(key),
      setItem: () => {
        throw new Error('storage full');
      },
    }));
    await expect(failing.finalize(batch)).rejects.toThrow('storage full');
    expect(sessionStorage.getItem(processingStorageKey)).toBe(before);
    expect((await instance.list()).units.find((unit) => unit.id === 'PFC-2026-002')?.state).toBe('inLaboratory');
  });
  it('rejects expired PFC before locking inventory', async () => {
    const state = readProcessingState(() => sessionStorage);
    state.fractionation = fractionationStore(state);
    const unit = state.fractionation.units.find((item) => item.id === 'PFC-2026-002');
    if (!unit) throw new Error('SYNTHETIC_UNIT_MISSING');
    unit.label.expiresAt = '2000-01-01T12:00';
    writeProcessingState(() => sessionStorage, state);
    await expect(api().start([unit.id])).rejects.toThrow('FRACTIONATION_INVALID_SELECTION');
    expect((await api().list()).batches).toHaveLength(0);
  });
  it('fails safely on corrupted stored trees without silently resetting processing data', async () => {
    await api().start(['PFC-2026-002']);
    const state = readProcessingState(() => sessionStorage);
    if (!state.fractionation) throw new Error('SYNTHETIC_BATCH_MISSING');
    state.fractionation.batches[0].nodes[0].id = 'corrupt';
    writeProcessingState(() => sessionStorage, state);
    const before = sessionStorage.getItem(processingStorageKey);
    await expect(api().list()).rejects.toThrow('INVALID_FRACTIONATION_STORAGE');
    expect(sessionStorage.getItem(processingStorageKey)).toBe(before);
  });
  it('uses decimal-safe per-source balances rather than floating-point equality', async () => {
    const state = readProcessingState(() => sessionStorage);
    state.fractionation = fractionationStore(state);
    const unit = state.fractionation.units.find((item) => item.id === 'PFC-2026-002');
    if (!unit) throw new Error('SYNTHETIC_UNIT_MISSING');
    unit.volume = '0.30';
    writeProcessingState(() => sessionStorage, state);
    const instance = api();
    let batch = await instance.save(plannedBatch(await instance.start([unit.id])), 'fractionationPlan');
    batch = labeledBatch(batch);
    const leaves = finalNodes(batch);
    leaves[0].estimatedVolume = '0.10';
    leaves[1].estimatedVolume = '0.20';
    batch = await instance.save(batch, 'fractionationLabels');
    for (const node of finalNodes(batch)) node.volume = node.estimatedVolume;
    batch = await instance.save(batch, 'fractionationVolumes');
    batch.finalChecks = true;
    expect((await instance.finalize(batch)).status).toBe('completed');
  });
  it('fails closed without backend capability and without issuing network requests', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    await expect(openmrsFractionationApi.list()).rejects.toThrow('BACKEND_NOT_IMPLEMENTED');
    await expect(openmrsFractionationApi.start(['PFC'])).rejects.toThrow('BACKEND_NOT_IMPLEMENTED');
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('fractionation tree and quality boundaries', () => {
  beforeEach(() => sessionStorage.clear());
  it.each(['', '0', '-1', '1e3', 'NaN', '12.345', '9999999', '1,5'])('rejects invalid mL input %s', (value) =>
    expect(positiveVolume(value)).toBe(false));
  it('supports whole blood → RBC / PRP → platelets / PFC → cryo / reduced plasma, without industrial derivatives', async () => {
    const instance = createMockFractionationApi();
    const unit = (await instance.list()).units.find((source) => source.component === 'wholeBlood');
    expect(unit).toBeDefined();
    let batch = plannedBatch(await instance.start([unit?.id ?? '']));
    const pfc = batch.nodes.find((node) => node.component === 'freshFrozenPlasma');
    batch = splitNode(batch, pfc?.id ?? '', 0);
    expect(validTree(batch)).toBe(true);
    expect(finalNodes(batch).map((node) => node.component)).toEqual([
      'redCells',
      'platelets',
      'cryoprecipitate',
      'cryoReducedPlasma',
    ]);
    expect(() => splitNode(batch, batch.nodes[0].id, 9)).toThrow('INVALID_FRACTIONATION_TREE');
  });
  it('requires source separation but allows final PRP and keeps optional PFC / plasma24 branches exclusive', async () => {
    const instance = createMockFractionationApi();
    const unit = (await instance.list()).units.find((source) => source.component === 'wholeBlood');
    let batch = await instance.start([unit?.id ?? '']);
    expect(validateFractionation(batch, 'fractionationPlan')).toContain('fractionationFinishBranches');
    batch = splitNode(batch, batch.nodes[0].id, 0);
    expect(validateFractionation(batch, 'fractionationPlan')).not.toContain('fractionationFinishBranches');
    const prp = batch.nodes.find((node) => node.component === 'plateletRichPlasma');
    batch = splitNode(batch, prp?.id ?? '', 1);
    expect(finalNodes(batch).some((node) => node.component === 'plasma24')).toBe(true);
    expect(batch.nodes.some((node) => node.component === 'freshFrozenPlasma')).toBe(false);
    batch = splitNode(batch, prp?.id ?? '', 0);
    expect(finalNodes(batch).some((node) => node.component === 'freshFrozenPlasma')).toBe(true);
    expect(batch.nodes.some((node) => node.component === 'plasma24')).toBe(false);
  });
  it('blocks the general multi-component path for low-volume collection in a 450 mL bag', async () => {
    const instance = createMockFractionationApi();
    const unit = (await instance.list()).units.find((source) => source.component === 'wholeBlood');
    const batch = plannedBatch(await instance.start([unit?.id ?? '']));
    batch.sources[0].volume = '350';
    expect(validateFractionation(batch, 'fractionationPlan')).toContain('fractionationLowVolume');
  });
});
