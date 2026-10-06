import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockApplicantSelectionApi } from './mock-applicant-selection.api';
import { createMockProcessingApi } from './mock-blood-bank-processing.api';
import { processingStorageKey, readProcessingState } from './mock-processing-store';
import { openmrsScreeningApi } from './blood-bank-processing.api';
import { applicationsMock } from '../mocks/applicant-selection.mock';
import { localDateTime, screeningCategory } from '../sections/laboratory/screening/screening-rules';
import { screeningTests } from '../sections/laboratory/screening/screening.types';

function fixture() {
  const applications = applicationsMock();
  const selection = {
    ...createMockApplicantSelectionApi(),
    listApplications: vi.fn(async () => structuredClone(applications)),
  };
  return { applications, selection, api: createMockProcessingApi(selection).screening };
}
describe('sample provenance and apheresis registration', () => {
  beforeEach(() => sessionStorage.clear());
  it('projects only ongoing apheresis applicants and never exposes interview or exclusion data', async () => {
    const { applications, api } = fixture();
    const candidates = await api.listApheresisCandidates();
    expect(candidates).toHaveLength(1);
    expect(candidates[0].applicationId).toBe(applications[0].id);
    expect(candidates[0]).not.toHaveProperty('interview');
    expect(candidates[0]).not.toHaveProperty('qualification');
    applications[0].status = 'deferred';
    expect(await api.listApheresisCandidates()).toEqual([]);
    applications[0].status = 'draft';
    expect(await api.listApheresisCandidates()).toEqual([]);
  });
  it('persists a canonical draft across adapter recreation without creating a sample', async () => {
    const { selection, api } = fixture();
    const candidate = (await api.listApheresisCandidates())[0];
    const before = await api.listScreenings();
    const saved = await api.saveApheresisDraft({ ...candidate, applicantName: 'FORGED' }, 0);
    expect(saved.candidate.applicantName).toBe(candidate.applicantName);
    expect(await createMockProcessingApi(selection).screening.getApheresisDraft()).toEqual(saved);
    expect(await api.listScreenings()).toEqual(before);
    await expect(api.saveApheresisDraft(candidate, 0)).rejects.toThrow('APHERESIS_DRAFT_CONFLICT');
  });
  it('registers one pending sample, supports idempotent retries, and does not create a unit or donation', async () => {
    const { api, applications } = fixture();
    const beforeApplications = structuredClone(applications);
    const candidate = (await api.listApheresisCandidates())[0];
    const draft = await api.saveApheresisDraft(candidate, 0);
    const before = readProcessingState(() => sessionStorage);
    const record = await api.registerApheresisSample(draft);
    expect(record.origin).toEqual({ type: 'apheresis', applicationId: candidate.applicationId });
    expect(record.sampleCode).toBe(`M-AF-${candidate.applicationNumber}`);
    expect(record.collectionId).toBe('');
    expect(record.unitCode).toBe('');
    expect(record.status).toBe('pending');
    expect(record.result).toBe('');
    expect(await api.getApheresisDraft()).toBeNull();
    expect(await api.registerApheresisSample(draft)).toEqual(record);
    expect((await api.listScreenings()).filter((item) => item.origin?.type === 'apheresis')).toHaveLength(1);
    expect(readProcessingState(() => sessionStorage).collections).toEqual(before.collections);
    expect(applications).toEqual(beforeApplications);
    expect(await api.listApheresisCandidates()).toEqual([]);
  });
  it.each([
    'changed',
    'excluded',
  ])('rejects an application that became %s after review without modifying storage', async (change) => {
    const { api, applications } = fixture();
    const draft = await api.saveApheresisDraft((await api.listApheresisCandidates())[0], 0);
    if (change === 'changed') applications[0].revision++;
    else applications[0].status = 'excluded';
    const before = sessionStorage.getItem(processingStorageKey);
    await expect(api.registerApheresisSample(draft)).rejects.toThrow('APHERESIS_REGISTRATION_CONFLICT');
    expect(sessionStorage.getItem(processingStorageKey)).toBe(before);
  });
  it('rejects a stale draft or registration without a persisted association', async () => {
    const { api } = fixture();
    const candidate = (await api.listApheresisCandidates())[0];
    await expect(api.registerApheresisSample({ candidate, revision: 0 })).rejects.toThrow(
      'APHERESIS_REGISTRATION_CONFLICT',
    );
    const draft = await api.saveApheresisDraft(candidate, 0);
    await api.saveApheresisDraft(candidate, draft.revision);
    await expect(api.registerApheresisSample(draft)).rejects.toThrow('APHERESIS_REGISTRATION_CONFLICT');
  });
  it('keeps draft and sample storage unchanged when the atomic write fails', async () => {
    const { api, selection } = fixture();
    const draft = await api.saveApheresisDraft((await api.listApheresisCandidates())[0], 0);
    const before = sessionStorage.getItem(processingStorageKey);
    const failing = createMockProcessingApi(selection, () => ({
      getItem: (key) => sessionStorage.getItem(key),
      setItem: () => {
        throw new Error('STORAGE_FULL');
      },
    })).screening;
    await expect(failing.registerApheresisSample(draft)).rejects.toThrow('STORAGE_FULL');
    expect(sessionStorage.getItem(processingStorageKey)).toBe(before);
    expect(await api.getApheresisDraft()).toEqual(draft);
  });
  it('preserves legacy unit samples and saved rows without resetting storage or injecting fixtures', async () => {
    const state = readProcessingState(() => sessionStorage);
    state.screenings = [state.screenings[0]];
    delete state.screenings[0].origin;
    delete state.apheresisDraft;
    sessionStorage.setItem(processingStorageKey, JSON.stringify(state));
    const before = sessionStorage.getItem(processingStorageKey);
    const { api } = fixture();
    expect(await api.listScreenings()).toEqual(state.screenings);
    expect(screeningCategory(state.screenings[0])).toBe('donors');
    expect(await api.getApheresisDraft()).toBeNull();
    expect(sessionStorage.getItem(processingStorageKey)).toBe(before);
    expect(screeningCategory({ ...state.screenings[0], collectionId: '', unitCode: '' })).toBeNull();
  });
  it('retains follow-up provenance throughout validation without forging a unit association', async () => {
    const { api } = fixture();
    let sample = (await api.listScreenings()).find((item) => screeningCategory(item) === 'followUps');
    if (!sample) throw new Error('SYNTHETIC_FOLLOW_UP_MISSING');
    sample.identityVerified = true;
    sample.receivedOn = localDateTime();
    sample.receivedBy = 'DEMO';
    sample.performedOn = localDateTime();
    sample.performedBy = 'DEMO';
    sample.validatedBy = 'DEMO';
    for (const test of screeningTests)
      sample.tests[test] = { result: 'nonReactive', reagent: 'DEMO', brand: 'DEMO', lot: 'DEMO' };
    const origin = sample.origin;
    for (const step of ['reception', 'results', 'validation'] as const)
      sample = await api.saveScreening({ ...sample, origin: { type: 'apheresis', applicationId: 'FORGED' } }, step);
    expect(sample.origin).toEqual(origin);
    expect(screeningCategory(sample)).toBe('followUps');
    expect(sample.unitCode).toBe('');
    expect(sample.status).toBe('validated');
  });
  it('fails closed for every proposed real apheresis endpoint', async () => {
    const candidate = (await fixture().api.listApheresisCandidates())[0];
    for (const call of [
      openmrsScreeningApi.listApheresisCandidates(),
      openmrsScreeningApi.getApheresisDraft(),
      openmrsScreeningApi.saveApheresisDraft(candidate, 0),
      openmrsScreeningApi.registerApheresisSample({ candidate, revision: 1 }),
    ])
      await expect(call).rejects.toThrow('BACKEND_NOT_IMPLEMENTED');
  });
});
