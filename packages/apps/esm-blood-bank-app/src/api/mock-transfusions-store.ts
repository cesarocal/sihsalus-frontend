import { transfusionRequestsMock } from '../mocks/transfusions.mock';
import type { TransfusionStore } from '../sections/transfusions/transfusions.types';
import type { ProcessingState } from './mock-processing-store';

export function transfusionStore(state: ProcessingState): TransfusionStore {
  const store = structuredClone(state.transfusions ?? { requests: transfusionRequestsMock(), bookEntries: [] });
  if (
    !Array.isArray(store.requests) ||
    !Array.isArray(store.bookEntries) ||
    new Set(store.requests.map((item) => item.id)).size !== store.requests.length ||
    new Set(store.bookEntries.map((item) => item.id)).size !== store.bookEntries.length ||
    store.requests.some(
      (item) =>
        !Number.isInteger(item.revision) ||
        item.revision < 1 ||
        !['pending', 'reviewed', 'sampleReady', 'testing', 'incompatible', 'compatible', 'delivered'].includes(
          item.status,
        ),
    )
  )
    throw new Error('INVALID_TRANSFUSION_STORAGE');
  const ids = store.requests.flatMap((item) =>
    item.assignments.filter((assignment) => assignment.active).map((assignment) => assignment.unit.id),
  );
  if (new Set(ids).size !== ids.length) throw new Error('INVALID_TRANSFUSION_STORAGE');
  return store;
}
export function transfusionUnitState(state: ProcessingState, id: string): 'testing' | 'reserved' | 'delivered' | null {
  for (const request of state.transfusions?.requests ?? []) {
    const assignment = request.assignments.find((item) => item.active && item.unit.id === id);
    if (assignment)
      return request.status === 'delivered' ? 'delivered' : assignment.result === 'pending' ? 'testing' : 'reserved';
  }
  return null;
}
