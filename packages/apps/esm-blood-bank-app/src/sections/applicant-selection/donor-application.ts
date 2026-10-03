import type { DonorDetail } from '../../types/blood-bank.types';
import { newApplication } from './selection-rules';

/** Copy identity/demographics only; every donation needs a fresh clinical assessment. */
export function newApplicationForDonor(donor: DonorDetail) {
  const application = newApplication();
  return {
    ...application,
    patientUuid: donor.patientUuid,
    admission: {
      ...application.admission,
      donorCode: donor.summary.id,
      documentType: donor.documentType,
      documentNumber: donor.summary.documentNumber,
    },
    personal: {
      ...(donor.personal ?? application.personal),
      travelPlace: '',
      travelDuration: '',
      travelDate: '',
    },
  };
}

/** Router history carries an opaque reference, never demographics or clinical answers. */
export const donorApplicationState = (donorId: string) => ({ bloodBankDonorId: donorId });

export function donorIdFromNavigationState(state: unknown): string | null {
  if (!state || typeof state !== 'object' || !('bloodBankDonorId' in state)) return null;
  const id = state.bloodBankDonorId;
  return typeof id === 'string' && id.trim() && id.length <= 128 ? id : null;
}
