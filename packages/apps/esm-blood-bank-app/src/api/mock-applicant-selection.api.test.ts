import { beforeEach, describe, expect, it } from 'vitest';
import { validApplication } from '../sections/applicant-selection/selection.test-helpers';
import { selectionSteps } from '../sections/applicant-selection/selection.types';
import { createMockApplicantSelectionApi, selectionStorageKey } from './mock-applicant-selection.api';

describe('applicant selection mock API', () => {
  beforeEach(() => sessionStorage.clear());

  it('persists incomplete drafts across adapter recreation and increments application numbers', async () => {
    const api = createMockApplicantSelectionApi();
    const a = validApplication();
    a.personal.givenName = '';
    const first = await api.saveDraft(a);
    expect(first.number).toBe('000005');
    expect(first.status).toBe('draft');
    const second = await createMockApplicantSelectionApi().saveDraft(validApplication());
    expect(second.number).toBe('000006');
    expect(
      (await createMockApplicantSelectionApi().listApplications()).find((row) => row.id === first.id)?.personal
        .givenName,
    ).toBe('');
  });

  it('separates admission, interview queue and final selection; final saves cannot duplicate', async () => {
    const api = createMockApplicantSelectionApi();
    let a = validApplication();
    for (const step of selectionSteps.slice(0, -1)) {
      a = await api.completeStep(a, step);
      if (step === 'admission') expect(a.status).toBe('admitted');
      if (step === 'physical') expect(a.status).toBe('awaitingInterview');
    }
    const selected = await api.finalizeSelection(a);
    expect(selected.status).toBe('selected');
    await expect(api.finalizeSelection(selected)).rejects.toThrow('APPLICATION_CONFLICT');
    expect((await api.listApplications()).filter((row) => row.id === selected.id)).toHaveLength(1);
  });

  it('prevents out-of-order stages, stale updates and editing closed examination fields', async () => {
    const api = createMockApplicantSelectionApi();
    let a = validApplication();
    await expect(api.completeStep(a, 'physical')).rejects.toThrow('STAGE_ORDER');
    const saved = await api.saveDraft(a);
    await expect(api.saveDraft({ ...saved, revision: 0 })).rejects.toThrow('APPLICATION_CONFLICT');
    a = saved;
    for (const step of ['admission', 'personal', 'physical'] as const) a = await api.completeStep(a, step);
    a.physical.weight = '71';
    await expect(api.saveDraft(a)).rejects.toThrow('LOCKED_SECTION');
  });

  it('can stop after examination and save/print an exclusion without interview', async () => {
    const api = createMockApplicantSelectionApi();
    let a = validApplication();
    a.stoppedAfterPhysical = true;
    a.interview.answers = {};
    Object.assign(a.qualification, { result: 'temporary', duration: '30', reason: 'Motivo de prueba' });
    for (const step of ['admission', 'personal', 'physical', 'qualification'] as const)
      a = await api.completeStep(a, step);
    expect(a.status).toBe('awaitingQualification');
    const excluded = await api.finalizeSelection(a);
    expect(excluded.status).toBe('deferred');
    expect(excluded.returnDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(excluded.completedSteps).not.toContain('interview');
  });

  it.each(['DEMO-002', 'DEMO-003'])('blocks eligible selection with active history %s', async (code) => {
    const api = createMockApplicantSelectionApi();
    let a = validApplication();
    a.admission.donorCode = code;
    a.admission.documentNumber = code === 'DEMO-002' ? '90000002' : '90000003';
    for (const step of selectionSteps.slice(0, -1)) a = await api.completeStep(a, step);
    await expect(api.finalizeSelection(a)).rejects.toThrow('SELECTION_NOT_READY');
  });

  it('looks up by ID, detects mismatched donor identity and never exposes exclusion reasons', async () => {
    const api = createMockApplicantSelectionApi();
    const history = await api.lookupApplicant({ documentType: 'DNI', documentNumber: '90000002', donorCode: '' });
    expect(history?.exclusion).toEqual({ kind: 'temporary', returnDate: '2099-12-31' });
    expect(history?.personal?.sex).toBe('F');
    expect(history).not.toHaveProperty('reason');
    expect(
      await api.lookupApplicant({ documentType: 'DNI', documentNumber: '90000002', donorCode: 'DEMO-001' }),
    ).toEqual({ identityConflict: true });
  });

  it('returns cloned records, not references to the stored state', async () => {
    const api = createMockApplicantSelectionApi();
    const first = await api.listApplications();
    first[0].personal.givenName = 'Mutated';
    expect((await api.listApplications())[0].personal.givenName).not.toBe('Mutated');
  });

  it('propagates storage failure and refuses corrupted state instead of claiming success', async () => {
    const api = createMockApplicantSelectionApi(() => ({
      getItem: () => null,
      setItem: () => {
        throw new Error('STORAGE_FULL');
      },
    }));
    await expect(api.saveDraft(validApplication())).rejects.toThrow('STORAGE_FULL');
    sessionStorage.setItem(selectionStorageKey, '{bad json');
    await expect(createMockApplicantSelectionApi().listApplications()).rejects.toThrow();
  });
});
