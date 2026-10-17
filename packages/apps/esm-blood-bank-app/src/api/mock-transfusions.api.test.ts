import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { disposalOperation } from '../sections/inventory/inventory-test-fixtures';
import { localDateTime } from '../sections/laboratory/screening/screening-rules';
import type { TransfusionRequest } from '../sections/transfusions/transfusions.types';
import { withInventoryFixtures } from '../mocks/inventory.mock';
import {
  comparePriority,
  transfusionCandidate,
  transfusionLocalDay,
} from '../sections/transfusions/transfusions-rules';
import { createMockFractionationApi } from './mock-fractionation.api';
import { createMockInventoryApi } from './mock-inventory.api';
import { processingStorageKey, readProcessingState, writeProcessingState } from './mock-processing-store';
import { createMockTransfersApi } from './mock-transfers.api';
import { createMockTransfusionsApi } from './mock-transfusions.api';
import { openmrsTransfusionsApi } from './transfusions.api';

const unitCode = (number: number) => `BB-TX-DEMO-${String(number).padStart(3, '0')}`;
async function readyStock() {
  const api = createMockInventoryApi();
  const units = (await api.list()).units.filter((unit) => unit.id.startsWith('BB-TX-DEMO-'));
  expect(units).toHaveLength(20);
  expect(units.every((unit) => unit.status === 'APTO' && !!unit.sealId)).toBe(true);
}
async function sampled(number = 1, api = createMockTransfusionsApi()) {
  const request = (await api.list()).requests[number - 1];
  const reviewed = await api.review(request.id, request.revision, {
    ...request.draft,
    reviewer: 'Responsable DEMO',
    reviewVerified: true,
    consentVerified: true,
  });
  return api.saveSample(reviewed.id, reviewed.revision, {
    ...reviewed.draft.sample,
    collectedAt: localDateTime(),
    collectedBy: 'Extracción DEMO',
    identityVerified: true,
  });
}
async function assigned(api = createMockTransfusionsApi()) {
  await readyStock();
  const request = await sampled(1, api);
  return api.assign(request.id, request.revision, [unitCode(1), unitCode(2), unitCode(11)], true);
}
async function results(request: TransfusionRequest, incompatible = false, api = createMockTransfusionsApi()) {
  const round = request.rounds.at(-1);
  if (!round) throw new Error('MISSING_FIXTURE');
  return api.saveCompatibility(
    request.id,
    request.revision,
    {
      ...round,
      operator: 'Laboratorio DEMO',
      identityVerified: true,
      pretransfusionVerified: true,
      results: Object.fromEntries(
        Object.keys(round.results).map((id, index) => [
          id,
          incompatible && index === 1 ? 'incompatible' : 'compatible',
        ]),
      ),
    },
    true,
  );
}
const pickup = (request: TransfusionRequest) => ({
  ...request.draft,
  collectorName: 'Recepción DEMO',
  collectorDocument: '90000999',
  deliveredBy: 'Entrega DEMO',
  releaseVerified: true,
});

describe('regular transfusion attention and compatibility shared stock', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-16T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    sessionStorage.clear();
  });
  it('loads synthetic orders and 20 pre-approved stock units with unique seals without writing on reads', async () => {
    const before = sessionStorage.getItem(processingStorageKey);
    const data = await createMockTransfusionsApi().list();
    const stock = data.units.filter((unit) => unit.id.startsWith('BB-TX-DEMO-'));
    expect(stock).toHaveLength(20);
    expect(new Set(stock.map((unit) => unit.componentType)).size).toBe(5);
    expect(
      stock.every(
        (unit) =>
          unit.status === 'APTO' &&
          unit.screeningResult === 'nonReactive' &&
          !!unit.sealId &&
          !unit.qualityIssues.length,
      ),
    ).toBe(true);
    expect(new Set(stock.map((unit) => unit.sealId)).size).toBe(20);
    expect((await createMockInventoryApi().list()).operations).toEqual([]);
    expect(data.requests).toHaveLength(4);
    expect(sessionStorage.getItem(processingStorageKey)).toBe(before);
  });
  it('orders priority first then oldest request and blocks urgent pathways at the adapter', async () => {
    expect(
      [
        { priority: 'scheduled' as const, date: '2026-01-01' },
        { priority: 'urgent' as const, date: '2026-02-01' },
      ].sort(comparePriority)[0].priority,
    ).toBe('urgent');
    expect(
      comparePriority({ priority: 'scheduled', date: '2026-01-01' }, { priority: 'scheduled', date: '2026-01-02' }),
    ).toBeLessThan(0);
    const api = createMockTransfusionsApi();
    const request = (await api.list()).requests[3];
    await expect(
      api.review(request.id, request.revision, {
        ...request.draft,
        reviewVerified: true,
        consentVerified: true,
        reviewer: 'DEMO',
      }),
    ).rejects.toThrow('TRANSFUSION_CONFLICT');
  });
  it('filters UTC timestamps by the displayed local calendar day, including evening handovers', () => {
    vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(300);
    expect(transfusionLocalDay('2026-10-17T02:30:00Z')).toBe('2026-10-16');
    expect(transfusionLocalDay('2026-10-17T05:00:00Z')).toBe('2026-10-17');
    expect(transfusionLocalDay('invalid')).toBe('');
  });
  it('saves only a sample draft on exit; review and Continue create the canonical sample separately', async () => {
    const api = createMockTransfusionsApi();
    const request = (await api.list()).requests[0];
    const draft = await api.saveDraft(request.id, request.revision, {
      ...request.draft,
      sample: { ...request.draft.sample, collectedBy: 'Borrador DEMO' },
    });
    expect(draft.sample).toBeNull();
    expect(draft.status).toBe('pending');
    expect(await api.saveDraft(draft.id, draft.revision, draft.draft)).toEqual(draft);
    await expect(api.saveSample(draft.id, draft.revision, draft.draft.sample)).rejects.toThrow('TRANSFUSION_CONFLICT');
    const reviewed = await api.review(draft.id, draft.revision, {
      ...draft.draft,
      reviewer: 'DEMO',
      reviewVerified: true,
      consentVerified: true,
    });
    await expect(
      api.saveSample(reviewed.id, reviewed.revision, {
        ...reviewed.draft.sample,
        code: 'MANUAL',
        identityVerified: true,
      }),
    ).rejects.toThrow('INVALID_RECIPIENT_SAMPLE');
    const saved = await api.saveSample(reviewed.id, reviewed.revision, {
      ...reviewed.draft.sample,
      identityVerified: true,
    });
    expect(saved.sample?.collectedBy).toBe('Borrador DEMO');
    expect(saved.status).toBe('sampleReady');
    expect((await api.list()).requests[0].sample).toEqual(saved.sample);
  });
  it('rejects incomplete review, wrong HC and future collection time without overwriting canonical data', async () => {
    const api = createMockTransfusionsApi();
    const request = (await api.list()).requests[0];
    await expect(api.review(request.id, request.revision, request.draft)).rejects.toThrow('INVALID_TRANSFUSION_REVIEW');
    const reviewed = await api.review(request.id, request.revision, {
      ...request.draft,
      reviewer: 'DEMO',
      reviewVerified: true,
      consentVerified: true,
    });
    for (const patch of [{ historyNumber: 'WRONG' }, { collectedAt: '2027-01-01T12:00' }])
      await expect(
        api.saveSample(reviewed.id, reviewed.revision, {
          ...reviewed.draft.sample,
          collectedBy: 'DEMO',
          identityVerified: true,
          ...patch,
        }),
      ).rejects.toThrow('INVALID_RECIPIENT_SAMPLE');
    expect((await api.list()).requests[0].sample).toBeNull();
  });
  it('requires exact quantities per component and creates only whole-blood/red-cell unit samples', async () => {
    const api = createMockTransfusionsApi();
    await readyStock();
    const request = await sampled(1, api);
    for (const ids of [
      [unitCode(1)],
      [unitCode(1), unitCode(1), unitCode(11)],
      [unitCode(1), unitCode(2), unitCode(3)],
    ])
      await expect(api.assign(request.id, request.revision, ids, true)).rejects.toThrow(
        'INVALID_TRANSFUSION_SELECTION',
      );
    const saved = await api.assign(request.id, request.revision, [unitCode(1), unitCode(2), unitCode(11)], true);
    expect(saved.status).toBe('testing');
    expect(saved.rounds).toHaveLength(1);
    expect(Object.keys(saved.rounds[0].results)).toHaveLength(2);
    expect(saved.assignments.filter((item) => item.unitSampleCode)).toHaveLength(2);
    const units = (await createMockInventoryApi().list()).units;
    expect(units.find((unit) => unit.id === unitCode(1))?.status).toBe('En pruebas de compatibilidad');
    expect(units.find((unit) => unit.id === unitCode(11))?.status).toBe('Reservados para transfusión');
  });
  it('excludes autologous stock, invalid collection dates and expired units from regular selection', async () => {
    await readyStock();
    const api = createMockTransfusionsApi();
    const request = await sampled(1, api);
    const stock = (await api.list()).units.find((unit) => unit.id === unitCode(1));
    if (!stock) throw new Error('MISSING_FIXTURE');
    expect(transfusionCandidate(stock, request)).toBe(true);
    expect(transfusionCandidate({ ...stock, collectedOn: '' }, request)).toBe(false);
    expect(transfusionCandidate({ ...stock, collectedOn: '2027-01-01' }, request)).toBe(false);
    expect(transfusionCandidate({ ...stock, expiresAt: '2026-10-15T12:00' }, request)).toBe(false);
    const state = withInventoryFixtures(readProcessingState(() => sessionStorage));
    const autologous = state.fractionation?.units.find((unit) => unit.code === unitCode(1));
    if (!autologous) throw new Error('MISSING_FIXTURE');
    autologous.label.autologous = true;
    const collection = state.collections.find((item) => item.unitCode === unitCode(2));
    if (!collection) throw new Error('MISSING_FIXTURE');
    collection.application.admission.donationType = 'autologous';
    writeProcessingState(() => sessionStorage, state);
    expect((await api.list()).units.some((unit) => unit.id === unitCode(1))).toBe(false);
    expect((await api.list()).units.some((unit) => unit.id === unitCode(2))).toBe(false);
    await expect(
      api.assign(request.id, request.revision, [unitCode(1), unitCode(2), unitCode(11)], true),
    ).rejects.toThrow('INVALID_TRANSFUSION_SELECTION');
  });
  it('blocks disposal, fractionation and transfers for assigned units', async () => {
    const request = await assigned();
    const inventory = createMockInventoryApi();
    const units = (await inventory.list()).units.filter((unit) =>
      request.assignments.some((item) => item.unit.id === unit.id),
    );
    expect(units.every((unit) => !unit.canDispose)).toBe(true);
    await expect(inventory.dispose(disposalOperation(units))).rejects.toThrow('INVENTORY_NOT_ELIGIBLE');
    expect(
      (await createMockFractionationApi().list()).units.some((unit) => units.some((item) => item.id === unit.id)),
    ).toBe(false);
    expect((await createMockTransfersApi().list()).units.find((unit) => unit.id === unitCode(1))?.status).toBe(
      'En pruebas de compatibilidad',
    );
  });
  it('persists partial laboratory drafts without reserving/releasing and rejects an incomplete final batch', async () => {
    const api = createMockTransfusionsApi();
    const request = await assigned(api);
    const round = request.rounds[0];
    const partial = {
      ...round,
      operator: 'LAB DEMO',
      identityVerified: true,
      pretransfusionVerified: true,
      results: { ...round.results, [unitCode(1)]: 'compatible' as const },
    };
    const saved = await api.saveCompatibility(request.id, request.revision, partial, false);
    expect(saved.status).toBe('testing');
    expect(saved.assignments[0].result).toBe('pending');
    await expect(api.saveCompatibility(saved.id, saved.revision, partial, true)).rejects.toThrow(
      'INCOMPLETE_COMPATIBILITY',
    );
    expect((await createMockInventoryApi().list()).units.find((unit) => unit.id === unitCode(1))?.status).toBe(
      'En pruebas de compatibilidad',
    );
  });
  it('releases only incompatible units, retains compatible allocations and all result history', async () => {
    const request = await results(await assigned(), true);
    expect(request.status).toBe('incompatible');
    expect(request.assignments.find((item) => item.unit.id === unitCode(2))?.active).toBe(false);
    const units = (await createMockInventoryApi().list()).units;
    expect(units.find((unit) => unit.id === unitCode(1))?.status).toBe('Reservados para transfusión');
    expect(units.find((unit) => unit.id === unitCode(2))?.status).toBe('APTO');
    const candidates = (await createMockTransfusionsApi().list()).units;
    expect(transfusionCandidate(candidates.find((unit) => unit.id === unitCode(2)) as never, request)).toBe(false);
    expect(request.rounds[0].completedAt).toBeTruthy();
    expect((await createMockTransfusionsApi().list()).bookEntries).toEqual([]);
  });
  it('adds only replacement samples, excludes previously tested units and preserves approved locked units', async () => {
    const api = createMockTransfusionsApi();
    const request = await results(await assigned(api), true, api);
    await expect(api.assign(request.id, request.revision, [unitCode(2)], true)).rejects.toThrow(
      'INVALID_TRANSFUSION_SELECTION',
    );
    const retry = await api.assign(request.id, request.revision, [unitCode(3)], true);
    expect(retry.rounds).toHaveLength(2);
    expect(Object.keys(retry.rounds[1].results)).toEqual([unitCode(3)]);
    expect(retry.assignments.find((item) => item.unit.id === unitCode(1))?.result).toBe('compatible');
    const approved = await results(retry, false, api);
    expect(approved.status).toBe('compatible');
    expect(approved.assignments.filter((item) => item.active)).toHaveLength(3);
    expect(approved.assignments).toHaveLength(4);
  });
  it('reserves plasma without creating a fictitious crossmatch round', async () => {
    await readyStock();
    const api = createMockTransfusionsApi();
    const request = await sampled(3, api);
    const approved = await api.assign(request.id, request.revision, [unitCode(13)], true);
    expect(approved.status).toBe('compatible');
    expect(approved.rounds).toEqual([]);
    expect(approved.assignments[0].result).toBe('notRequired');
    const delivered = await api.deliver(approved.id, approved.revision, pickup(approved));
    expect(delivered.status).toBe('delivered');
  });
  it('hands over atomically, exits stock, fulfills the requester and writes one FR10 issue per unit only once', async () => {
    const api = createMockTransfusionsApi();
    const request = await results(await assigned(api), false, api);
    await expect(api.deliver(request.id, request.revision, request.draft)).rejects.toThrow(
      'INVALID_TRANSFUSION_DELIVERY',
    );
    const delivered = await api.deliver(request.id, request.revision, pickup(request));
    expect(delivered.requesterStatus).toBe('ATENDIDA');
    expect(delivered.deliveredAt).toBe(new Date().toISOString());
    expect(
      (await createMockInventoryApi().list()).units.some((unit) =>
        request.assignments.some((item) => item.unit.id === unit.id),
      ),
    ).toBe(false);
    const entries = (await api.list()).bookEntries;
    expect(entries).toHaveLength(3);
    expect(entries.every((item) => item.kind === 'transfusionDispatch')).toBe(true);
    expect(entries[0]).not.toHaveProperty('administeredAt');
    expect(await api.deliver(request.id, request.revision, pickup(request))).toEqual(delivered);
    expect((await api.list()).bookEntries).toHaveLength(3);
  });
  it('does not dispatch after sample expiry or overwrite newer revisions', async () => {
    const api = createMockTransfusionsApi();
    const request = await results(await assigned(api), false, api);
    await expect(api.saveDraft(request.id, request.revision - 1, request.draft)).rejects.toThrow(
      'TRANSFUSION_CONFLICT',
    );
    vi.setSystemTime(new Date('2026-10-20T12:00:00Z'));
    const before = sessionStorage.getItem(processingStorageKey);
    await expect(api.deliver(request.id, request.revision, pickup(request))).rejects.toThrow(
      'TRANSFUSION_STOCK_CONFLICT',
    );
    expect(sessionStorage.getItem(processingStorageKey)).toBe(before);
    expect((await api.list()).bookEntries).toEqual([]);
  });
  it('keeps stock and result history unchanged when the shared storage write fails', async () => {
    const request = await assigned();
    const before = sessionStorage.getItem(processingStorageKey);
    const api = createMockTransfusionsApi(() => ({
      getItem: (key) => sessionStorage.getItem(key),
      setItem: () => {
        throw new Error('Storage failed');
      },
    }));
    await expect(results(request, true, api)).rejects.toThrow('Storage failed');
    expect(sessionStorage.getItem(processingStorageKey)).toBe(before);
    expect((await createMockTransfusionsApi().list()).requests[0].status).toBe('testing');
  });
  it('does not rewrite previous workflow data and disables all live operations', async () => {
    const state = readProcessingState(() => sessionStorage);
    writeProcessingState(() => sessionStorage, state);
    const before = sessionStorage.getItem(processingStorageKey);
    await createMockTransfusionsApi().list();
    expect(sessionStorage.getItem(processingStorageKey)).toBe(before);
    await expect(openmrsTransfusionsApi.list()).rejects.toThrow('TRANSFUSION_BACKEND_NOT_IMPLEMENTED');
    await expect(openmrsTransfusionsApi.deliver('uuid', 1, {} as never)).rejects.toThrow(
      'TRANSFUSION_BACKEND_NOT_IMPLEMENTED',
    );
  });
});
