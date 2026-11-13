import type { InventorySummary } from '../../types/blood-bank.types';
import type { ScreeningResult } from '../laboratory/screening/screening.types';
import type { ComponentLabel } from '../laboratory/fractionation/fractionation.types';

export interface InventoryUnit extends InventorySummary {
  originalCode: string;
  qualityIssues: string[];
  screeningResult: Exclude<ScreeningResult, ''> | 'pending' | 'inProgress';
  sealId?: string;
  sealCode?: string;
  canDispose: boolean;
}
export interface QualitySealLabel {
  code: string;
  originalCode: string;
  details?: ComponentLabel;
  lowVolume?: boolean;
}

export interface QualitySealReprint {
  number: number;
  unitIds: string[];
  reason: string;
  operator: string;
  requestedAt: string;
}

export type QualitySealReprintRequest = Pick<QualitySealReprint, 'unitIds' | 'reason' | 'operator'>;

export interface InventoryOperation {
  id: string;
  revision: number;
  kind: 'qualitySeal' | 'disposal';
  stage: 'draft' | 'ready' | 'printRequested' | 'completed';
  units: InventorySummary[];
  causes: Record<string, string>;
  date: string;
  time: string;
  witnesses: string;
  serviceResponsible: string;
  epidemiologyResponsible: string;
  labelsVerified: boolean;
  integrityVerified: boolean;
  recordsVerified: boolean;
  sealLabels?: Record<string, QualitySealLabel>;
  sealReprints?: QualitySealReprint[];
  requestedAt: string | null;
  completedAt: string | null;
  outcome?: 'APTO' | 'ELIMINADAS';
  updatedAt: string;
}
export interface InventoryStore {
  operations: InventoryOperation[];
}
export interface InventoryWorkspace {
  units: InventoryUnit[];
  operations: InventoryOperation[];
}
