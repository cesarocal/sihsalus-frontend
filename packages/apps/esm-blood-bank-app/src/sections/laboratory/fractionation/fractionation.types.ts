export type ComponentType =
  | 'wholeBlood'
  | 'redCells'
  | 'lowVolumeRedCells'
  | 'plateletRichPlasma'
  | 'liquidPlasma'
  | 'pediatricFraction'
  | 'platelets'
  | 'freshFrozenPlasma'
  | 'plasma24'
  | 'cryoprecipitate'
  | 'cryoReducedPlasma';

export const fractionationSteps = [
  'fractionationPlan',
  'fractionationLabels',
  'fractionationVolumes',
  'fractionationReview',
] as const;
export type FractionationStep = (typeof fractionationSteps)[number];
export type UnitState = 'quarantine' | 'available' | 'inLaboratory' | 'fractionated';

export interface ComponentLabel {
  anticoagulant: string;
  anticoagulantConceptUuid?: string;
  preservative: string;
  sedimentingAgent: string;
  collectionService: string;
  processingService: string;
  storageTemperature: string;
  storageTemperatureConceptUuid?: string;
  expiresAt: string;
  expiresAtManual?: boolean;
  bloodGroup: string;
  antibodies: string;
  antibodyConceptUuid?: string;
  cmvIgGResult?: 'reactive' | 'nonReactive' | 'inconclusive';
  voluntary: boolean;
  remunerated: boolean;
  leukocytesReduced: boolean;
  autologous: boolean;
  recipientName: string;
  recipientDocument: string;
  recipientService: string;
  recipientHistory: string;
}

export interface FractionationUnit {
  id: string;
  code: string;
  originalWholeBloodCode: string;
  component: ComponentType;
  volume: string;
  collectedAt: string;
  location: string;
  state: UnitState;
  label: ComponentLabel;
  parentId?: string;
  batchId?: string;
  fractionationRemainder?: boolean;
}

export interface FractionationNode {
  id: string;
  sourceId: string;
  parentId: string | null;
  component: ComponentType;
  code: string;
  estimatedVolume: string;
  volume: string;
  label: ComponentLabel;
}

export interface FractionationBatch {
  id: string;
  revision: number;
  sources: FractionationUnit[];
  nodes: FractionationNode[];
  lowVolumeConfirmedSourceIds?: string[];
  completedSteps: FractionationStep[];
  status: 'inProgress' | 'completed';
  operator: string;
  service: string;
  system: '' | 'closed' | 'open';
  observations: string;
  labelsVerified: boolean;
  finalChecks: boolean;
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface FractionationStore {
  units: FractionationUnit[];
  batches: FractionationBatch[];
}

export interface FractionationWorkspace extends FractionationStore {}
