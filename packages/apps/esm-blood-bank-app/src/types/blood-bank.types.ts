import type { AdmissionData, PersonalData } from '../sections/applicant-selection/selection.types';
import type { DonationRegistry } from '../sections/collection/collection.types';

export type WorkItemStatus = 'Pendiente' | 'En proceso' | 'Completado' | 'Alerta';

export interface DashboardMetric {
  id: string;
  labelKey: string;
  defaultLabel: string;
  value: number;
}

export interface WorkItem {
  id: string;
  section: string;
  description: string;
  status: WorkItemStatus;
}

export interface DonorSummary {
  id: string;
  documentNumber: string;
  fullName: string;
  bloodGroup: string;
  lastDonationDate: string;
  status: 'Apto' | 'Diferido' | 'En evaluación';
}

export interface InventorySummary {
  id: string;
  component: string;
  bloodGroup: string;
  expiresAt: string;
  location: string;
  status: 'Disponible' | 'Reservada' | 'Cuarentena' | 'En laboratorio' | 'APTO';
}

/** Read-only projection; never includes interview answers or deferral reasons. */
export interface DonorDonation {
  id: string;
  donorId: string;
  documentNumber: string;
  fullName: string;
  applicationNumber: string;
  date: string;
  modality: 'wholeBlood' | 'apheresis';
  unitCode: string;
  bagLot: string;
  extractedVolume: string;
  complications: DonationRegistry['complications'];
  extractionStatus: DonationRegistry['extractionStatus'];
  attendedBy: string;
}

/** Provisional, read-only UI projection; not a finalized clinical/API schema. */
export interface DonorAdverseReaction {
  id: string;
  date: string;
  unitCode: string;
  reaction: 'dizziness';
  severity: 'mild' | 'moderate' | 'severe';
}

export interface DonorDetail {
  summary: DonorSummary;
  documentType: AdmissionData['documentType'];
  patientUuid?: string;
  personal: PersonalData | null;
  donations: DonorDonation[];
  adverseReactions: DonorAdverseReaction[];
}

export interface DashboardData {
  metrics: DashboardMetric[];
  workItems: WorkItem[];
}
