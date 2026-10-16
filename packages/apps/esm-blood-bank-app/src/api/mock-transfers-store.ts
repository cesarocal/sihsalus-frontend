import { transferRequestsMock } from '../mocks/transfers.mock';
import type { TransferStore } from '../sections/transfers/transfers.types';
import { transferDirection } from '../sections/transfers/transfers-rules';
import type { ProcessingState } from './mock-processing-store';

export function transferStore(state: ProcessingState): TransferStore {
  const store = structuredClone(state.transfers ?? { requests: transferRequestsMock(), bookEntries: [] });
  if (
    !Array.isArray(store.requests) ||
    !Array.isArray(store.bookEntries) ||
    new Set(store.requests.map((item) => item.id)).size !== store.requests.length ||
    new Set(store.bookEntries.map((item) => item.id)).size !== store.bookEntries.length ||
    store.requests.some(
      (item) =>
        !item.id ||
        !Number.isInteger(item.revision) ||
        item.revision < 1 ||
        (item.direction !== undefined && !['incoming', 'outgoing'].includes(item.direction)) ||
        !(
          transferDirection(item) === 'outgoing'
            ? ['draft', 'issued']
            : ['draft', 'received', 'prepared', 'delivered', 'rejected']
        ).includes(item.status) ||
        (transferDirection(item) === 'outgoing' &&
          (item.preparation?.unitIds.length || item.certificateUnits.length)) ||
        !Array.isArray(item.preparation?.unitIds),
    )
  )
    throw new Error('INVALID_TRANSFER_STORAGE');
  const committed = store.requests
    .filter((item) => ['prepared', 'delivered'].includes(item.status))
    .flatMap((item) => item.preparation.unitIds);
  if (new Set(committed).size !== committed.length) throw new Error('INVALID_TRANSFER_STORAGE');
  return store;
}
export function transferUnitState(state: ProcessingState, code: string): 'prepared' | 'delivered' | null {
  // Avoid creating defaults or reading other data when no transfer has ever been saved.
  const request = state.transfers?.requests.find(
    (item) =>
      transferDirection(item) === 'incoming' &&
      ['prepared', 'delivered'].includes(item.status) &&
      item.preparation.unitIds.includes(code),
  );
  return request?.status === 'prepared' ? 'prepared' : request?.status === 'delivered' ? 'delivered' : null;
}
