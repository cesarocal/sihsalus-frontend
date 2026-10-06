import type {
  DashboardData,
  DonorDetail,
  DonorDonation,
  DonorSummary,
  InventorySummary,
} from '../types/blood-bank.types';
import type { ApplicantSelectionApi } from './applicant-selection.api';
import type { CollectionApi, ScreeningApi } from './blood-bank-processing.api';
import type { FractionationApi } from './fractionation.api';
import type { InventoryApi } from './inventory.api';

/** Contrato estable entre las pantallas y cualquier implementación de datos. */
export interface BloodBankApi {
  selection: ApplicantSelectionApi;
  collection: CollectionApi;
  screening: ScreeningApi;
  fractionation: FractionationApi;
  inventory: InventoryApi;
  getDashboard(): Promise<DashboardData>;
  getDonors(): Promise<DonorSummary[]>;
  getDonorDetail(id: string): Promise<DonorDetail>;
  getDonorRegistry(): Promise<DonorDonation[]>;
  getInventory(): Promise<InventorySummary[]>;
}
