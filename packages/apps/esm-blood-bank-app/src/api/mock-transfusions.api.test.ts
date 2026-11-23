import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { withInventoryFixtures } from '../mocks/inventory.mock';
import { disposalOperation } from '../sections/inventory/inventory-test-fixtures';
import type { ComponentType } from '../sections/laboratory/fractionation/fractionation.types';
import { localDateTime } from '../sections/laboratory/screening/screening-rules';
import type {
  TransfusionRequest,
  TransfusionReturnInspection,
  TransfusionReturnReceipt,
} from '../sections/transfusions/transfusions.types';
import {
  comparePriority,
  compatibilityNeedsCommunication,
  compatibilityPending,
  transfusionCandidate,
  transfusionLocalDay,
} from '../sections/transfusions/transfusions-rules';
import { createMockFractionationApi } from './mock-fractionation.api';
import { createMockInventoryApi } from './mock-inventory.api';
import { processingStorageKey, readProcessingState, writeProcessingState } from './mock-processing-store';
import { createMockTransfersApi } from './mock-transfers.api';
import { createMockTransfusionsApi } from './mock-transfusions.api';

const unitCode = (number: number) => `BB-TX-DEMO-${String(number).padStart(3, '0')}`;
async function readyStock() {
  const api = createMockInventoryApi();
  const units = (await api.list()).units.filter((unit) => unit.id.startsWith('BB-TX-DEMO-'));
  expect(units).toHaveLength(20);
  expect(units.every((unit) => unit.status === 'APTO' && !!unit.sealId)).toBe(true);
}
async function sampled(number = 1, api = createMockTransfusionsApi()) {
  return reviewAndSample((await api.list()).requests[number - 1], api);
}
async function reviewAndSample(request: TransfusionRequest, api: ReturnType<typeof createMockTransfusionsApi>) {
  const reviewed = await api.review(request.id, request.revision, {
    ...request.draft,
    reviewer: 'Responsable DEMO',
    reviewVerified: true,
    consentVerified: true,
    urgentAuthorizationVerified: request.order.priority === 'veryUrgent',
  });
  const collectedAt = localDateTime();
  return api.saveSample(reviewed.id, reviewed.revision, {
    ...reviewed.draft.sample,
    collectedAt,
    collectedBy: 'Extracción DEMO',
    printRequestedAt: collectedAt,
    urgentPairVerified: request.order.priority === 'veryUrgent',
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
      labelsPrintRequestedAt: new Date().toISOString(),
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

const receipt: TransfusionReturnReceipt = {
  returnedBy: 'Profesional que devuelve DEMO',
  receivedBy: 'Profesional que recibe DEMO',
  reason: 'Revocación del FR12',
  administration: 'unused',
};
const inspection: TransfusionReturnInspection = {
  decision: 'approved',
  inspectedBy: 'Profesional que inspecciona DEMO',
  notAdministered: true,
  intact: true,
  segmentAttached: true,
  identityVerified: true,
  conservationVerified: true,
  minimumTemperature: '1',
  maximumTemperature: '10',
  evidence: 'Registro validado de transporte DEMO',
  rejectionReason: '',
};
async function issuedDelivery() {
  const api = createMockTransfusionsApi();
  if (!api.prepareIssuedRequest || !api.receiveReturnedUnit || !api.inspectReturnedUnit) {
    throw new Error('MISSING_RETURN_FIXTURE_SUPPORT');
  }
  const { order } = (await api.list()).requests[0];
  const issued = await api.prepareIssuedRequest({ ...order, id: 'issued-with-return' });
  const sample = await reviewAndSample(issued, api);
  const assigned = await api.assign(sample.id, sample.revision, [unitCode(1), unitCode(2), unitCode(11)], true);
  const verified = await results(assigned, false, api);
  const delivered = await api.deliver(verified.id, verified.revision, pickup(verified));
  const dispatches = (await api.list()).bookEntries;
  return {
    api,
    delivered,
    dispatches,
    receive: api.receiveReturnedUnit,
    inspect: api.inspectReturnedUnit,
  };
}

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
    expect(data.requests).toHaveLength(10);
    const [redCells, plasma, shortStock] = data.requests.slice(4, 7);
    expect(data.units.filter((unit) => transfusionCandidate(unit, redCells)).map((unit) => unit.bloodGroup)).toEqual(
      expect.arrayContaining(['A+', 'O+', 'O-']),
    );
    expect(data.units.filter((unit) => transfusionCandidate(unit, plasma)).map((unit) => unit.bloodGroup)).toEqual(
      expect.arrayContaining(['A+', 'AB+']),
    );
    expect(data.units.filter((unit) => transfusionCandidate(unit, shortStock))).toHaveLength(1);
    expect(data.requests.slice(7).map((request) => request.order.priority)).toEqual([
      'urgent',
      'veryUrgent',
      'veryUrgent',
    ]);
    expect(sessionStorage.getItem(processingStorageKey)).toBe(before);
  });
  it('releases only pre-dispatch allocations for a closed FR08 and preserves the recorded rounds', async () => {
    const api = createMockTransfusionsApi();
    const { order } = (await api.list()).requests[0];
    if (!api.prepareIssuedRequest || !api.cancelIssuedRequest) throw new Error('MISSING_ISSUED_WORKFLOW');
    const issued = await api.prepareIssuedRequest({ ...order, id: 'issued-order' });
    const reviewed = await api.review(issued.id, issued.revision, {
      ...issued.draft,
      reviewer: 'Responsable DEMO',
      reviewVerified: true,
      consentVerified: true,
    });
    const collectedAt = localDateTime();
    const sample = await api.saveSample(reviewed.id, reviewed.revision, {
      ...reviewed.draft.sample,
      collectedAt,
      collectedBy: 'Extracción DEMO',
      printRequestedAt: collectedAt,
    });
    const request = await api.assign(sample.id, sample.revision, [unitCode(1), unitCode(2), unitCode(11)], true);
    const closure = {
      uuid: 'revocation',
      decision: 'revoked' as const,
      decidedAt: new Date().toISOString(),
      provider: 'Médico DEMO',
    };
    expect((await api.list()).units.find(({ id }) => id === unitCode(1))?.status).toBe('En pruebas de compatibilidad');
    expect(await api.cancelIssuedRequest(request.id, closure)).toBe(true);
    expect(await api.cancelIssuedRequest(request.id, closure)).toBe(false);
    const { requests, units, bookEntries } = await api.list();
    const closed = requests.find(({ id }) => id === issued.id);
    expect(closed).toMatchObject({ status: 'cancelled', consentClosure: closure, rounds: request.rounds });
    expect(closed?.assignments).toHaveLength(request.assignments.length);
    expect(closed?.assignments.every(({ active }) => !active)).toBe(true);
    expect(units.find(({ id }) => id === unitCode(1))?.status).toBe('APTO');
    expect(bookEntries).toHaveLength(0);
    await expect(api.saveCompatibility(request.id, request.revision, request.rounds[0], false)).rejects.toThrow(
      'TRANSFUSION_CONFLICT',
    );
  });

  it('holds a returned unit until approval and keeps the original delivery through a new assignment', async () => {
    const { api, delivered, dispatches, receive, inspect } = await issuedDelivery();
    const inventory = createMockInventoryApi();
    const [dispatch] = dispatches;
    expect((await inventory.list()).units.some(({ id }) => id === dispatch.unitCode)).toBe(false);
    const returned = await receive(dispatch.id, 'fr12-revoked', receipt);
    expect(returned).toMatchObject({ dispatchId: dispatch.id, consentDecisionUuid: 'fr12-revoked', receipt });
    await expect(receive(dispatch.id, 'fr12-revoked', receipt)).rejects.toThrow('INVALID_TRANSFUSION_RETURN_RECEIPT');
    const received = (await api.list()).units.find(({ id }) => id === dispatch.unitCode);
    expect(received).toMatchObject({ status: 'Devuelta · En evaluación', canDispose: false });
    if (!received) throw new Error('MISSING_RETURN_UNIT');
    expect(transfusionCandidate(received, delivered)).toBe(false);
    await expect(inspect(dispatch.id, { ...inspection, maximumTemperature: '10.1' })).rejects.toThrow(
      'INVALID_TRANSFUSION_RETURN_INSPECTION',
    );
    await expect(inspect(dispatch.id, { ...inspection, segmentAttached: false })).rejects.toThrow(
      'INVALID_TRANSFUSION_RETURN_INSPECTION',
    );
    expect((await inventory.list()).units.find(({ id }) => id === dispatch.unitCode)?.status).toBe(
      'Devuelta · En evaluación',
    );
    const accepted = await inspect(dispatch.id, inspection);
    expect(accepted.inspection?.decision).toBe('approved');
    expect((await inventory.list()).units.find(({ id }) => id === dispatch.unitCode)).toMatchObject({
      id: dispatch.unitCode,
      status: 'APTO',
      expiresAt: received.expiresAt,
      sealId: received.sealId,
    });
    expect((await inventory.list()).units.some(({ id }) => id === dispatches[1].unitCode)).toBe(false);
    if (!api.prepareIssuedRequest) throw new Error('MISSING_SECOND_REQUEST_SUPPORT');
    const nextOrder = await api.prepareIssuedRequest({
      ...delivered.order,
      id: 'second-issued-order',
      items: [{ component: dispatch.component, quantity: 1 }],
    });
    const nextSample = await reviewAndSample(nextOrder, api);
    await api.assign(nextSample.id, nextSample.revision, [dispatch.unitCode], true);
    const next = await api.list();
    expect(next.units.find(({ id }) => id === dispatch.unitCode)?.status).toBe('En pruebas de compatibilidad');
    expect(next.requests.find(({ id }) => id === delivered.id)).toEqual(delivered);
    expect(next.bookEntries).toEqual(dispatches);
  });

  it('blocks reissue of a used return and keeps its disposal linked from the return history', async () => {
    const { api, dispatches, receive, inspect } = await issuedDelivery();
    const inventory = createMockInventoryApi();
    const [dispatch] = dispatches;
    await receive(dispatch.id, 'fr12-revoked', { ...receipt, administration: 'started' });
    await expect(inspect(dispatch.id, inspection)).rejects.toThrow('INVALID_TRANSFUSION_RETURN_INSPECTION');
    await inspect(dispatch.id, { ...inspection, decision: 'rejected', rejectionReason: 'Bolsa utilizada' });
    const unit = (await inventory.list()).units.find(({ id }) => id === dispatch.unitCode);
    expect(unit).toMatchObject({ status: 'No apta para reemisión', canDispose: true });
    if (!unit) throw new Error('MISSING_RETURN_UNIT');
    const operation = disposalOperation([unit]);
    const selected = await inventory.saveDisposalSelection(operation);
    const review = await inventory.saveDisposalDetails(selected);
    const completed = await inventory.dispose(review);
    expect((await inventory.list()).units.some(({ id }) => id === dispatch.unitCode)).toBe(false);
    const history = await api.list();
    expect(history.returns?.[0]).toMatchObject({
      disposal: { operationId: completed.id },
      inspection: { decision: 'rejected' },
    });
    expect(history.bookEntries).toEqual(dispatches);
  });

  it('adds the new fixtures to saved sessions and keeps their existing requests and progress', async () => {
    const api = createMockTransfusionsApi();
    const registered = await sampled(1, api);
    const state = readProcessingState(() => sessionStorage);
    if (!state.transfusions) throw new Error('MISSING_FIXTURE');
    state.transfusions.requests = state.transfusions.requests.slice(0, 4);
    writeProcessingState(() => sessionStorage, state);

    const data = await api.list();
    expect(data.requests).toHaveLength(10);
    expect(data.requests[0]).toEqual(registered);
    expect(readProcessingState(() => sessionStorage).transfusions?.requests).toHaveLength(4);
  });
  it('orders priority first then oldest request', () => {
    expect(
      [
        { priority: 'scheduled' as const, date: '2026-01-01' },
        { priority: 'urgent' as const, date: '2026-02-01' },
      ].sort(comparePriority)[0].priority,
    ).toBe('urgent');
    expect(
      comparePriority({ priority: 'scheduled', date: '2026-01-01' }, { priority: 'scheduled', date: '2026-01-02' }),
    ).toBeLessThan(0);
  });
  it.each([
    [5, 6, true],
    [6, 13, false],
    [8, 6, true],
  ])('completes regular demo %i using compatible stock from a different ABO/Rh group', async (number, unit, crossmatch) => {
    const api = createMockTransfusionsApi();
    const request = await sampled(number, api);
    const assigned = await api.assign(request.id, request.revision, [unitCode(unit)], true);
    expect(assigned.urgentAuthorization).toBeUndefined();
    expect(assigned.status).toBe(crossmatch ? 'testing' : 'compatible');
    if (crossmatch)
      await expect(api.deliver(assigned.id, assigned.revision, pickup(assigned))).rejects.toThrow(
        'TRANSFUSION_CONFLICT',
      );
    const ready = crossmatch ? await results(assigned, false, api) : assigned;
    expect((await api.deliver(ready.id, ready.revision, pickup(ready))).status).toBe('delivered');
    expect((await api.list()).bookEntries).toHaveLength(1);
  });
  it.each([7, 10])('keeps demo %i open without assigning or delivering partial stock', async (number) => {
    const api = createMockTransfusionsApi();
    const request = await sampled(number, api);
    const candidates = (await api.list()).units.filter((unit) => transfusionCandidate(unit, request));
    expect(candidates.map((unit) => unit.id)).toEqual([unitCode(6)]);
    await expect(api.assign(request.id, request.revision, [unitCode(6)], true)).rejects.toThrow(
      'INVALID_TRANSFUSION_SELECTION',
    );
    const workspace = await api.list();
    expect(workspace.requests[number - 1]).toEqual(request);
    expect(workspace.units.find((unit) => unit.id === unitCode(6))?.status).toBe('APTO');
    expect(workspace.bookEntries).toEqual([]);
  });
  it('dispatches demo TX-DEMO-0009 before compatibility and keeps a later incompatible unit out of stock', async () => {
    const api = createMockTransfusionsApi();
    const initial = (await api.list()).requests[8];
    const review = { ...initial.draft, reviewer: 'DEMO', reviewVerified: true, consentVerified: true };
    await expect(api.review(initial.id, initial.revision, review)).rejects.toThrow('INVALID_TRANSFUSION_REVIEW');
    const reviewed = await api.review(initial.id, initial.revision, { ...review, urgentAuthorizationVerified: true });
    const collectedAt = localDateTime();
    const sample = { ...reviewed.draft.sample, collectedAt, collectedBy: 'DEMO', printRequestedAt: collectedAt };
    await expect(api.saveSample(reviewed.id, reviewed.revision, sample)).rejects.toThrow('INVALID_RECIPIENT_SAMPLE');
    const request = await api.saveSample(reviewed.id, reviewed.revision, { ...sample, urgentPairVerified: true });
    await expect(api.assign(request.id, request.revision, [unitCode(1), unitCode(13)], true)).rejects.toThrow(
      'INVALID_TRANSFUSION_SELECTION',
    );
    await expect(
      api.assign(request.id, request.revision, [unitCode(1), unitCode(6), unitCode(11)], true),
    ).rejects.toThrow('INVALID_TRANSFUSION_SELECTION');
    const ready = await api.assign(request.id, request.revision, [unitCode(1), unitCode(6), unitCode(13)], true);
    expect(ready.status).toBe('readyUrgent');
    expect(compatibilityPending(ready, ready.rounds[0])).toBe(false);
    await expect(results(ready, false, api)).rejects.toThrow('TRANSFUSION_CONFLICT');
    await expect(api.deliver(ready.id, ready.revision, pickup(ready))).rejects.toThrow('INVALID_TRANSFUSION_DELIVERY');
    const delivered = await api.deliver(ready.id, ready.revision, { ...pickup(ready), urgentLabelsVerified: true });
    expect(delivered.status).toBe('delivered');
    expect(compatibilityPending(delivered, delivered.rounds[0])).toBe(true);
    const tested = await results(delivered, true, api);
    expect(tested.status).toBe('delivered');
    expect(tested.assignments[1]).toMatchObject({ result: 'incompatible', active: true });
    expect(compatibilityNeedsCommunication(tested, tested.rounds[0])).toBe(true);
    const notified = await api.communicateCompatibility(tested.id, tested.revision, tested.rounds[0].id, 'Banco DEMO');
    expect(notified.rounds[0].communicated?.by).toBe('Banco DEMO');
    expect(compatibilityNeedsCommunication(notified, notified.rounds[0])).toBe(false);
    const workspace = await api.list();
    expect(workspace.units.some((unit) => [unitCode(1), unitCode(6), unitCode(13)].includes(unit.id))).toBe(false);
    expect(workspace.bookEntries).toHaveLength(3);
    expect(workspace.bookEntries.find((entry) => entry.unitCode === unitCode(6))).toMatchObject({
      compatibilityPendingAtDispatch: true,
      compatibilityAfterDispatch: { result: 'incompatible' },
    });
  });
  it('checks donor-to-recipient ABO/Rh by component and retains the same rule at assignment and delivery', async () => {
    const api = createMockTransfusionsApi();
    const request = await sampled(1, api);
    const units = (await api.list()).units;
    const redCell = units.find((unit) => unit.id === unitCode(1));
    if (!redCell) throw new Error('MISSING_FIXTURE');
    const compatible = (componentType: ComponentType, donor: string, recipient: string) =>
      transfusionCandidate(
        { ...redCell, bloodGroup: donor, componentType },
        {
          ...request,
          order: { ...request.order, bloodGroup: recipient, items: [{ component: componentType, quantity: 1 }] },
        },
      );
    expect(compatible('redCells', 'O-', 'A+')).toBe(true);
    expect(compatible('redCells', 'O+', 'A-')).toBe(false);
    expect(compatible('redCells', 'B-', 'A+')).toBe(false);
    expect(compatible('wholeBlood', 'O-', 'A+')).toBe(false);
    expect(compatible('wholeBlood', 'A-', 'A+')).toBe(true);
    expect(compatible('pediatricFraction', 'O-', 'A+')).toBe(false);
    expect(compatible('freshFrozenPlasma', 'AB+', 'A-')).toBe(true);
    expect(compatible('freshFrozenPlasma', 'O-', 'A-')).toBe(false);
    expect(compatible('cryoprecipitate', 'AB+', 'O-')).toBe(true);
    expect(compatible('platelets', 'O-', 'A+')).toBe(false);
    expect(compatible('platelets', 'A+', 'A-')).toBe(false);
    expect(compatible('platelets', 'A-', 'A+')).toBe(true);
    expect(compatible('redCells', 'unknown', 'A+')).toBe(false);

    await expect(
      api.assign(request.id, request.revision, [unitCode(1), unitCode(5), unitCode(13)], true),
    ).rejects.toThrow('INVALID_TRANSFUSION_SELECTION');
    const allocated = await api.assign(request.id, request.revision, [unitCode(1), unitCode(6), unitCode(13)], true);
    expect(allocated.rounds[0].results).toHaveProperty(unitCode(6));
    const tested = await results(allocated, false, api);
    const delivered = await api.deliver(tested.id, tested.revision, pickup(tested));
    expect(delivered.status).toBe('delivered');
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
    const collectedAt = localDateTime();
    await expect(
      api.saveSample(reviewed.id, reviewed.revision, {
        ...reviewed.draft.sample,
        collectedAt,
        identityVerified: true,
      }),
    ).rejects.toThrow('INVALID_RECIPIENT_SAMPLE');
    const saved = await api.saveSample(reviewed.id, reviewed.revision, {
      ...reviewed.draft.sample,
      collectedAt,
      printRequestedAt: collectedAt,
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
    for (const patch of [{ historyNumber: 'WRONG' }, { collectedAt: '2099-01-01T12:00' }]) {
      const collectedAt = patch.collectedAt ?? localDateTime();
      await expect(
        api.saveSample(reviewed.id, reviewed.revision, {
          ...reviewed.draft.sample,
          collectedBy: 'DEMO',
          collectedAt,
          printRequestedAt: collectedAt,
          ...patch,
        }),
      ).rejects.toThrow('INVALID_RECIPIENT_SAMPLE');
    }
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
    expect(transfusionCandidate({ ...stock, autologousRecipientUuid: request.order.patientId }, request)).toBe(true);
    expect(transfusionCandidate({ ...stock, autologousRecipientUuid: 'other-patient' }, request)).toBe(false);
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
  it('holds assigned units for disposal and restores compatibility and transfusion reservations when released', async () => {
    const api = createMockTransfusionsApi();
    const request = await assigned();
    const inventory = createMockInventoryApi();
    const units = (await inventory.list()).units.filter((unit) =>
      request.assignments.some((item) => item.unit.id === unit.id),
    );
    expect(units).toHaveLength(3);
    expect(units.every((unit) => unit.canDispose)).toBe(true);
    const disposal = await inventory.saveDisposalSelection(disposalOperation(units));
    await expect(results(request, false, api)).rejects.toThrow('TRANSFUSION_STOCK_CONFLICT');
    expect(
      (await createMockFractionationApi().list()).units.some((unit) => units.some((item) => item.id === unit.id)),
    ).toBe(false);
    expect((await createMockTransfersApi().list()).units.find((unit) => unit.id === unitCode(1))?.status).toBe(
      'En proceso de eliminación',
    );
    await inventory.saveDraft({ ...disposal, units: [] });
    const restored = (await inventory.list()).units.filter(({ id }) => units.some((unit) => unit.id === id));
    expect(restored.map(({ status }) => status)).toEqual(units.map(({ status }) => status));
    await expect(results(request, false, api)).resolves.toMatchObject({ status: 'compatible' });
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
  it('does not rewrite previous mock workflow data when listing requests', async () => {
    const state = readProcessingState(() => sessionStorage);
    writeProcessingState(() => sessionStorage, state);
    const before = sessionStorage.getItem(processingStorageKey);
    await createMockTransfusionsApi().list();
    expect(sessionStorage.getItem(processingStorageKey)).toBe(before);
  });
});
