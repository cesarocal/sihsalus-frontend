import { dashboardMock, donorsMock, inventoryMock } from '../mocks/blood-bank.mock';
import type { BloodBankApi } from './blood-bank.api';
import { createMockApplicantSelectionApi } from './mock-applicant-selection.api';
import { createMockProcessingApi } from './mock-blood-bank-processing.api';
import { readProcessingState } from './mock-processing-store';
import { fullName } from '../sections/collection/collection-rules';
import type { DonorSummary } from '../types/blood-bank.types';

const copy = <T>(value: T): T => structuredClone(value);
const selection = createMockApplicantSelectionApi();
const processing = createMockProcessingApi(selection);

export const mockBloodBankApi: BloodBankApi = {
  selection,
  ...processing,
  async getDashboard() {
    return copy(dashboardMock);
  },
  async getDonors() {
    const records = readProcessingState(() => globalThis.sessionStorage).collections.filter((record) =>
      record.completedSteps.includes('registry'),
    );
    const latestByIdentity = new Map<string, (typeof records)[number]>();
    for (const record of records.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt)))
      latestByIdentity.set(
        `${record.application.admission.documentType}:${record.application.admission.documentNumber}`,
        record,
      );
    return copy(
      [...latestByIdentity.values()]
        .map<DonorSummary>((record) => ({
          id: record.application.admission.donorCode || `DON-${record.application.number}`,
          documentNumber: record.application.admission.documentNumber,
          fullName: fullName(record.application),
          bloodGroup: `${record.application.physical.bloodGroup}${record.application.physical.rh}`,
          lastDonationDate: record.registry.date,
          status: 'En evaluación' as const,
        }))
        .concat(donorsMock),
    );
  },
  async getInventory() {
    const units = readProcessingState(() => globalThis.sessionStorage)
      .collections.filter((record) => record.unitStatus === 'quarantine')
      .map((record) => ({
        id: record.unitCode,
        component: record.label.component,
        bloodGroup: `${record.application.physical.bloodGroup}${record.application.physical.rh}`,
        expiresAt: '—',
        location: record.label.service,
        status: 'Cuarentena' as const,
      }));
    return copy([...units, ...inventoryMock]);
  },
};
