import { dashboardMock, inventoryMock } from '../mocks/blood-bank.mock';
import type { BloodBankApi } from './blood-bank.api';
import { createMockApplicantSelectionApi } from './mock-applicant-selection.api';
import { createMockProcessingApi } from './mock-blood-bank-processing.api';
import { readProcessingState } from './mock-processing-store';
import { readMockDonorDetails } from './mock-donors-store';
import { createMockFractionationApi, fractionationInventory, fractionationStore } from './mock-fractionation.api';

const copy = <T>(value: T): T => structuredClone(value);
const selection = createMockApplicantSelectionApi();
const processing = createMockProcessingApi(selection);

const donorDetails = () => readMockDonorDetails(() => globalThis.sessionStorage);

export const mockBloodBankApi: BloodBankApi = {
  selection,
  ...processing,
  fractionation: createMockFractionationApi(),
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
    const managed = fractionationStore(state).units.map((unit) => unit.id);
    const units = state.collections
      .filter((record) => record.unitStatus === 'quarantine')
      .filter((record) => !managed.includes(record.unitCode))
      .map((record) => ({
        id: record.unitCode,
        component: record.label.component,
        bloodGroup: `${record.application.physical.bloodGroup}${record.application.physical.rh}`,
        expiresAt: '—',
        location: record.label.service,
        status: 'Cuarentena' as const,
      }));
    return copy([
      ...units,
      ...inventoryMock.filter((unit) => !managed.includes(unit.id)),
      ...fractionationInventory(state),
    ]);
  },
};
