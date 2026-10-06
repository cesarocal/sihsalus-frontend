import { dashboardMock } from '../mocks/blood-bank.mock';
import type { BloodBankApi } from './blood-bank.api';
import { createMockApplicantSelectionApi } from './mock-applicant-selection.api';
import { createMockProcessingApi } from './mock-blood-bank-processing.api';
import { readProcessingState } from './mock-processing-store';
import { readMockDonorDetails } from './mock-donors-store';
import { createMockFractionationApi } from './mock-fractionation.api';
import { createMockInventoryApi, inventoryWorkspace } from './mock-inventory.api';

const copy = <T>(value: T): T => structuredClone(value);
const selection = createMockApplicantSelectionApi();
const processing = createMockProcessingApi(selection);

const donorDetails = () => readMockDonorDetails(() => globalThis.sessionStorage);

export const mockBloodBankApi: BloodBankApi = {
  selection,
  ...processing,
  fractionation: createMockFractionationApi(),
  inventory: createMockInventoryApi(),
  async getDashboard() {
    return copy(dashboardMock);
  },
  async getDonors() {
    return copy(donorDetails().map((detail) => detail.summary));
  },
  async getDonorDetail(id) {
    const detail = donorDetails().find((item) => item.summary.id === id);
    if (!detail) throw new Error('DONOR_NOT_FOUND');
    return copy(detail);
  },
  async getDonorRegistry() {
    return copy(
      donorDetails()
        .flatMap((detail) => detail.donations)
        .sort((a, b) => b.date.localeCompare(a.date)),
    );
  },
  async getInventory() {
    const state = readProcessingState(() => globalThis.sessionStorage);
    return copy(inventoryWorkspace(state).units);
  },
};
