import { withInventoryFixtures } from '../mocks/inventory.mock';
import type {
  TransfusionRequest,
  TransfusionStatus,
  TransfusionStore,
} from '../sections/transfusions/transfusions.types';
import {
  lockedAssignments,
  needsCrossmatch,
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
    // Autologous and special-release pathways are outside this regular mock workflow.
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
      request.order.priority !== 'scheduled'
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
    async saveDraft(id, revision, draft) {
      const { state, store } = load();
      const request = current(store, id, revision, [
        'pending',
        'reviewed',
        'sampleReady',
        'incompatible',
        'compatible',
      ]);
      if (JSON.stringify(request.draft) === JSON.stringify(draft)) return request;
      request.draft = structuredClone(draft);
      return persist(state, store, request, draft.reviewer);
    },
    async review(id, revision, draft) {
      const { state, store } = load();
      const request = current(store, id, revision, ['pending']);
      if (!requestComplete(request.order) || !draft.reviewVerified || !draft.consentVerified || !draft.reviewer.trim())
        throw new Error('INVALID_TRANSFUSION_REVIEW');
      request.draft = structuredClone(draft);
      request.receivedAt = new Date().toISOString();
      return persist(state, store, request, draft.reviewer, 'reviewed');
    },
    async saveSample(id, revision, sample) {
      const { state, store } = load();
      const request = current(store, id, revision, ['reviewed']);
      if (sample.code !== `M-REC-${request.order.number}` || !sampleValid(sample, request.order))
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
      return persist(state, store, request, request.draft.reviewer, tested.length ? 'testing' : 'compatible');
    },
    async saveCompatibility(id, revision, input, finalize) {
      const { state, store, units } = load();
      const request = current(store, id, revision, ['testing']);
      const round = request.rounds.find((item) => item.id === input.id && !item.completedAt);
      if (
        !round ||
        Object.keys(input.results).sort().join('|') !== Object.keys(round.results).sort().join('|') ||
        Object.values(input.results).some((value) => !['', 'compatible', 'incompatible'].includes(value))
      )
        throw new Error('INVALID_COMPATIBILITY_ROUND');
      const changes = {
        operator: input.operator,
        identityVerified: input.identityVerified,
        pretransfusionVerified: input.pretransfusionVerified,
        results: structuredClone(input.results),
      };
      if (
        !finalize &&
        JSON.stringify(changes) ===
          JSON.stringify({
            operator: round.operator,
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
          !sampleValid(round.sample, request.order) ||
          Object.values(round.results).some((value) => !value)
        )
          throw new Error('INCOMPLETE_COMPATIBILITY');
        const now = new Date().toISOString();
        for (const assignment of request.assignments.filter((item) => item.roundId === round.id)) {
          const stock = units.find((item) => item.id === assignment.unit.id);
          if (
            !stock ||
            stock.status !== 'En pruebas de compatibilidad' ||
            stock.qualityIssues.length ||
            stock.sealId !== assignment.unit.sealId
          )
            throw new Error('TRANSFUSION_STOCK_CONFLICT');
          const result = round.results[assignment.unit.id];
          if (!result) throw new Error('INCOMPLETE_COMPATIBILITY');
          assignment.result = result;
          assignment.resultAt = now;
          assignment.testedBy = round.operator;
          assignment.active = result === 'compatible';
        }
        round.completedAt = now;
      }
      return persist(
        state,
        store,
        request,
        round.operator,
        finalize
          ? Object.values(round.results).some((value) => value === 'incompatible')
            ? 'incompatible'
            : 'compatible'
          : 'testing',
      );
    },
    async deliver(id, revision, draft) {
      const { state, store, units } = load();
      const previous = store.requests.find((item) => item.id === id);
      if (previous?.status === 'delivered') return structuredClone(previous);
      const request = current(store, id, revision, ['compatible']);
      if (
        !draft.collectorName.trim() ||
        !/^\d{8}$/.test(draft.collectorDocument) ||
        !draft.deliveredBy.trim() ||
        !draft.releaseVerified
      )
        throw new Error('INVALID_TRANSFUSION_DELIVERY');
      const assigned = lockedAssignments(request);
      if (
        assigned.length !== request.order.items.reduce((sum, item) => sum + item.quantity, 0) ||
        !request.order.items.every(
          (item) => assigned.filter((unit) => unit.unit.componentType === item.component).length === item.quantity,
        ) ||
        (assigned.some((item) => needsCrossmatch(item.unit.componentType)) &&
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
      request.draft = structuredClone(draft);
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
          seal: `${assignment.unit.sealId}/${assignment.unit.id}`,
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
        });
      }
      return persist(state, store, request, draft.deliveredBy, 'delivered');
    },
  };
}
