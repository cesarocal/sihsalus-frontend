import type { DashboardData, DonorSummary, InventorySummary } from '../types/blood-bank.types';
import type { ApplicantSelectionApi } from './applicant-selection.api';
import type { CollectionApi, ScreeningApi } from './blood-bank-processing.api';

/** Contrato estable entre las pantallas y cualquier implementación de datos. */
export interface BloodBankApi {
  selection: ApplicantSelectionApi;
  collection: CollectionApi;
  screening: ScreeningApi;
  getDashboard(): Promise<DashboardData>;
  getDonors(): Promise<DonorSummary[]>;
  getInventory(): Promise<InventorySummary[]>;
}
