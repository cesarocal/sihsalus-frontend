import { applicationsMock } from '../mocks/applicant-selection.mock';
import { newCollection } from '../sections/collection/collection-rules';
import type { CollectionRecord } from '../sections/collection/collection.types';
import { localDateTime, newScreeningSample, newScreening } from '../sections/laboratory/screening/screening-rules';
import type { ApheresisDraft, ScreeningRecord } from '../sections/laboratory/screening/screening.types';
import type { FractionationStore } from '../sections/laboratory/fractionation/fractionation.types';

export const processingStorageKey = 'sihsalus.blood-bank.processing.mock.v1';
export type MockStorage = Pick<Storage, 'getItem' | 'setItem'>;
export interface ProcessingState {
  version: 1;
  collections: CollectionRecord[];
  screenings: ScreeningRecord[];
  apheresisDraft?: ApheresisDraft | null;
  fractionation?: FractionationStore;
}
function initialState(): ProcessingState {
  const application = applicationsMock().find((item) => item.status === 'selected');
  if (!application) throw new Error('MOCK_FIXTURE_MISSING');
  application.id = 'mock-processing-demo';
  application.number = 'DEMO-001';
  application.admission.documentNumber = '90000020';
  application.personal.givenName = 'Muestra';
  application.personal.familyName = 'Demostración';
  const collection = newCollection(application);
  collection.label = {
    ...collection.label,
    component: 'Sangre total (DEMO)',
    anticoagulant: 'CPDA-1 (DEMO)',
    plannedVolume: '450',
    service: 'Banco de sangre (DEMO)',
    collectedBy: 'Profesional DEMO',
    sampleType: 'Sangre (DEMO)',
    sampleContainer: 'Tubo (DEMO)',
  };
  collection.extractedVolume = '450';
  collection.registry = {
    ...collection.registry,
    bagLot: 'LOTE-DEMO',
    complications: 'no',
    extractionStatus: 'complete',
    attendedBy: 'Profesional DEMO',
  };
  collection.certificate.emailConsent = 'no';
  collection.completedSteps = ['label', 'volume', 'registry', 'certificate'];
  collection.status = 'completed';
  collection.unitStatus = 'quarantine';
  collection.revision = 1;
  collection.updatedAt = new Date().toISOString();
  const screening = newScreening(collection);
  // Start with a visible synthetic sample, without pre-filling clinical results.
  screening.collectedOn = `${localDateTime().slice(0, 10)}T00:00`;
  const followUp = newScreeningSample({
    id: 'mock-screening-follow-up-demo',
    origin: { type: 'followUp', followUpId: 'SEG-DEMO-001', subject: 'donor' },
    collectionId: '',
    unitCode: '',
    sampleCode: 'M-SEG-DEMO-001',
    applicationNumber: '',
    applicantName: 'Seguimiento Demostración',
    documentNumber: '90000021',
    sampleType: 'Sangre (DEMO)',
    sampleContainer: 'Tubo (DEMO)',
  });
  followUp.collectedOn = screening.collectedOn;
  return {
    version: 1,
    collections: [collection],
    screenings: [screening, followUp],
    apheresisDraft: null,
  };
}
export function readProcessingState(getStorage: () => MockStorage): ProcessingState {
  const raw = getStorage().getItem(processingStorageKey);
  if (!raw) return initialState();
  const state: ProcessingState = JSON.parse(raw);
  if (state.version !== 1 || !Array.isArray(state.collections) || !Array.isArray(state.screenings))
    throw new Error('INVALID_PROCESSING_MOCK_STORAGE');
  return state;
}
export function writeProcessingState(getStorage: () => MockStorage, state: ProcessingState) {
  getStorage().setItem(processingStorageKey, JSON.stringify(state));
}
