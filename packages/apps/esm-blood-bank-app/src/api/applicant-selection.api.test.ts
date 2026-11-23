import { openmrsFetch } from '@openmrs/esm-framework';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { newApplication } from '../sections/applicant-selection/selection-rules';
import { applicantSelectionEndpoints, openmrsApplicantSelectionApi } from './applicant-selection.api';

vi.mock('@openmrs/esm-framework', () => ({ openmrsFetch: vi.fn() }));

const fetchMock = vi.mocked(openmrsFetch);

describe('real applicant-selection adapter', () => {
  beforeEach(() => fetchMock.mockReset());

  it('creates and updates drafts through the OMOD without inventing server identifiers', async () => {
    const draft = newApplication();
    const created = { ...draft, id: 'server-uuid', number: '000001', revision: 1 };
    fetchMock.mockResolvedValueOnce({ data: created } as never);
    expect(await openmrsApplicantSelectionApi.saveDraft(draft)).toEqual(created);
    expect(fetchMock).toHaveBeenCalledWith(applicantSelectionEndpoints.applications, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: draft,
    });

    fetchMock.mockResolvedValueOnce({ data: { ...created, revision: 2 } } as never);
    await openmrsApplicantSelectionApi.saveDraft(created);
    expect(fetchMock).toHaveBeenLastCalledWith(applicantSelectionEndpoints.draft('server-uuid'), {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: created,
    });
  });

  it('completes admission atomically, then registers a patient and visit at the personal step', async () => {
    const input = newApplication();
    const saved = { ...input, id: 'server-uuid', revision: 2, status: 'admitted' as const };
    fetchMock.mockResolvedValueOnce({ data: saved } as never);
    expect(await openmrsApplicantSelectionApi.completeStep(input, 'admission')).toEqual(saved);
    expect(fetchMock).toHaveBeenCalledWith(applicantSelectionEndpoints.admitNew, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: input,
    });
    fetchMock.mockResolvedValueOnce({
      data: { ...saved, revision: 3, patientUuid: 'patient-uuid', visitUuid: 'visit-uuid' },
    } as never);
    await expect(openmrsApplicantSelectionApi.completeStep(saved, 'personal')).resolves.toMatchObject({
      patientUuid: 'patient-uuid',
      visitUuid: 'visit-uuid',
    });
    expect(fetchMock).toHaveBeenLastCalledWith(applicantSelectionEndpoints.step('server-uuid'), {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: { step: 'personal', application: saved },
    });
    const afterPhysical = { ...saved, revision: 4, status: 'awaitingInterview' as const };
    fetchMock.mockResolvedValueOnce({ data: afterPhysical } as never);
    await expect(openmrsApplicantSelectionApi.completeStep(saved, 'physical')).resolves.toEqual(afterPhysical);
    expect(fetchMock).toHaveBeenLastCalledWith(applicantSelectionEndpoints.step('server-uuid'), {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: { step: 'physical', application: saved },
    });

    fetchMock.mockResolvedValueOnce({ data: { ...afterPhysical, status: 'selected' } } as never);
    await openmrsApplicantSelectionApi.finalizeSelection(afterPhysical);
    expect(fetchMock).toHaveBeenLastCalledWith(applicantSelectionEndpoints.finalize('server-uuid'), {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: afterPhysical,
    });
  });

  it('looks up exact identity through the protected OMOD endpoint', async () => {
    fetchMock.mockResolvedValueOnce({ data: null } as never);
    await expect(
      openmrsApplicantSelectionApi.lookupApplicant({
        documentType: 'DNI',
        documentNumber: ' 12345678 ',
        donorCode: '',
      }),
    ).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      `${applicantSelectionEndpoints.history}?documentType=DNI&documentNumber=12345678&donorCode=`,
    );
  });
});
