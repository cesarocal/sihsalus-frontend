import { transfusionRequestsMock } from '../mocks/transfusions.mock';
import type { TransfusionStore } from '../sections/transfusions/transfusions.types';
import { transfusionStatusKeys } from '../sections/transfusions/transfusions-rules';
import type { ProcessingState } from './mock-processing-store';

export function transfusionStore(state: ProcessingState): TransfusionStore {
  const store = structuredClone(state.transfusions ?? { requests: [], bookEntries: [] });
  const returns = store.returns ?? [];
  if (
    !Array.isArray(store.requests) ||
    !Array.isArray(store.bookEntries) ||
    !Array.isArray(returns) ||
    new Set(returns.map((entry) => entry.dispatchId)).size !== returns.length ||
    returns.some((entry) => !store.bookEntries.some(({ id }) => id === entry.dispatchId)) ||
    new Set(store.requests.map((item) => item.id)).size !== store.requests.length ||
    new Set(store.bookEntries.map((item) => item.id)).size !== store.bookEntries.length ||
    store.requests.some(
      (item) =>
        !Number.isInteger(item.revision) || item.revision < 1 || !Object.hasOwn(transfusionStatusKeys, item.status),
    )
  )
    throw new Error('INVALID_TRANSFUSION_STORAGE');
  const approved = new Set(
    returns.filter((entry) => entry.inspection?.decision === 'approved').map((entry) => entry.dispatchId),
  );
  const ids = store.requests.flatMap((item) =>
    item.assignments
      .filter((assignment) => assignment.active && !approved.has(`${item.id}/${assignment.unit.id}`))
      .map((assignment) => assignment.unit.id),
  );
  if (new Set(ids).size !== ids.length) throw new Error('INVALID_TRANSFUSION_STORAGE');
  const savedRequestIds = new Set(store.requests.map((request) => request.id));
  store.requests.push(...transfusionRequestsMock().filter((request) => !savedRequestIds.has(request.id)));
  return { ...store, returns };
}
export function transfusionUnitState(
  state: ProcessingState,
  id: string,
): 'testing' | 'reserved' | 'delivered' | 'returnInspection' | 'returnRejected' | null {
  for (const request of state.transfusions?.requests ?? []) {
    const assignment = request.assignments.find((item) => item.active && item.unit.id === id);
    if (assignment) {
      if (request.deliveredAt || request.status === 'delivered') {
        const returned = state.transfusions?.returns?.find((entry) => entry.dispatchId === `${request.id}/${id}`);
        if (returned?.inspection?.decision === 'approved') continue;
        if (returned?.inspection?.decision === 'rejected') return 'returnRejected';
        return returned ? 'returnInspection' : 'delivered';
      }
      return assignment.result === 'pending' && request.status !== 'readyUrgent' ? 'testing' : 'reserved';
    }
  }
  return null;
}
