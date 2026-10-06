import type { InventoryStore } from '../sections/inventory/inventory.types';
import type { ProcessingState } from './mock-processing-store';

/** Same atomic session-storage document as extraction, screening and fractionation. */
export function inventoryStore(state: ProcessingState): InventoryStore {
  const store = structuredClone(state.inventory ?? { operations: [] });
  if (
    !Array.isArray(store.operations) ||
    new Set(store.operations.map((op) => op.id)).size !== store.operations.length ||
    store.operations.some(
      (op) =>
        !op.id ||
        !['qualitySeal', 'disposal'].includes(op.kind) ||
        !['draft', 'ready', 'printRequested', 'completed'].includes(op.stage) ||
        !Number.isInteger(op.revision) ||
        op.revision < 1 ||
        !Array.isArray(op.units) ||
        !op.units.length ||
        new Set(op.units.map((unit) => unit.id)).size !== op.units.length ||
        (op.kind === 'disposal' && !['draft', 'completed'].includes(op.stage)) ||
        (op.stage === 'completed' &&
          (!op.completedAt || op.outcome !== (op.kind === 'qualitySeal' ? 'APTO' : 'ELIMINADAS'))) ||
        (op.stage === 'printRequested' && !op.requestedAt),
    )
  )
    throw new Error('INVALID_INVENTORY_STORAGE');
  const sealed = store.operations
    .filter((op) => op.kind === 'qualitySeal' && op.stage !== 'draft')
    .flatMap((op) => op.units.map((unit) => unit.id));
  const disposed = store.operations
    .filter((op) => op.kind === 'disposal' && op.stage === 'completed')
    .flatMap((op) => op.units.map((unit) => unit.id));
  if (new Set(sealed).size !== sealed.length || new Set(disposed).size !== disposed.length)
    throw new Error('INVALID_INVENTORY_STORAGE');
  return store;
}
export function inventoryBlocksFractionation(state: ProcessingState, code: string): boolean {
  return inventoryStore(state).operations.some(
    (op) =>
      op.units.some((unit) => unit.id === code) &&
      (op.kind === 'qualitySeal' ? ['ready', 'printRequested'].includes(op.stage) : op.stage === 'completed'),
  );
}
