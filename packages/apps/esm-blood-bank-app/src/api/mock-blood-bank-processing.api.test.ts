import { beforeEach, describe, expect, it } from 'vitest';
import { mockBloodBankApi } from './mock-blood-bank.api';
import { createMockApplicantSelectionApi } from './mock-applicant-selection.api';
import { createMockProcessingApi } from './mock-blood-bank-processing.api';
import { processingStorageKey } from './mock-processing-store';
import { validateCollection, validVolume } from '../sections/collection/collection-rules';
import { collectionSteps, type CollectionRecord } from '../sections/collection/collection.types';
import {
  globalScreeningResult,
  localDateTime,
  validateScreening,
} from '../sections/laboratory/screening/screening-rules';
import { screeningTests, type ScreeningRecord } from '../sections/laboratory/screening/screening.types';
import { openmrsCollectionApi, openmrsScreeningApi } from './blood-bank-processing.api';

async function collectionFixture() {
  const selection = createMockApplicantSelectionApi();
  const api = createMockProcessingApi(selection);
  const record = (await api.collection.listCollections()).find((item) => item.status === 'pending');
  if (!record) throw new Error('SYNTHETIC_SELECTED_APPLICANT_MISSING');
  record.label = {
    ...record.label,
    component: 'Sangre DEMO',
    anticoagulant: 'CPDA DEMO',
    plannedVolume: '450',
    service: 'Banco DEMO',
    collectedBy: 'Recolector DEMO',
    sampleType: 'Sangre DEMO',
    sampleContainer: 'Tubo DEMO',
  };
  record.extractedVolume = '420';
  record.registry = {
    ...record.registry,
    bagLot: 'LOTE-DEMO',
    complications: 'no',
    extractionStatus: 'complete',
    attendedBy: 'Atención DEMO',
  };
  record.certificate.emailConsent = 'no';
  return { selection, api, record };
}
function completeScreening(record: ScreeningRecord) {
  record.identityVerified = true;
  record.receivedOn = localDateTime();
  record.receivedBy = 'Recepción DEMO';
  record.performedOn = localDateTime();
  record.performedBy = 'Laboratorio DEMO';
  record.validatedBy = 'Validador DEMO';
  for (const test of screeningTests)
    record.tests[test] = { result: 'nonReactive', reagent: 'Reactivo DEMO', brand: 'Marca DEMO', lot: 'Lote DEMO' };
  return record;
}
describe('collection and screening mock contracts', () => {
  beforeEach(() => sessionStorage.clear());
  it('only queues selected applicants, not admitted or excluded applicants', async () => {
    const { api } = await collectionFixture();
    const queued = (await api.collection.listCollections()).filter((item) => item.status !== 'completed');
    expect(queued).toHaveLength(1);
    expect(queued.every((item) => item.application.status === 'selected')).toBe(true);
  });
  it('preserves drafts across adapter recreation without generating a sample prematurely', async () => {
    const { api, selection, record } = await collectionFixture();
    const saved = await api.collection.saveCollection(record);
    expect(saved.revision).toBe(1);
    const recreated = createMockProcessingApi(selection);
    expect((await recreated.collection.listCollections()).find((item) => item.id === record.id)?.label.component).toBe(
      'Sangre DEMO',
    );
    expect((await recreated.screening.listScreenings()).some((item) => item.collectionId === record.id)).toBe(false);
  });
  it('creates exactly one sample at labeling and quarantines a unit only after volume capture', async () => {
    const { api, record } = await collectionFixture();
    let saved = await api.collection.saveCollection(record, 'label');
    expect(saved.unitStatus).toBe('prepared');
    saved = await api.collection.saveCollection(saved, 'label');
    expect((await api.screening.listScreenings()).filter((item) => item.collectionId === record.id)).toHaveLength(1);
    saved = await api.collection.saveCollection(saved, 'volume');
    expect(saved.unitStatus).toBe('quarantine');
  });
  it('prevents stage skipping, forged completion, stale updates and changed labels', async () => {
    const { api, record } = await collectionFixture();
    await expect(
      api.collection.saveCollection({ ...record, completedSteps: ['label', 'volume'] }, 'registry'),
    ).rejects.toThrow('COLLECTION_STAGE_ORDER');
    const saved = await api.collection.saveCollection(record, 'label');
    await expect(api.collection.saveCollection(record)).rejects.toThrow('COLLECTION_CONFLICT');
    await expect(
      api.collection.saveCollection({ ...saved, label: { ...saved.label, component: 'Otro' } }),
    ).rejects.toThrow('COLLECTION_LABEL_LOCKED');
    await expect(api.collection.saveCollection({ ...saved, unitCode: 'Otro' })).rejects.toThrow(
      'COLLECTION_IDENTITY_CONFLICT',
    );
  });
  it.each(['', '0', '-1', 'abc', '450.123', '1000000', '1e3'])('rejects invalid volumes: %s', (value) => {
    expect(validVolume(value)).toBe(false);
  });
  it('requires autologous recipient identification and consent before emailing', async () => {
    const { record } = await collectionFixture();
    record.application.admission.donationType = 'autologous';
    record.label.recipientName = '';
    record.label.recipientDocument = '';
    expect(validateCollection(record, 'label')).toEqual(expect.arrayContaining(['recipientName', 'recipientDocument']));
    record.certificate.emailConsent = 'yes';
    record.certificate.email = 'invalid';
    expect(validateCollection(record, 'certificate')).toContain('email');
  });
  it('finishes once, removes the application from active selection and keeps it in donation records', async () => {
    const { api, selection, record } = await collectionFixture();
    let saved: CollectionRecord = record;
    for (const step of collectionSteps) saved = await api.collection.saveCollection(saved, step);
    expect(saved.status).toBe('completed');
    expect((await selection.listApplications()).some((item) => item.id === record.application.id)).toBe(false);
    expect((await api.collection.listCollections()).find((item) => item.id === record.id)?.status).toBe('completed');
    const history = await selection.lookupApplicant({
      donorCode: `DON-${record.application.number}`,
      documentType: 'DNI',
      documentNumber: '',
    });
    expect(history?.personal?.givenName).toBe(record.application.personal.givenName);
    await expect(api.collection.saveCollection(saved, 'certificate')).rejects.toThrow('COLLECTION_NOT_AVAILABLE');
    expect(
      (await mockBloodBankApi.getDonors()).some(
        (donor) => donor.documentNumber === record.application.admission.documentNumber,
      ),
    ).toBe(true);
    expect((await mockBloodBankApi.getInventory()).find((unit) => unit.id === saved.unitCode)?.status).toBe(
      'Cuarentena',
    );
  });
  it('requires reception identification and complete results including reagent traceability', async () => {
    const { api } = await collectionFixture();
    const record = (await api.screening.listScreenings())[0];
    await expect(api.screening.saveScreening(record, 'reception')).rejects.toThrow('SCREENING_INCOMPLETE');
    completeScreening(record);
    record.tests.chagas.lot = '';
    expect(validateScreening(record, 'validation')).toContain('chagas');
    await expect(api.screening.saveScreening(record, 'validation')).rejects.toThrow('SCREENING_STAGE_ORDER');
  });
  it('validates reactive results without releasing the unit, confirming diagnosis or allowing edits', async () => {
    const { api } = await collectionFixture();
    let record = completeScreening((await api.screening.listScreenings())[0]);
    record.tests.hbsag.result = 'reactive';
    for (const step of ['reception', 'results', 'validation'] as const)
      record = await api.screening.saveScreening(record, step);
    expect(record.result).toBe('reactive');
    expect(record.validatedAt).not.toBeNull();
    await expect(api.screening.saveScreening(record)).rejects.toThrow('SCREENING_CONFLICT');
    expect((await api.collection.listCollections()).find((item) => item.id === record.collectionId)?.unitStatus).toBe(
      'quarantine',
    );
  });
  it('does not compute a final result when a mandatory test is missing', async () => {
    const { api } = await collectionFixture();
    const record = completeScreening((await api.screening.listScreenings())[0]);
    expect(globalScreeningResult(record)).toBe('nonReactive');
    record.tests.hiv.result = 'inconclusive';
    expect(globalScreeningResult(record)).toBe('inconclusive');
    record.tests.chagas.result = '';
    expect(globalScreeningResult(record)).toBe('');
  });
  it('rejects stale screening updates and modifications to recorded reception', async () => {
    const { api } = await collectionFixture();
    const record = completeScreening((await api.screening.listScreenings())[0]);
    const saved = await api.screening.saveScreening(record, 'reception');
    await expect(api.screening.saveScreening(record)).rejects.toThrow('SCREENING_CONFLICT');
    await expect(api.screening.saveScreening({ ...saved, receivedBy: 'Otro' })).rejects.toThrow(
      'SCREENING_RECEPTION_LOCKED',
    );
  });
  it('surfaces storage failure without a partial unit/sample write or false success', async () => {
    const { record } = await collectionFixture();
    const failure = createMockProcessingApi(createMockApplicantSelectionApi(), () => ({
      getItem: () => null,
      setItem: () => {
        throw new Error('STORAGE_FULL');
      },
    }));
    await expect(failure.collection.saveCollection(record, 'label')).rejects.toThrow('STORAGE_FULL');
    expect(sessionStorage.getItem(processingStorageKey)).toBeNull();
  });
  it('fails closed when mock mode is disabled rather than inventing backend calls', async () => {
    await expect(openmrsCollectionApi.listCollections()).rejects.toThrow('BACKEND_NOT_IMPLEMENTED');
    await expect(openmrsScreeningApi.listScreenings()).rejects.toThrow('BACKEND_NOT_IMPLEMENTED');
  });
});
