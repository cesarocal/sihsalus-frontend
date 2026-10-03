import type { BloodBankApi } from './blood-bank.api';

/** Proposed OMOD read contracts, not yet enabled endpoints. The server must authorize donor access. */
export const donorEndpoints = {
  detail: (id: string) => `/ws/rest/v1/bloodbank/donors/${encodeURIComponent(id)}`,
  registry: '/ws/rest/v1/bloodbank/donations',
};

const unavailable = async (): Promise<never> => {
  throw new Error('DONOR_BACKEND_NOT_IMPLEMENTED');
};

export const openmrsDonorReadApi: Pick<BloodBankApi, 'getDonorDetail' | 'getDonorRegistry'> = {
  getDonorDetail: unavailable,
  getDonorRegistry: unavailable,
};
