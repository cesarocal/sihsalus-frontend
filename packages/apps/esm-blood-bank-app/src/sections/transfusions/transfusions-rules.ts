import type { Session } from '@openmrs/esm-framework';
import { inventoryExpiry } from '../inventory/inventory-rules';
import type { ComponentType } from '../laboratory/fractionation/fractionation.types';
import { screeningTests } from '../laboratory/screening/screening.types';
import { localDateTime } from '../laboratory/screening/screening-rules';
import type { TransferUnit } from '../transfers/transfers.types';
import type {
  CompatibilityRound,
  RecipientSample,
  TransfusionOrder,
  TransfusionPriority,
  TransfusionRequest,
  TransfusionStatus,
  TransfusionStockUnit,
} from './transfusions.types';

export const transfusionStatusKeys = {
  pending: 'txPending',
  reviewed: 'txReviewed',
  sampleReady: 'txSampleReady',
  testing: 'txTesting',
  incompatible: 'txIncompatible',
  compatible: 'txCompatible',
  readyUrgent: 'txReadyUrgent',
  delivered: 'txDelivered',
  cancelled: 'fr08Cancelled',
} as const;
export const priorityKeys = { scheduled: 'txScheduled', urgent: 'txUrgent', veryUrgent: 'txVeryUrgent' } as const;
/** Match native date filters to the local calendar day displayed by the UI. */
export function transfusionLocalDay(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
    : '';
}
const priority = { veryUrgent: 0, urgent: 1, scheduled: 2 };
export const comparePriority = (
  a: { priority: TransfusionPriority; date: string },
  b: { priority: TransfusionPriority; date: string },
) => priority[a.priority] - priority[b.priority] || a.date.localeCompare(b.date);
export const needsCrossmatch = (component: ComponentType | null) =>
  component === 'wholeBlood' ||
  component === 'redCells' ||
  component === 'lowVolumeRedCells' ||
  component === 'pediatricFraction';
export const lockedAssignments = (request: TransfusionRequest) =>
  request.assignments.filter((item) => item.active && item.result !== 'pending');
export const readyForDelivery = (status: TransfusionStatus) => status === 'compatible' || status === 'readyUrgent';
export const compatibilityPending = (request: TransfusionRequest, round: CompatibilityRound) =>
  request.status !== 'cancelled' &&
  !round.readOnly &&
  !round.completedAt &&
  (request.order.priority !== 'veryUrgent' || !!request.deliveredAt);
export const compatibilityNeedsCommunication = (request: TransfusionRequest, round: CompatibilityRound) =>
  request.order.priority === 'veryUrgent' && !!request.deliveredAt && !!round.completedAt && !round.communicated;
export const urgentSerumSampleCode = (sample: RecipientSample) => `${sample.code}-S`;
export const compatibilityReportReady = (request: TransfusionRequest) =>
  request.assignments.length > 0 &&
  request.rounds.length > 0 &&
  request.rounds.every((round) => !!round.completedAt) &&
  request.assignments.every((item) => item.result !== 'pending');

export function transfusionOperatorName({ authenticated, user }: Session) {
  const person = authenticated ? user?.person : undefined;
  const name = person?.preferredName;
  return (
    [name?.givenName, name?.middleName, name?.familyName, name?.familyName2]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(' ') ||
    name?.display?.trim() ||
    person?.display?.trim() ||
    ''
  );
}

export function requestComplete(order: TransfusionOrder): boolean {
  return !!(
    order.patientId &&
    order.encounterId &&
    order.patientName.trim() &&
    order.historyNumber.trim() &&
    order.orderer.trim() &&
    order.diagnosis.trim() &&
    Object.hasOwn(priorityKeys, order.priority) &&
    /^(A|B|AB|O)[+−-]$/.test(order.bloodGroup) &&
    Number.isFinite(Date.parse(order.requestedAt)) &&
    order.items.length &&
    new Set(order.items.map((item) => item.component)).size === order.items.length &&
    order.items.every((item) => Number.isSafeInteger(item.quantity) && item.quantity > 0)
  );
}

export function initialTransfusionRequest(order: TransfusionOrder, id = order.id): TransfusionRequest {
  return {
    id,
    order,
    revision: 1,
    status: 'pending',
    requesterStatus: 'PENDIENTE',
    receivedAt: null,
    sample: null,
    assignments: [],
    rounds: [],
    events: [],
    deliveredAt: null,
    draft: {
      reviewer: '',
      reviewVerified: false,
      consentVerified: false,
      selectedUnitIds: [],
      selectionVerified: false,
      sample: {
        code: `M-REC-${order.number}`,
        historyNumber: order.historyNumber,
        collectedAt: '',
        collectedBy: '',
      },
      collectorName: '',
      collectorDocument: '',
      deliveredBy: '',
      releaseVerified: false,
    },
  };
}

const bloodGroupPattern = /^(A|B|AB|O)([+−-])$/;
const redCellDonors: Readonly<Record<string, readonly string[]>> = {
  O: ['O'],
  A: ['A', 'O'],
  B: ['B', 'O'],
  AB: ['AB', 'A', 'B', 'O'],
};

/** ABO/Rh screening for routine selection, separate from the crossmatch. */
function componentGroupCompatible(component: ComponentType | null, donor: string, recipient: string) {
  const from = bloodGroupPattern.exec(donor);
  const to = bloodGroupPattern.exec(recipient);
  if (!from || !to) return false;
  const [, donorAbo, donorRh] = from;
  const [, recipientAbo, recipientRh] = to;
  const rhCompatible = recipientRh === '+' || donorRh !== '+';

  switch (component) {
    case 'redCells':
    case 'lowVolumeRedCells':
      return rhCompatible && redCellDonors[recipientAbo].includes(donorAbo);
    case 'freshFrozenPlasma':
    case 'liquidPlasma':
    case 'plasma24':
    case 'cryoReducedPlasma':
    case 'cryoprecipitate':
      return redCellDonors[donorAbo].includes(recipientAbo);
    case 'wholeBlood':
    case 'pediatricFraction': // Fractionation produces this from whole blood.
    case 'platelets':
    case 'plateletRichPlasma':
      return donorAbo === recipientAbo && rhCompatible;
    default:
      return false;
  }
}

export function transfusionCandidate(unit: TransfusionStockUnit, request: TransfusionRequest): boolean {
  const today = localDateTime().slice(0, 10);
  const expiry = inventoryExpiry(unit.expiresAt);
  const collected = inventoryExpiry(unit.collectedOn);
  return (
    unit.status === 'APTO' &&
    (!unit.autologousRecipientUuid || unit.autologousRecipientUuid === request.order.patientId) &&
    !!unit.sealId &&
    !unit.qualityIssues.length &&
    unit.screeningResult === 'nonReactive' &&
    screeningTests.every((test) => unit.screening[test] === 'nonReactive') &&
    !!expiry &&
    !!collected &&
    collected <= today &&
    expiry >= collected &&
    expiry >= today &&
    (!unit.expiresAt.includes('T') || Date.parse(unit.expiresAt) > Date.now()) &&
    componentGroupCompatible(unit.componentType, unit.bloodGroup, request.order.bloodGroup) &&
    request.order.items.some((item) => item.component === unit.componentType) &&
    !request.assignments.some((item) => item.unit.id === unit.id)
  );
}
export function selectionComplete(request: TransfusionRequest, units: TransferUnit[]): boolean {
  const ids = request.draft.selectedUnitIds;
  if (!ids.length || new Set(ids).size !== ids.length) return false;
  const selected = ids.map((id) => units.find((unit) => unit.id === id));
  if (selected.some((unit) => !unit || !transfusionCandidate(unit, request))) return false;
  const all = [...lockedAssignments(request).map((item) => item.unit), ...selected];
  return (
    all.length === request.order.items.reduce((sum, item) => sum + item.quantity, 0) &&
    request.order.items.every(
      (item) => all.filter((unit) => unit?.componentType === item.component).length === item.quantity,
    )
  );
}
export function sampleValid(sample: RecipientSample, order: TransfusionOrder): boolean {
  const age = (Date.now() - Date.parse(sample.collectedAt)) / 86400000;
  // Conservative mock expiry; definitive patient-specific policy belongs to the backend.
  return (
    sample.historyNumber === order.historyNumber &&
    !!sample.code &&
    !!sample.collectedBy.trim() &&
    (sample.printRequestedAt === sample.collectedAt || sample.identityVerified === true) &&
    (order.priority !== 'veryUrgent' || sample.urgentPairVerified === true) &&
    Number.isFinite(age) &&
    age >= 0 &&
    age <= 3
  );
}
