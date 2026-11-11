import { beforeEach, describe, expect, it } from 'vitest';
import { localDateTime } from '../sections/laboratory/screening/screening-rules';
import { screeningResultsFixture } from '../sections/laboratory/screening/screening-test-fixtures';
import type { ScreeningResult } from '../sections/laboratory/screening/screening.types';
import type { FollowUpCase, FollowUpKind } from '../sections/follow-up/follow-up.types';
import { newFollowUp } from '../sections/follow-up/follow-up-rules';
import { createMockFollowUpApi } from './mock-follow-up.api';
import { createMockApplicantSelectionApi } from './mock-applicant-selection.api';
import { createMockProcessingApi } from './mock-blood-bank-processing.api';
import { processingStorageKey } from './mock-processing-store';
import { openmrsFollowUpApi } from './follow-up.api';

async function prepared(kind: FollowUpKind) {
  const api = createMockFollowUpApi();
  const workspace = await api.list(kind);
  let record = await api.save(workspace.cases[0], true);
  record.traces = workspace.traces.filter(
    (row) => (kind === 'donor' ? row.recipient.id : row.donor.id) === record.detection.person.id,
  );
  record = await api.save(record, true);
  record.subjects.forEach((s) => {
    s.notifiedOn = localDateTime();
    s.notifiedBy = 'Responsable DEMO';
    s.method = 'phone';
  });
  record = await api.save(record, true);
  return { api, record };
}
async function sampled(kind: FollowUpKind) {
  const setup = await prepared(kind);
  let record = setup.record;
  for (const id of record.subjects.map((s) => s.person.id)) {
    const subject = record.subjects.find((s) => s.person.id === id);
    if (!subject) throw new Error('TEST_SUBJECT_MISSING');
    subject.collectedBy = 'Colector DEMO';
    subject.identityVerified = true;
    record = await setup.api.registerSample(record, subject.person.id);
  }
  return { api: setup.api, record };
}
async function validateSamples(record: FollowUpCase, result: ScreeningResult = 'nonReactive') {
  const { screening } = createMockProcessingApi(createMockApplicantSelectionApi());
  for (const id of record.subjects.map((s) => s.sampleId)) {
    const initial = (await screening.listScreenings()).find((s) => s.id === id);
    if (!initial) throw new Error('TEST_SAMPLE_MISSING');
    let sample = await screening.saveScreening(
      {
        ...initial,
        identityVerified: true,
        receivedBy: 'Recepción DEMO',
        receivedOn: localDateTime(),
      },
      'reception',
    );
    sample = await screening.saveScreening(screeningResultsFixture(sample, result), 'results');
    await screening.saveScreening({ ...sample, validatedBy: 'Validador DEMO' }, 'validation');
  }
}

describe('follow-up cases, lab provenance and atomic closure', () => {
  beforeEach(() => sessionStorage.clear());
  it.each(['donor', 'recipient'] as const)('bounds %s detection notes on drafts and stage saves', async (kind) => {
    const api = createMockFollowUpApi();
    const record = (await api.list(kind)).cases[0];
    const atLimit = 'a'.repeat(500);
    record.detection.notes = atLimit;
    const saved = await api.save(record);
    expect(saved.detection.notes).toBe(atLimit);
    const before = sessionStorage.getItem(processingStorageKey);
    saved.detection.notes += 'a';
    await expect(api.save(saved)).rejects.toThrow('FOLLOW_UP_OBSERVATIONS_LIMIT');
    await expect(api.save(saved, true)).rejects.toThrow('FOLLOW_UP_OBSERVATIONS_LIMIT');
    expect(sessionStorage.getItem(processingStorageKey)).toBe(before);
  });
  it.each(['donor', 'recipient'] as const)(
    'persists the complete %s workflow and exposes closed reports without changing inventory',
    async (kind) => {
      const { api, record: initial } = await sampled(kind);
      const stateBefore = JSON.parse(sessionStorage.getItem(processingStorageKey) ?? '{}');
      expect(
        (await api.list(kind)).screenings.filter(
          (s) => s.origin?.type === 'followUp' && s.origin.followUpId === initial.id,
        ),
      ).toHaveLength(initial.subjects.length);
      await expect(api.save(initial, true)).rejects.toThrow('INCOMPLETE');
      await validateSamples(initial);
      let record = await api.save(initial, true);
      record.responsible = 'Responsable DEMO';
      record.conclusion = 'Investigación documentada DEMO';
      record.informedDoctorOn = localDateTime();
      if (kind === 'donor') record.informedDirectorOn = localDateTime();
      record.subjects.forEach((s) => {
        s.informedOn = localDateTime();
        s.informedBy = 'Profesional DEMO';
      });
      record = await api.close(record);
      expect(record.status).toBe('closed');
      expect(record.closedAt).toBeTruthy();
      expect((await createMockFollowUpApi().list(kind)).cases.find((c) => c.id === record.id)?.status).toBe('closed');
      const stateAfter = JSON.parse(sessionStorage.getItem(processingStorageKey) ?? '{}');
      expect(stateAfter.collections).toEqual(stateBefore.collections);
      expect(stateAfter.inventory).toEqual(stateBefore.inventory);
      await expect(api.save(record)).rejects.toThrow('CONFLICT');
    },
  );
  it.each(['reactive', 'inconclusive'] as const)(
    'requires documented second-test evidence after %s screening and preserves the original result',
    async (result) => {
      const { api, record: initial } = await sampled('donor');
      await validateSamples(initial, result);
      await expect(api.save(initial, true)).rejects.toThrow('INCOMPLETE');
      initial.subjects.forEach((s) => {
        s.confirmationBy = 'Confirmación DEMO';
        s.confirmationReference = 'Informe CONF-DEMO';
        s.confirmedOn = localDateTime();
        s.confirmationResult = 'nonReactive';
      });
      const record = await api.save(initial, true);
      expect(record.stage).toBe(4);
      expect((await api.list('donor')).screenings.find((s) => s.id === record.subjects[0].sampleId)?.result).toBe(
        result,
      );
    },
  );
  it('rejects partial tracing, fabricated relations, stale saves and editing completed detection', async () => {
    const api = createMockFollowUpApi();
    const w = await api.list('donor');
    const record = await api.save(w.cases[0], true);
    const before = sessionStorage.getItem(processingStorageKey);
    await expect(api.save({ ...record, traces: [w.traces[0]] }, true)).rejects.toThrow('TRACING_INCOMPLETE');
    await expect(api.save({ ...record, traces: [w.traces[2]] }, true)).rejects.toThrow('TRACE_NOT_AVAILABLE');
    await expect(
      api.save({
        ...record,
        detection: { ...record.detection, notes: 'tampered' },
      }),
    ).rejects.toThrow('DETECTION_LOCKED');
    await expect(api.save(w.cases[0])).rejects.toThrow('CONFLICT');
    expect(sessionStorage.getItem(processingStorageKey)).toBe(before);
  });
  it('keeps drafts across reload and allows no stage skipping or unconfirmed donor trigger', async () => {
    const api = createMockFollowUpApi();
    const draft = await api.save(newFollowUp('recipient'));
    expect((await createMockFollowUpApi().list('recipient')).cases.some((c) => c.id === draft.id)).toBe(true);
    await expect(api.save({ ...draft, stage: 3 }, true)).rejects.toThrow('STAGE_CONFLICT');
    const c = (await api.list('recipient')).cases.find((c) => c.detection.person.id);
    if (!c) throw new Error('FIXTURE_MISSING');
    await expect(api.save({ ...c, detection: { ...c.detection, confirmed: false } }, true)).rejects.toThrow(
      'INCOMPLETE',
    );
  });
  it('creates each sample once and records two identifiers and the collector', async () => {
    const { api, record } = await prepared('recipient');
    const subject = record.subjects[0];
    subject.collectedBy = 'Colector DEMO';
    subject.identityVerified = true;
    const first = await api.registerSample(record, subject.person.id);
    const retry = await api.registerSample(record, subject.person.id);
    expect(retry).toEqual(first);
    const samples = (await api.list('recipient')).screenings.filter((s) => s.id === first.subjects[0].sampleId);
    expect(samples).toHaveLength(1);
    expect(samples[0].documentNumber).toBe(subject.person.document);
    expect(samples[0].historyNumber).toBe(subject.person.history);
    expect(samples[0].collectedBy).toBe('Colector DEMO');
    expect(samples[0].unitCode).toBe('');
    expect((await api.list('donor')).screenings).toHaveLength(0);
  });
  it('keeps traced subject identity authoritative when a payload is edited', async () => {
    const { api, record } = await prepared('donor');
    const document = record.subjects[0].person.document;
    record.subjects[0].person = { ...record.subjects[0].person, document: 'INJECTED' };
    const saved = await api.save(record);
    expect(saved.subjects[0].person.document).toBe(document);
  });
  it('does not announce or persist success when storage fails', async () => {
    const api = createMockFollowUpApi(() => ({
      getItem: () => null,
      setItem: () => {
        throw new Error('QUOTA');
      },
    }));
    await expect(api.save(newFollowUp('donor'))).rejects.toThrow('QUOTA');
  });
  it('fails closed when the real backend is selected', async () => {
    await expect(openmrsFollowUpApi.list('donor')).rejects.toThrow('BACKEND_NOT_IMPLEMENTED');
  });
});
