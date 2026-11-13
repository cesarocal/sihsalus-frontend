import { inventoryMock } from '../mocks/blood-bank.mock';
import { withInventoryFixtures } from '../mocks/inventory.mock';
import type {
  InventoryOperation,
  InventoryUnit,
  InventoryWorkspace,
  QualitySealLabel,
} from '../sections/inventory/inventory.types';
import {
  canReprintSeal,
  inventoryExpiry,
  qualitySealCode,
  validateInventoryOperation,
} from '../sections/inventory/inventory-rules';
import {
  globalScreeningResult,
  localDateTime,
  validateScreening,
} from '../sections/laboratory/screening/screening-rules';
import {
  consolidatedScreening,
  hasConfirmedReactiveScreening,
  pendingScreeningRepeatTests,
} from '../sections/laboratory/screening/screening-repeat-rules';
import type { InventorySummary } from '../types/blood-bank.types';
import type { InventoryApi } from './inventory.api';
import { fractionationInventory, fractionationStore } from './mock-fractionation.api';
import { inventoryStore } from './mock-inventory-store';
import {
  type MockStorage,
  type ProcessingState,
  readProcessingState,
  writeProcessingState,
} from './mock-processing-store';
import { transferUnitState } from './mock-transfers-store';
import { transfusionUnitState } from './mock-transfusions-store';

const mutable = (op: InventoryOperation) => ({
  units: op.units,
  causes: op.causes,
  date: op.date,
  time: op.time,
  witnesses: op.witnesses,
  serviceResponsible: op.serviceResponsible,
  epidemiologyResponsible: op.epidemiologyResponsible,
  labelsVerified: op.labelsVerified,
  integrityVerified: op.integrityVerified,
  recordsVerified: op.recordsVerified,
});
const summary = (unit: InventorySummary): InventorySummary => ({
  id: unit.id,
  component: unit.component,
  bloodGroup: unit.bloodGroup,
  volume: unit.volume,
  expiresAt: unit.expiresAt,
  location: unit.location,
  status: unit.status,
});
// Operational state is checked against current stock, including for drafts from older sessions.
function sameUnit(current: InventorySummary, previous: InventorySummary) {
  return JSON.stringify(summary({ ...current, status: previous.status })) === JSON.stringify(summary(previous));
}
function originalScreenings(state: ProcessingState, originalCode: string) {
  const origin = state.collections.find((collection) => collection.unitCode === originalCode);
  if (!origin) return [];
  return state.screenings.filter(
    (panel) =>
      panel.unitCode === originalCode &&
      panel.collectionId === origin.id &&
      (!panel.origin || (panel.origin.type === 'postExtraction' && panel.origin.collectionId === origin.id)),
  );
}
function sealLabels(
  state: ProcessingState,
  workspace: InventoryWorkspace,
  op: InventoryOperation,
): Record<string, QualitySealLabel> {
  const fractions = fractionationStore(state).units;
  return Object.fromEntries(
    op.units.map((unit, index) => {
      const fraction = fractions.find((candidate) => candidate.code === unit.id);
      const originalCode = workspace.units.find((candidate) => candidate.id === unit.id)?.originalCode ?? unit.id;
      const cmv = originalScreenings(state, originalCode)
        .filter((panel) => panel.status === 'validated' && panel.additionalTest?.cmvIgGConceptUuid)
        .map((panel) => consolidatedScreening(panel))
        .sort((a, b) => (b.validatedAt ?? '').localeCompare(a.validatedAt ?? ''))[0]?.additionalTest?.result;
      return [
        unit.id,
        {
          code: op.id.startsWith('SC-')
            ? `${op.id}-${String(index + 1).padStart(2, '0')}`
            : qualitySealCode(op, unit.id),
          originalCode,
          ...(fraction ? { details: { ...fraction.label, ...(cmv ? { cmvIgGResult: cmv } : {}) } } : {}),
          lowVolume: fraction?.component === 'lowVolumeRedCells',
        },
      ];
    }),
  );
}
/** Canonical stock projection shared by getInventory and the inventory workflows. */
export function inventoryWorkspace(state: ProcessingState): InventoryWorkspace {
  state = withInventoryFixtures(state);
  const fractions = fractionationStore(state).units;
  const managed = fractions.map((unit) => unit.code);
  const base: InventorySummary[] = [
    ...state.collections
      .filter((record) => record.unitStatus === 'quarantine' && !managed.includes(record.unitCode))
      .map((record) => ({
        id: record.unitCode,
        component: record.label.component,
        bloodGroup: `${record.application.physical.bloodGroup}${record.application.physical.rh}`,
        volume: record.extractedVolume,
        expiresAt: '—',
        location: record.label.service,
        status: 'Cuarentena' as const,
      })),
    ...inventoryMock.filter((unit) => !managed.includes(unit.id)),
    ...fractionationInventory(state),
  ];
  const { operations } = inventoryStore(state);
  const units: InventoryUnit[] = base
    .filter(
      (unit) =>
        transferUnitState(state, unit.id) !== 'delivered' &&
        transfusionUnitState(state, unit.id) !== 'delivered' &&
        !operations.some(
          (op) => op.kind === 'disposal' && op.stage === 'completed' && op.units.some((item) => item.id === unit.id),
        ),
    )
    .map((unit) => {
      const seal = operations.find(
        (op) => op.kind === 'qualitySeal' && op.stage !== 'draft' && op.units.some((item) => item.id === unit.id),
      );
      const fixtureSealId = state.fixtureQualitySeals?.[unit.id];
      const originalCode = fractions.find((item) => item.code === unit.id)?.originalWholeBloodCode ?? unit.id;
      const originalPanels = originalScreenings(state, originalCode);
      const repeatPending = originalPanels.some((panel) => pendingScreeningRepeatTests(panel).length > 0);
      const panels = originalPanels.map((panel) => consolidatedScreening(panel));
      const qualityIssues: string[] = [];
      if (
        !originalPanels.length ||
        originalPanels.some(
          (panel) =>
            panel.status !== 'validated' ||
            !panel.validatedAt ||
            !Number.isFinite(new Date(panel.validatedAt).getTime()) ||
            new Date(panel.validatedAt) > new Date() ||
            new Date(panel.validatedAt) < new Date(panel.performedOn) ||
            validateScreening(panel, 'validation').length,
        )
      )
        qualityIssues.push('inventoryScreeningPending');
      if (
        repeatPending ||
        panels.some((panel) => panel.result !== 'nonReactive' || globalScreeningResult(panel) !== 'nonReactive')
      )
        qualityIssues.push('inventoryScreeningUnsafe');
      const confirmedReactive =
        !qualityIssues.includes('inventoryScreeningPending') && originalPanels.some(hasConfirmedReactiveScreening);
      let screeningResult: InventoryUnit['screeningResult'] = 'pending';
      if (confirmedReactive) screeningResult = 'reactive';
      else if (repeatPending || originalPanels.some((panel) => panel.status === 'inProgress'))
        screeningResult = 'inProgress';
      else if (!qualityIssues.includes('inventoryScreeningPending')) {
        if (panels.some((panel) => panel.result === 'reactive' || globalScreeningResult(panel) === 'reactive'))
          screeningResult = 'reactive';
        else if (
          panels.some((panel) => panel.result === 'inconclusive' || globalScreeningResult(panel) === 'inconclusive')
        )
          screeningResult = 'inconclusive';
        else if (!qualityIssues.includes('inventoryScreeningUnsafe')) screeningResult = 'nonReactive';
      }
      const expiry = inventoryExpiry(unit.expiresAt);
      if (
        !expiry ||
        expiry < localDateTime().slice(0, 10) ||
        (unit.expiresAt.includes('T') && new Date(unit.expiresAt).getTime() <= Date.now())
      )
        qualityIssues.push('inventoryExpiryInvalid');
      if (!/^(A|B|AB|O)[+−-]$/.test(unit.bloodGroup) || !unit.component.trim() || !unit.location.trim())
        qualityIssues.push('inventoryIdentityIncomplete');
      let status = unit.status;
      if (status === 'Cuarentena') {
        if (confirmedReactive) status = 'No apta';
        else if (screeningResult === 'nonReactive')
          status = seal?.stage === 'completed' || fixtureSealId ? 'APTO' : 'Sello pendiente';
      }
      const transfusion = transfusionUnitState(state, unit.id);
      const transfer = transferUnitState(state, unit.id);
      if (transfusion === 'testing') status = 'En pruebas de compatibilidad';
      else if (transfusion === 'reserved') status = 'Reservados para transfusión';
      else if (transfer === 'prepared') status = 'Por transferir';
      return {
        ...summary(unit),
        status,
        originalCode,
        screeningResult,
        qualityIssues,
        ...(seal
          ? { sealId: seal.id, sealCode: qualitySealCode(seal, unit.id) }
          : fixtureSealId
            ? { sealId: fixtureSealId }
            : {}),
        canDispose: !transfer && !transfusion && !['En fraccionamiento', 'Reservada'].includes(unit.status),
      };
    });
  if (new Set(units.map((unit) => unit.id)).size !== units.length) throw new Error('INVALID_INVENTORY_IDENTITY');
  return structuredClone({ units, operations });
}
export function createMockInventoryApi(getStorage: () => MockStorage = () => globalThis.sessionStorage): InventoryApi {
  const load = () => {
    const state = withInventoryFixtures(readProcessingState(getStorage));
    return {
      state,
      workspace: inventoryWorkspace(state),
      store: inventoryStore(state),
    };
  };
  const persist = (state: ProcessingState, store: ReturnType<typeof inventoryStore>, op: InventoryOperation) => {
    const index = store.operations.findIndex((item) => item.id === op.id);
    if (index < 0) store.operations.push(op);
    else store.operations[index] = op;
    writeProcessingState(getStorage, { ...state, inventory: store });
    return structuredClone(op);
  };
  function prepare(input: InventoryOperation, workspace: InventoryWorkspace): InventoryOperation {
    if (!['qualitySeal', 'disposal'].includes(input.kind)) throw new Error('INVALID_INVENTORY_OPERATION');
    const previous = workspace.operations.find((op) => op.id === input.id);
    if (
      (input.id && !previous) ||
      (previous && (input.revision !== previous.revision || input.kind !== previous.kind)) ||
      (!previous && input.revision !== 0)
    )
      throw new Error('INVENTORY_CONFLICT');
    if (previous && previous.stage !== 'draft') {
      if (JSON.stringify(mutable(previous)) !== JSON.stringify(mutable(input))) throw new Error('INVENTORY_LOCKED');
      return structuredClone(previous);
    }
    if (!input.units.length || new Set(input.units.map((unit) => unit.id)).size !== input.units.length)
      throw new Error('INVALID_INVENTORY_SELECTION');
    const units = input.units.map((selected) => {
      const current = workspace.units.find((unit) => unit.id === selected.id);
      if (!current || !sameUnit(current, selected)) throw new Error('INVENTORY_CONFLICT');
      return summary(current);
    });
    const sequence = String(workspace.operations.length + 1).padStart(5, '0');
    return {
      ...(previous ?? input),
      ...structuredClone(mutable(input)),
      units,
      causes: Object.fromEntries(units.map((unit) => [unit.id, input.causes[unit.id] ?? ''])),
      id: previous?.id ?? (input.kind === 'qualitySeal' ? `SC-${sequence}` : `E-DEMO-${sequence}`),
      revision: previous?.revision ?? 0,
      stage: 'draft',
      requestedAt: null,
      completedAt: null,
      outcome: undefined,
      sealLabels: undefined,
      sealReprints: undefined,
    };
  }
  function eligible(op: InventoryOperation, workspace: InventoryWorkspace) {
    if (validateInventoryOperation(op).length) throw new Error('INVALID_INVENTORY_FIELDS');
    for (const selected of op.units) {
      const current = workspace.units.find((unit) => unit.id === selected.id);
      if (!current || !sameUnit(current, selected)) throw new Error('INVENTORY_CONFLICT');
      if (
        op.kind === 'qualitySeal'
          ? current.status !== 'Sello pendiente' ||
            current.qualityIssues.length ||
            (current.sealId && current.sealId !== op.id)
          : !current.canDispose
      )
        throw new Error('INVENTORY_NOT_ELIGIBLE');
    }
  }
  function transition(
    input: InventoryOperation,
    action: 'ready' | 'printRequested' | 'completed',
    kind: InventoryOperation['kind'],
    operator?: string,
  ) {
    const { state, workspace, store } = load();
    const stored = workspace.operations.find((op) => op.id === input.id);
    if (stored?.stage === 'completed' && stored.kind === kind && action === 'completed') {
      if (JSON.stringify(mutable(stored)) !== JSON.stringify(mutable(input))) throw new Error('INVENTORY_CONFLICT');
      return structuredClone(stored);
    }
    const op = prepare(input, workspace);
    if (op.kind !== kind) throw new Error('INVALID_INVENTORY_OPERATION');
    const required =
      action === 'ready' || kind === 'disposal' ? 'draft' : action === 'printRequested' ? 'ready' : 'printRequested';
    if (op.stage !== required) throw new Error('INVENTORY_LOCKED');
    eligible(op, workspace);
    op.stage = action;
    op.revision += 1;
    op.updatedAt = new Date().toISOString();
    if (kind === 'qualitySeal' && (action === 'ready' || action === 'printRequested'))
      op.sealLabels = sealLabels(state, workspace, op);
    if (action === 'printRequested') {
      if (!operator?.trim()) throw new Error('INVENTORY_OPERATOR_REQUIRED');
      op.requestedAt = op.updatedAt;
      const now = localDateTime();
      op.date = now.slice(0, 10);
      op.time = now.slice(11);
      op.serviceResponsible = operator.trim();
    }
    if (action === 'completed') {
      op.completedAt = op.updatedAt;
      op.outcome = kind === 'qualitySeal' ? 'APTO' : 'ELIMINADAS';
    }
    return persist(state, store, op);
  }
  return {
    async list() {
      return load().workspace;
    },
    async saveDraft(input) {
      const { state, workspace, store } = load();
      const op = prepare(input, workspace);
      const previous = workspace.operations.find((item) => item.id === op.id);
      if (previous && JSON.stringify(mutable(op)) === JSON.stringify(mutable(previous)))
        return structuredClone(previous);
      op.revision += 1;
      op.updatedAt = new Date().toISOString();
      return persist(state, store, op);
    },
    async prepareSeal(input) {
      return transition(input, 'ready', 'qualitySeal');
    },
    async requestSealPrint(input, operator) {
      return transition(input, 'printRequested', 'qualitySeal', operator);
    },
    async requestSealReprint(input, { unitIds, reason, operator }) {
      const { state, workspace, store } = load();
      const op = prepare(input, workspace);
      if (
        op.kind !== 'qualitySeal' ||
        !['printRequested', 'completed'].includes(op.stage) ||
        !reason.trim() ||
        !operator.trim() ||
        !unitIds.length ||
        new Set(unitIds).size !== unitIds.length ||
        unitIds.some(
          (id) =>
            !op.units.some((unit) => unit.id === id) ||
            !workspace.units.some((unit) => unit.id === id && canReprintSeal(op, unit)),
        )
      )
        throw new Error('INVENTORY_REPRINT_NOT_ELIGIBLE');
      const previous = op.sealReprints ?? [];
      const now = new Date().toISOString();
      op.sealLabels ??= sealLabels(state, workspace, op);
      op.sealReprints = [
        ...previous,
        {
          number: previous.length + 1,
          unitIds,
          reason: reason.trim(),
          operator: operator.trim(),
          requestedAt: now,
        },
      ];
      op.revision += 1;
      op.updatedAt = now;
      return persist(state, store, op);
    },
    async confirmSeal(input) {
      return transition(input, 'completed', 'qualitySeal');
    },
    async dispose(input) {
      return transition(input, 'completed', 'disposal');
    },
  };
}
