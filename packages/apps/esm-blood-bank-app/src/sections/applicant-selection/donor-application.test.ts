import { describe, expect, it } from 'vitest';
import { donorDetailsMock } from '../../mocks/donors.mock';
import { donorApplicationState, donorIdFromNavigationState, newApplicationForDonor } from './donor-application';

describe('donor application prefill', () => {
  it.each([
    'DNI',
    'CE',
    'PASSPORT',
  ] as const)('copies %s identity and editable demographics, not past assessments', (documentType) => {
    const donor = structuredClone(donorDetailsMock[0]);
    donor.documentType = documentType;
    donor.patientUuid = 'synthetic-patient-reference';
    if (!donor.personal) throw new Error('Missing synthetic demographics');
    donor.personal.travelPlace = 'Past trip';
    donor.personal.travelDuration = '20';
    donor.personal.travelDate = '2026-01-01';
    const application = newApplicationForDonor(donor);
    expect(application.admission).toMatchObject({
      donorCode: 'DON-0001',
      documentType,
      documentNumber: '70000001',
      donationType: '',
      modality: '',
    });
    expect(application.personal).toMatchObject({
      givenName: 'Ana',
      email: 'donante1@example.invalid',
      travelPlace: '',
      travelDuration: '',
      travelDate: '',
    });
    expect(application.patientUuid).toBe('synthetic-patient-reference');
    expect(application.visitUuid).toBeUndefined();
    expect(application.id).toBe('');
    expect(application.number).toBe('');
    expect(application.completedSteps).toEqual([]);
    expect(application.physical.weight).toBe('');
    expect(application.physical.bloodGroup).toBe('');
    expect(application.interview.answers).toEqual({});
    expect(application.qualification.result).toBe('');
    application.personal.givenName = 'Editable';
    expect(donor.personal.givenName).toBe('Ana');
  });

  it('leaves unknown demographics blank instead of splitting a display name', () => {
    const application = newApplicationForDonor({ ...donorDetailsMock[0], personal: null });
    expect(application.personal.givenName).toBe('');
    expect(application.admission.documentNumber).toBe('70000001');
  });

  it('transports only the donor reference in router state and rejects malformed references', () => {
    const state = donorApplicationState('DON-0001');
    expect(state).toEqual({ bloodBankDonorId: 'DON-0001' });
    expect(donorIdFromNavigationState(state)).toBe('DON-0001');
    for (const invalid of [
      null,
      undefined,
      'DON-0001',
      {},
      { bloodBankDonorId: 1 },
      { bloodBankDonorId: '' },
      { bloodBankDonorId: ' ' },
      { bloodBankDonorId: 'x'.repeat(129) },
    ]) {
      expect(donorIdFromNavigationState(invalid)).toBeNull();
    }
  });
});
