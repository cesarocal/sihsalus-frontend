import { openmrsFetch } from '@openmrs/esm-framework';

import type { DashboardData, DonorSummary, InventorySummary } from '../types/blood-bank.types';
import type { BloodBankApi } from './blood-bank.api';
import { openmrsApplicantSelectionApi } from './applicant-selection.api';
import { openmrsCollectionApi, openmrsScreeningApi } from './blood-bank-processing.api';
import { openmrsDonorReadApi } from './donors.api';

const apiBase = '/ws/rest/v1/bloodbank';

export const openmrsBloodBankApi: BloodBankApi = {
  ...openmrsDonorReadApi,
  selection: openmrsApplicantSelectionApi,
  collection: openmrsCollectionApi,
  screening: openmrsScreeningApi,
  async getDashboard() {
    const response = await openmrsFetch<DashboardData>(`${apiBase}/dashboard`);
    return response.data;
  },
  async getDonors() {
    const response = await openmrsFetch<DonorSummary[]>(`${apiBase}/donors`);
    return response.data;
  },
  async getInventory() {
    const response = await openmrsFetch<InventorySummary[]>(`${apiBase}/inventory`);
    return response.data;
  },
};
