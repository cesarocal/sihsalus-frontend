import type { InventoryUnit } from '../inventory/inventory.types';
import type { ComponentType } from '../laboratory/fractionation/fractionation.types';
import type { ScreeningResult, ScreeningTest } from '../laboratory/screening/screening.types';

export type TransferDirection = 'incoming' | 'outgoing';
export type TransferStatus = 'draft' | 'received' | 'prepared' | 'delivered' | 'rejected' | 'issued';
export interface TransferItem {
  id: string;
  component: ComponentType;
  quantity: number;
  bloodGroup: string;
}
export interface TransferRequestData {
  office: string;
  date: string;
  channel: 'email' | 'paper' | 'api';
  externalId: string;
  requestingInstitution: string;
  destinationInstitution: string;
  requestingDirector: string;
  addressedDirector: string;
  attention: string;
  requestingAttention: string;
  contact: string;
  patientName: string;
  patientAge: string;
  patientDocument: string;
  patientHistory: string;
  patientBloodGroup: string;
  ward: string;
  bed: string;
  requestingDoctor: string;
  requestingDoctorLicense: string;
  diagnosis: string;
  transfusionReason: string;
  transferReason: string;
  maxCollectionAgeDays: number | null;
  items: TransferItem[];
}
export interface TransferPreparation {
  unitIds: string[];
  certificateOffice: string;
  responsible: string;
  evaluationVerified: boolean;
}
export interface TransferDelivery {
  collectorName: string;
  collectorDocument: string;
  deliveredBy: string;
  transportVerified: boolean;
}
/** A read projection only. ABO matching is not a crossmatch result. */
export interface TransferUnit extends InventoryUnit {
  componentType: ComponentType | null;
  collectedOn: string;
  bagLot: string;
  screening: Record<ScreeningTest, ScreeningResult>;
}
export interface TransferRequest {
  id: string;
  revision: number;
  /** Omitted in previously saved mocks; those records are incoming requests. */
  direction?: TransferDirection;
  status: TransferStatus;
  data: TransferRequestData;
  preparation: TransferPreparation;
  delivery: TransferDelivery;
  certificateUnits: TransferUnit[];
  createdAt: string;
  updatedAt: string;
  preparedAt: string | null;
  deliveredAt: string | null;
  pickupRecordedAt: string | null;
  rejectionReason: string;
}
/** Administrative transfer entry, never a record that blood was administered. */
export interface TransferBookEntry {
  id: string;
  kind: 'transfer';
  unitStatus: 'TRANSFERIDO';
  requestId: string;
  requestOffice: string;
  certificateOffice: string;
  date: string;
  requestingInstitution: string;
  patientName: string;
  patientHistory: string;
  service: string;
  requestingDoctor: string;
  requestingDoctorLicense: string;
  diagnosis: string;
  unitCode: string;
  seal: string;
  component: ComponentType;
  bloodGroup: string;
  bagLot: string;
  collectedOn: string;
  screening: Record<ScreeningTest, ScreeningResult>;
  collectorName: string;
  collectorDocument: string;
  deliveredBy: string;
}
export interface TransferStore {
  requests: TransferRequest[];
  bookEntries: TransferBookEntry[];
}
export interface TransferWorkspace extends TransferStore {
  units: TransferUnit[];
}
