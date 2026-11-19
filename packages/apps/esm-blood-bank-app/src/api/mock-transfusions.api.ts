import { inventoryUnitSealCode } from '../sections/inventory/inventory-rules';
import { withInventoryFixtures } from '../mocks/inventory.mock';
import type {
  TransfusionRequest,
  TransfusionStatus,
  TransfusionStore,
} from '../sections/transfusions/transfusions.types';
import {
  compatibilityNeedsCommunication,
  compatibilityPending,
  initialTransfusionRequest,
  lockedAssignments,
  needsCrossmatch,
  priorityKeys,
  requestComplete,
  sampleValid,
  selectionComplete,
  transfusionCandidate,
} from '../sections/transfusions/transfusions-rules';
import {
  type MockStorage,
  type ProcessingState,
  readProcessingState,
  writeProcessingState,
} from './mock-processing-store';
import { transferUnits } from './mock-transfers.api';
import { transfusionStore } from './mock-transfusions-store';
import type { TransfusionsApi } from './transfusions.api';

export function createMockTransfusionsApi(
  getStorage: () => MockStorage = () => globalThis.sessionStorage,
): TransfusionsApi {
  const load = () => {
    const state = withInventoryFixtures(readProcessingState(getStorage));
    // Directed autologous units are not candidates for these requests.
    const units = transferUnits(state).filter(
      (unit) =>
        !state.fractionation?.units.find((item) => item.code === unit.id)?.label.autologous &&
        !state.collections.some(
          (item) => item.unitCode === unit.id && item.application.admission.donationType === 'autologous',
        ),
    );
    return { state, store: transfusionStore(state), units };
  };
  const current = (store: TransfusionStore, id: string, revision: number, statuses: TransfusionStatus[]) => {
    const request = store.requests.find((item) => item.id === id);
    if (
      !request ||
      request.revision !== revision ||
      !statuses.includes(request.status) ||
      !Object.hasOwn(priorityKeys, request.order.priority)
    )
      throw new Error('TRANSFUSION_CONFLICT');
    return structuredClone(request);
  };
  const persist = (
    state: ProcessingState,
    store: TransfusionStore,
    request: TransfusionRequest,
    actor: string,
    status = request.status,
  ) => {
    if (status !== request.status)
      request.events.push({
        id: `${request.id}/event/${request.events.length + 1}`,
        at: new Date().toISOString(),
        status,
        actor,
      });
    request.status = status;
    request.revision += 1;
    store.requests[store.requests.findIndex((item) => item.id === request.id)] = request;
    // Shared mock stock, reservations and FR10 issue records commit in one write.
    writeProcessingState(getStorage, { ...state, transfusions: store });
    return structuredClone(request);
  };
  return {
    async list() {
      const { store, units } = load();
      return structuredClone({ ...store, units });
    },
    async prepareIssuedRequest(order) {
      const { state, store } = load();
      const existing = store.requests.find((request) => request.id === order.id);
      if (existing?.issuedOrder) return existing;
      if (existing || !order.id || order.otherComponent || !requestComplete(order))
        throw new Error('INVALID_ISSUED_TRANSFUSION_REQUEST');
      const request: TransfusionRequest = { ...initialTransfusionRequest(order), issuedOrder: true };
      store.requests.push(request);
      writeProcessingState(getStorage, { ...state, transfusions: store });
      return structuredClone(request);
    },
    async saveDraft(id, revision, draft) {
      const { state, store } = load();
      const request = current(store, id, revision, [
        'pending',
        'reviewed',
        'sampleReady',
        'incompatible',
        'compatible',
        'readyUrgent',
      ]);
      if (JSON.stringify(request.draft) === JSON.stringify(draft)) return request;
      request.draft = structuredClone(draft);
      return persist(state, store, request, draft.reviewer);
    },
    async review(id, revision, draft) {
      const { state, store } = load();
      const request = current(store, id, revision, ['pending']);
      const urgent = request.order.priority === 'veryUrgent';
      if (
        !requestComplete(request.order) ||
        !draft.reviewVerified ||
        !draft.consentVerified ||
        !draft.reviewer.trim() ||
        (urgent && draft.urgentAuthorizationVerified !== true)
      )
        throw new Error('INVALID_TRANSFUSION_REVIEW');
      request.draft = structuredClone(draft);
      request.receivedAt = new Date().toISOString();
      if (urgent) request.urgentAuthorization = { verifiedAt: request.receivedAt, verifiedBy: draft.reviewer };
      return persist(state, store, request, draft.reviewer, 'reviewed');
    },
    async saveSample(id, revision, sample) {
      const { state, store } = load();
      const request = current(store, id, revision, ['reviewed']);
      if (
        sample.code !== `M-REC-${request.order.number}` ||
        sample.printRequestedAt !== sample.collectedAt ||
        !sampleValid(sample, request.order)
      )
        throw new Error('INVALID_RECIPIENT_SAMPLE');
      request.sample = structuredClone(sample);
      request.draft.sample = structuredClone(sample);
      return persist(state, store, request, sample.collectedBy, 'sampleReady');
    },
    async assign(id, revision, unitIds, verified) {
      const { state, store, units } = load();
      const request = current(store, id, revision, ['sampleReady', 'incompatible']);
      request.draft.selectedUnitIds = [...unitIds];
      request.draft.selectionVerified = verified;
      if (
        !verified ||
        !request.sample ||
        !sampleValid(request.sample, request.order) ||
        !selectionComplete(request, units)
      )
        throw new Error('INVALID_TRANSFUSION_SELECTION');
      const now = new Date().toISOString();
      const roundId = `PC-${request.id}-${request.rounds.length + 1}`;
      const added = unitIds.map((unitId) => {
        const unit = units.find((item) => item.id === unitId);
        if (!unit || !transfusionCandidate(unit, request)) throw new Error('TRANSFUSION_STOCK_CONFLICT');
        const crossmatch = needsCrossmatch(unit.componentType);
        return {
          unit: structuredClone(unit),
          active: true,
          roundId: crossmatch ? roundId : null,
          unitSampleCode: crossmatch ? `M-UNI-${request.id}-${request.rounds.length + 1}-${unit.id}` : null,
          assignedAt: now,
          result: crossmatch ? ('pending' as const) : ('notRequired' as const),
          resultAt: null,
          testedBy: '',
        };
      });
      request.assignments.push(...added);
      const tested = added.filter((item) => item.result === 'pending');
      if (tested.length)
        request.rounds.push({
          id: roundId,
          createdAt: now,
          completedAt: null,
          sample: structuredClone(request.sample),
          operator: '',
          identityVerified: false,
          pretransfusionVerified: false,
          results: Object.fromEntries(tested.map((item) => [item.unit.id, ''])),
        });
      request.draft.selectedUnitIds = [];
      const status = request.order.priority === 'veryUrgent' ? 'readyUrgent' : tested.length ? 'testing' : 'compatible';
      return persist(state, store, request, request.draft.reviewer, status);
    },
    async saveCompatibility(id, revision, input, finalize) {
      const { state, store, units } = load();
      const request = current(store, id, revision, ['testing', 'delivered']);
      const afterDispatch = request.status === 'delivered';
      const round = request.rounds.find((item) => item.id === input.id && compatibilityPending(request, item));
      if (
        !round ||
        (afterDispatch && request.order.priority !== 'veryUrgent') ||
        Object.keys(input.results).sort().join('|') !== Object.keys(round.results).sort().join('|') ||
        Object.values(input.results).some((value) => !['', 'compatible', 'incompatible'].includes(value))
      )
        throw new Error('INVALID_COMPATIBILITY_ROUND');
      const changes = {
        operator: input.operator,
        labelsPrintRequestedAt: round.labelsPrintRequestedAt ?? input.labelsPrintRequestedAt,
        identityVerified: input.identityVerified,
        pretransfusionVerified: input.pretransfusionVerified,
        results: structuredClone(input.results),
      };
      if (
        !finalize &&
        JSON.stringify(changes) ===
          JSON.stringify({
            operator: round.operator,
            labelsPrintRequestedAt: round.labelsPrintRequestedAt,
            identityVerified: round.identityVerified,
            pretransfusionVerified: round.pretransfusionVerified,
            results: round.results,
          })
      )
        return request;
      Object.assign(round, changes);
      if (finalize) {
        if (
          !round.operator.trim() ||
          !round.identityVerified ||
          !round.pretransfusionVerified ||
          (afterDispatch && !round.labelsPrintRequestedAt) ||
          !sampleValid(round.sample, request.order) ||
          Object.values(round.results).some((value) => !value)
        )
          throw new Error('INCOMPLETE_COMPATIBILITY');
        const now = new Date().toISOString();
        for (const assignment of request.assignments.filter((item) => item.roundId === round.id)) {
          if (!afterDispatch) {
            const stock = units.find((item) => item.id === assignment.unit.id);
            if (
              !stock ||
              stock.status !== 'En pruebas de compatibilidad' ||
              stock.qualityIssues.length ||
              stock.sealId !== assignment.unit.sealId
            )
              throw new Error('TRANSFUSION_STOCK_CONFLICT');
          }
          const result = round.results[assignment.unit.id];
          if (!result) throw new Error('INCOMPLETE_COMPATIBILITY');
          assignment.result = result;
          assignment.resultAt = now;
          assignment.testedBy = round.operator;
          if (afterDispatch) {
            const entry = store.bookEntries.find(
              (item) => item.requestId === id && item.unitCode === assignment.unit.id,
            );
            if (!entry?.compatibilityPendingAtDispatch) throw new Error('TRANSFUSION_STOCK_CONFLICT');
            entry.compatibilityAfterDispatch = { result, at: now };
          } else {
            assignment.active = result === 'compatible';
          }
        }
        round.completedAt = now;
      }
      return persist(
        state,
        store,
        request,
        round.operator,
        afterDispatch
          ? 'delivered'
          : finalize
            ? Object.values(round.results).some((value) => value === 'incompatible')
              ? 'incompatible'
              : 'compatible'
            : 'testing',
      );
    },
    async communicateCompatibility(id, revision, roundId, actor) {
      const { state, store } = load();
      const previous = store.requests.find((item) => item.id === id);
      if (previous?.rounds.some((round) => round.id === roundId && round.communicated)) return previous;
      const request = current(store, id, revision, ['delivered']);
      const round = request.rounds.find(
        (item) => item.id === roundId && compatibilityNeedsCommunication(request, item),
      );
      if (!round || !actor.trim()) throw new Error('INVALID_COMPATIBILITY_COMMUNICATION');
      round.communicated = { at: new Date().toISOString(), by: actor };
      return persist(state, store, request, actor);
    },
    async deliver(id, revision, draft) {
      const { state, store, units } = load();
      const previous = store.requests.find((item) => item.id === id);
      if (previous?.status === 'delivered') return structuredClone(previous);
      const request = current(store, id, revision, ['compatible', 'readyUrgent']);
      const urgent = request.status === 'readyUrgent';
      const assigned = urgent ? request.assignments.filter((item) => item.active) : lockedAssignments(request);
      const dispatchWithPendingTests = urgent && assigned.some((item) => item.result === 'pending');
      if (
        !draft.collectorName.trim() ||
        !/^\d{8}$/.test(draft.collectorDocument) ||
        !draft.deliveredBy.trim() ||
        !draft.releaseVerified ||
        (urgent && (request.order.priority !== 'veryUrgent' || !request.urgentAuthorization)) ||
        (dispatchWithPendingTests && draft.urgentLabelsVerified !== true)
      )
        throw new Error('INVALID_TRANSFUSION_DELIVERY');
      if (
        assigned.length !== request.order.items.reduce((sum, item) => sum + item.quantity, 0) ||
        !request.order.items.every(
          (item) => assigned.filter((unit) => unit.unit.componentType === item.component).length === item.quantity,
        ) ||
        assigned.some(
          (item) =>
            needsCrossmatch(item.unit.componentType) &&
            item.result !== 'compatible' &&
            !(urgent && item.result === 'pending' && request.rounds.some((round) => round.id === item.roundId)),
        ) ||
        ((urgent || assigned.some((item) => needsCrossmatch(item.unit.componentType))) &&
          (!request.sample || !sampleValid(request.sample, request.order)))
      )
        throw new Error('TRANSFUSION_STOCK_CONFLICT');
      for (const assignment of assigned) {
        const stock = units.find((item) => item.id === assignment.unit.id);
        if (
          !stock ||
          stock.status !== 'Reservados para transfusión' ||
          stock.sealId !== assignment.unit.sealId ||
          !transfusionCandidate({ ...stock, status: 'APTO' }, { ...request, assignments: [] })
        )
          throw new Error('TRANSFUSION_STOCK_CONFLICT');
      }
      request.draft = {
        ...request.draft,
        collectorName: draft.collectorName,
        collectorDocument: draft.collectorDocument,
        deliveredBy: draft.deliveredBy,
        releaseVerified: draft.releaseVerified,
        urgentLabelsVerified: draft.urgentLabelsVerified,
      };
      request.deliveredAt = new Date().toISOString();
      request.requesterStatus = 'ATENDIDA';
      for (const assignment of assigned) {
        if (!assignment.unit.componentType || !assignment.unit.sealId) throw new Error('TRANSFUSION_STOCK_CONFLICT');
        store.bookEntries.push({
          id: `${id}/${assignment.unit.id}`,
          kind: 'transfusionDispatch',
          requestId: id,
          orderNumber: request.order.number,
          unitCode: assignment.unit.id,
          seal: inventoryUnitSealCode(assignment.unit),
          component: assignment.unit.componentType,
          patientName: request.order.patientName,
          historyNumber: request.order.historyNumber,
          service: request.order.service,
          doctor: request.order.orderer,
          doctorLicense: request.order.doctorLicense,
          attendedBy: draft.deliveredBy,
          collectorName: draft.collectorName,
          collectorDocument: draft.collectorDocument,
          at: request.deliveredAt,
          ...(assignment.result === 'pending' ? { compatibilityPendingAtDispatch: true as const } : {}),
        });
      }
      return persist(state, store, request, draft.deliveredBy, 'delivered');
    },
  };
}
