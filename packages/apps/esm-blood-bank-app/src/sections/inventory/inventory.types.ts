import type { InventorySummary } from '../../types/blood-bank.types';
import type { ScreeningResult } from '../laboratory/screening/screening.types';

export interface InventoryUnit extends InventorySummary {
  originalCode: string;
  qualityIssues: string[];
  screeningResult: Exclude<ScreeningResult, ''> | 'pending';
  sealId?: string;
  canDispose: boolean;
}
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
