import { transfusionRequestsMock } from '../mocks/transfusions.mock';
import type { TransfusionStore } from '../sections/transfusions/transfusions.types';
import { transfusionStatusKeys } from '../sections/transfusions/transfusions-rules';
import type { ProcessingState } from './mock-processing-store';

export function transfusionStore(state: ProcessingState): TransfusionStore {
  const store = structuredClone(state.transfusions ?? { requests: [], bookEntries: [] });
  if (
    !Array.isArray(store.requests) ||
    !Array.isArray(store.bookEntries) ||
    new Set(store.requests.map((item) => item.id)).size !== store.requests.length ||
    new Set(store.bookEntries.map((item) => item.id)).size !== store.bookEntries.length ||
    store.requests.some(
      (item) =>
        !Number.isInteger(item.revision) || item.revision < 1 || !Object.hasOwn(transfusionStatusKeys, item.status),
    )
  )
    throw new Error('INVALID_TRANSFUSION_STORAGE');
  const ids = store.requests.flatMap((item) =>
    item.assignments.filter((assignment) => assignment.active).map((assignment) => assignment.unit.id),
  );
  if (new Set(ids).size !== ids.length) throw new Error('INVALID_TRANSFUSION_STORAGE');
  const savedRequestIds = new Set(store.requests.map((request) => request.id));
  store.requests.push(...transfusionRequestsMock().filter((request) => !savedRequestIds.has(request.id)));
  return store;
}
export function transfusionUnitState(state: ProcessingState, id: string): 'testing' | 'reserved' | 'delivered' | null {
  for (const request of state.transfusions?.requests ?? []) {
    const assignment = request.assignments.find((item) => item.active && item.unit.id === id);
    if (assignment) {
      if (request.deliveredAt || request.status === 'delivered') return 'delivered';
      return assignment.result === 'pending' && request.status !== 'readyUrgent' ? 'testing' : 'reserved';
    }
  }
  return null;
}
