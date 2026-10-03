import type { CollectionRecord, CollectionStep } from '../sections/collection/collection.types';
import type { ScreeningRecord, ScreeningStep } from '../sections/laboratory/screening/screening.types';

export interface CollectionApi {
  listCollections(): Promise<CollectionRecord[]>;
  saveCollection(record: CollectionRecord, step?: CollectionStep): Promise<CollectionRecord>;
}
export interface ScreeningApi {
  listScreenings(): Promise<ScreeningRecord[]>;
  saveScreening(record: ScreeningRecord, step?: ScreeningStep): Promise<ScreeningRecord>;
}
/** Proposed OMOD contracts; these paths do not assert that a backend already exists. */
export const processingEndpoints = {
  collections: '/ws/rest/v1/bloodbank/collections',
  screenings: '/ws/rest/v1/bloodbank/screenings',
};
const unavailable = async (): Promise<never> => {
  throw new Error('BLOOD_BANK_PROCESSING_BACKEND_NOT_IMPLEMENTED');
};
export const openmrsCollectionApi: CollectionApi = { listCollections: unavailable, saveCollection: unavailable };
export const openmrsScreeningApi: ScreeningApi = { listScreenings: unavailable, saveScreening: unavailable };
