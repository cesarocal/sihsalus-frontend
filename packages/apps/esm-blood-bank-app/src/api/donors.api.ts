import { openmrsFetch } from '@openmrs/esm-framework';

import type { DonorDetail, DonorDonation } from '../types/blood-bank.types';
import type { BloodBankApi } from './blood-bank.api';

export const donorEndpoints = {
  detail: (id: string) => `/ws/rest/v1/bloodbank/donors/${encodeURIComponent(id)}`,
  registry: '/ws/rest/v1/bloodbank/donations',
};

export const openmrsDonorReadApi: Pick<BloodBankApi, 'getDonorDetail' | 'getDonorRegistry'> = {
  async getDonorDetail(id) {
    return (await openmrsFetch<DonorDetail>(donorEndpoints.detail(id))).data;
  },
  async getDonorRegistry() {
    return (await openmrsFetch<DonorDonation[]>(donorEndpoints.registry)).data;
  },
};
