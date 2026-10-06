import { inventoryMock } from '../mocks/blood-bank.mock';
import { withInventoryFixtures } from '../mocks/inventory.mock';
import { inventoryExpiry, validateInventoryOperation } from '../sections/inventory/inventory-rules';
import type { InventoryOperation, InventoryUnit, InventoryWorkspace } from '../sections/inventory/inventory.types';
import {
  globalScreeningResult,
  localDateTime,
  validateScreening,
} from '../sections/laboratory/screening/screening-rules';
import type { InventorySummary } from '../types/blood-bank.types';
import type { InventoryApi } from './inventory.api';
import { fractionationInventory, fractionationStore } from './mock-fractionation.api';
import { inventoryStore } from './mock-inventory-store';
import {
  readProcessingState,
  writeProcessingState,
  type MockStorage,
  type ProcessingState,
} from './mock-processing-store';

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
  expiresAt: unit.expiresAt,
  location: unit.location,
  status: unit.status,
});
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
        !operations.some(
          (op) => op.kind === 'disposal' && op.stage === 'completed' && op.units.some((item) => item.id === unit.id),
        ),
    )
    .map((unit) => {
      const seal = operations.find(
        (op) => op.kind === 'qualitySeal' && op.stage !== 'draft' && op.units.some((item) => item.id === unit.id),
      );
      const originalCode = fractions.find((item) => item.code === unit.id)?.originalWholeBloodCode ?? unit.id;
      const panels = state.screenings.filter(
        (panel) =>
          panel.unitCode === originalCode &&
          panel.collectionId &&
          (!panel.origin ||
            (panel.origin.type === 'postExtraction' && panel.origin.collectionId === panel.collectionId)) &&
          state.collections.some(
            (collection) => collection.id === panel.collectionId && collection.unitCode === originalCode,
          ),
      );
      const qualityIssues: string[] = [];
      if (
        !panels.length ||
        panels.some(
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
      if (panels.some((panel) => panel.result !== 'nonReactive' || globalScreeningResult(panel) !== 'nonReactive'))
        qualityIssues.push('inventoryScreeningUnsafe');
      const screeningResult = qualityIssues.includes('inventoryScreeningPending')
        ? 'pending'
        : panels.some((panel) => panel.result === 'reactive' || globalScreeningResult(panel) === 'reactive')
          ? 'reactive'
          : panels.some((panel) => panel.result === 'inconclusive' || globalScreeningResult(panel) === 'inconclusive')
            ? 'inconclusive'
            : qualityIssues.includes('inventoryScreeningUnsafe')
              ? 'pending'
              : 'nonReactive';
      const expiry = inventoryExpiry(unit.expiresAt);
      if (
        !expiry ||
        expiry < localDateTime().slice(0, 10) ||
        (unit.expiresAt.includes('T') && new Date(unit.expiresAt).getTime() <= Date.now())
      )
        qualityIssues.push('inventoryExpiryInvalid');
      if (!/^(A|B|AB|O)[+−-]$/.test(unit.bloodGroup) || !unit.component.trim() || !unit.location.trim())
        qualityIssues.push('inventoryIdentityIncomplete');
      return {
        ...summary(unit),
        status: seal?.stage === 'completed' && unit.status !== 'En laboratorio' ? 'APTO' : unit.status,
        originalCode,
        screeningResult,
        qualityIssues,
        ...(seal ? { sealId: seal.id } : {}),
        canDispose: !['En laboratorio', 'Reservada'].includes(unit.status),
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
      if (!current || JSON.stringify(summary(current)) !== JSON.stringify(summary(selected)))
        throw new Error('INVENTORY_CONFLICT');
      return summary(current);
    });
    const prefix = input.kind === 'qualitySeal' ? 'Q' : 'E';
    return {
      ...(previous ?? input),
      ...structuredClone(mutable(input)),
      units,
      causes: Object.fromEntries(units.map((unit) => [unit.id, input.causes[unit.id] ?? ''])),
      id: previous?.id ?? `${prefix}-DEMO-${String(workspace.operations.length + 1).padStart(5, '0')}`,
      revision: previous?.revision ?? 0,
      stage: 'draft',
      requestedAt: null,
      completedAt: null,
      outcome: undefined,
    };
  }
  function eligible(op: InventoryOperation, workspace: InventoryWorkspace) {
    if (validateInventoryOperation(op).length) throw new Error('INVALID_INVENTORY_FIELDS');
    for (const selected of op.units) {
      const current = workspace.units.find((unit) => unit.id === selected.id);
      if (!current || JSON.stringify(summary(current)) !== JSON.stringify(summary(selected)))
        throw new Error('INVENTORY_CONFLICT');
      if (
        op.kind === 'qualitySeal'
          ? current.status !== 'Cuarentena' ||
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
    if (action === 'printRequested') op.requestedAt = op.updatedAt;
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
    async requestSealPrint(input) {
      return transition(input, 'printRequested', 'qualitySeal');
    },
    async confirmSeal(input) {
      return transition(input, 'completed', 'qualitySeal');
    },
    async dispose(input) {
      return transition(input, 'completed', 'disposal');
    },
  };
}
