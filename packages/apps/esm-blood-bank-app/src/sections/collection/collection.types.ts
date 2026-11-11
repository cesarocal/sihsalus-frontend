import type { SelectionApplication } from '../applicant-selection/selection.types';

export const collectionSteps = ['label', 'volume', 'registry', 'certificate'] as const;
export type CollectionStep = (typeof collectionSteps)[number];
export type CollectionConceptField = 'anticoagulant' | 'service';
export interface CollectionConcept {
  uuid: string;
  display: string;
}
export interface CollectionLabel {
  component: string;
  anticoagulant: string;
  anticoagulantConceptUuid?: string;
  preservative: string;
  sedimentingAgent: string;
  /** Historical label value used by fractionation as the recorded nominal capacity. */
  plannedVolume?: string;
  service: string;
  serviceConceptUuid?: string;
  collectedBy: string;
  leukocytesReduced: boolean;
  recipientName: string;
  recipientDocument: string;
  recipientService: string;
  recipientHistory: string;
  sampleType: string;
  sampleContainer: string;
}
export interface DonationRegistry {
  date: string;
  bagLot: string;
  complications: '' | 'yes' | 'no';
  extractionStatus: '' | 'complete' | 'incomplete';
  attendedBy: string;
  /** Notes from older records, retained when a draft is resumed. */
  observations?: string;
}
export interface DonationCertificate {
  resultsAvailableOn: string;
  emailConsent: '' | 'yes' | 'no';
  email: string;
}
export interface CollectionRecord {
  id: string;
  revision: number;
  application: SelectionApplication;
  unitCode: string;
  sampleCode: string;
  completedSteps: CollectionStep[];
  status: 'pending' | 'inProgress' | 'completed';
  unitStatus: 'prepared' | 'quarantine';
  label: CollectionLabel;
  extractedVolume: string;
  registry: DonationRegistry;
  certificate: DonationCertificate;
  updatedAt: string;
}
