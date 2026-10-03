import { beforeEach, describe, expect, it } from 'vitest';
import { mockBloodBankApi } from './mock-blood-bank.api';
import { openmrsDonorReadApi, donorEndpoints } from './donors.api';
import { readProcessingState, writeProcessingState } from './mock-processing-store';
import { newApplicationForDonor } from '../sections/applicant-selection/donor-application';

describe('donor read contracts', () => {
  beforeEach(() => sessionStorage.clear());

  it('returns independent copies of donor demographics and dated donation history', async () => {
    const detail = await mockBloodBankApi.getDonorDetail('DON-0001');
    expect(detail.personal?.email).toBe('donante1@example.invalid');
    expect(detail.donations[0].unitCode).toBe('U-DEMO-HIST-1');
    detail.summary.fullName = 'Changed only in caller';
    detail.donations.length = 0;
    detail.adverseReactions.length = 0;
    expect((await mockBloodBankApi.getDonorDetail('DON-0001')).donations).toHaveLength(1);
    expect((await mockBloodBankApi.getDonorDetail('DON-0001')).adverseReactions).toHaveLength(1);
    expect((await mockBloodBankApi.getDonorDetail('DON-0002')).adverseReactions).toEqual([]);
    expect((await mockBloodBankApi.getDonors()).find((donor) => donor.id === 'DON-0001')?.fullName).toBe(
      'Ana Torres García',
    );
    await expect(mockBloodBankApi.getDonorDetail('missing')).rejects.toThrow('DONOR_NOT_FOUND');
  });

  it('keeps a stable donor identity with latest demographics and all donations, including the existing registry', async () => {
    const state = readProcessingState(() => sessionStorage);
    const first = structuredClone(state.collections[0]);
    first.id = 'mock-first-donation';
    first.application.number = 'DEMO-NEW-1';
    first.application.admission.documentNumber = '70000001';
    first.application.admission.donorCode = '';
    first.application.personal.givenName = 'Ana actualizada';
    first.registry.date = '2026-09-01';
    first.updatedAt = '2026-09-01T12:00:00Z';
    const latest = structuredClone(first);
    latest.id = 'mock-next-donation';
    latest.application.number = 'DEMO-NEW-2';
    latest.application.personal.email = 'actualizada@example.invalid';
    latest.registry.date = '2026-10-01';
    latest.updatedAt = '2026-10-01T12:00:00Z';
    state.collections.push(latest, first);
    writeProcessingState(() => sessionStorage, state);
    const donors = await mockBloodBankApi.getDonors();
    expect(donors.filter((donor) => donor.documentNumber === '70000001')).toHaveLength(1);
    const detail = await mockBloodBankApi.getDonorDetail('DON-0001');
    expect(detail.personal?.email).toBe('actualizada@example.invalid');
    expect(detail.summary.status).toBe('En evaluación');
    expect(detail.adverseReactions).toMatchObject([
      { id: 'mock-donor-reaction-1', reaction: 'dizziness', severity: 'mild' },
    ]);
    expect(detail.donations.map((donation) => donation.date)).toEqual(['2026-10-01', '2026-09-01', '2026-08-12']);
    expect(
      (await mockBloodBankApi.getDonorRegistry()).filter((donation) => donation.donorId === 'DON-0001'),
    ).toHaveLength(3);
    expect(detail).not.toHaveProperty('interview');
    expect(detail).not.toHaveProperty('qualification');
  });

  it('documents encoded endpoints but does not issue real requests before the OMOD exists', async () => {
    expect(donorEndpoints.detail('DON/1')).toBe('/ws/rest/v1/bloodbank/donors/DON%2F1');
    await expect(openmrsDonorReadApi.getDonorDetail('DON-0001')).rejects.toThrow('DONOR_BACKEND_NOT_IMPLEMENTED');
    await expect(openmrsDonorReadApi.getDonorRegistry()).rejects.toThrow('DONOR_BACKEND_NOT_IMPLEMENTED');
  });

  it('uses the same donor identities in Selection lookup and saves the prefilled draft without bypassing identity checks', async () => {
    const donor = await mockBloodBankApi.getDonorDetail('DON-0001');
    const application = newApplicationForDonor(donor);
    const history = await mockBloodBankApi.selection.lookupApplicant(application.admission);
    expect(history).toMatchObject({
      donorCode: donor.summary.id,
      documentType: 'DNI',
      documentNumber: '70000001',
      personal: { givenName: 'Ana' },
    });
    const saved = await mockBloodBankApi.selection.saveDraft(application);
    expect(saved.admission.donorCode).toBe('DON-0001');
    expect(saved.personal.givenName).toBe('Ana');
    const conflict = { ...application.admission, documentNumber: '70000002' };
    expect(await mockBloodBankApi.selection.lookupApplicant(conflict)).toEqual({ identityConflict: true });
    await expect(mockBloodBankApi.selection.saveDraft({ ...application, admission: conflict })).rejects.toThrow(
      'IDENTITY_CONFLICT',
    );
  });
});
