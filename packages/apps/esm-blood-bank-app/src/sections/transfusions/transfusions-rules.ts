import { inventoryExpiry } from '../inventory/inventory-rules';
import type { ComponentType } from '../laboratory/fractionation/fractionation.types';
import { screeningTests } from '../laboratory/screening/screening.types';
import { localDateTime } from '../laboratory/screening/screening-rules';
import type { TransferUnit } from '../transfers/transfers.types';
import type { RecipientSample, TransfusionOrder, TransfusionPriority, TransfusionRequest } from './transfusions.types';

export const transfusionStatusKeys = {
  pending: 'txPending',
  reviewed: 'txReviewed',
  sampleReady: 'txSampleReady',
  testing: 'txTesting',
  incompatible: 'txIncompatible',
  compatible: 'txCompatible',
  delivered: 'txDelivered',
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
export function requestComplete(order: TransfusionOrder): boolean {
  return !!(
    order.patientId &&
    order.encounterId &&
    order.patientName.trim() &&
    order.historyNumber.trim() &&
    order.orderer.trim() &&
    order.diagnosis.trim() &&
    /^(A|B|AB|O)[+−-]$/.test(order.bloodGroup) &&
    Number.isFinite(Date.parse(order.requestedAt)) &&
    order.items.length &&
    new Set(order.items.map((item) => item.component)).size === order.items.length &&
    order.items.every((item) => Number.isSafeInteger(item.quantity) && item.quantity > 0)
  );
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

export function transfusionCandidate(unit: TransferUnit, request: TransfusionRequest): boolean {
  const today = localDateTime().slice(0, 10);
  const expiry = inventoryExpiry(unit.expiresAt);
  const collected = inventoryExpiry(unit.collectedOn);
  return (
    request.order.priority === 'scheduled' &&
    unit.status === 'APTO' &&
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
    Number.isFinite(age) &&
    age >= 0 &&
    age <= 3
  );
}
