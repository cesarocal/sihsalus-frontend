import type { ComponentType } from '../laboratory/fractionation/fractionation.types';
import type { TransfusionReturnInspection, TransfusionReturnReceipt } from './transfusions.types';

export function requiresReturnTemperature(component: ComponentType) {
  // The current fractionation workflow creates pediatric aliquots from whole blood.
  return (
    component === 'wholeBlood' ||
    component === 'redCells' ||
    component === 'lowVolumeRedCells' ||
    component === 'pediatricFraction'
  );
}

const validText = (value: string, max: number) => Boolean(value.trim()) && value.length <= max;

export function validReturnReceipt(receipt: TransfusionReturnReceipt) {
  return (
    validText(receipt.returnedBy, 200) &&
    validText(receipt.receivedBy, 200) &&
    validText(receipt.reason, 500) &&
    ['unused', 'started', 'unknown'].includes(receipt.administration)
  );
}

export function validReturnTemperature(minimum: string, maximum: string) {
  const low = Number(minimum);
  const high = Number(maximum);
  return (
    Boolean(minimum.trim() && maximum.trim()) &&
    Number.isFinite(low) &&
    Number.isFinite(high) &&
    low >= 1 &&
    high <= 10 &&
    low <= high
  );
}

export function validReturnInspection(
  inspection: TransfusionReturnInspection,
  administration: TransfusionReturnReceipt['administration'],
  component: ComponentType,
) {
  if (!validText(inspection.inspectedBy, 200)) return false;
  if (inspection.decision === 'rejected') return validText(inspection.rejectionReason, 500);
  if (inspection.decision !== 'approved') return false;
  return (
    administration !== 'started' &&
    inspection.notAdministered &&
    inspection.intact &&
    inspection.segmentAttached &&
    inspection.identityVerified &&
    inspection.conservationVerified &&
    validText(inspection.evidence, 500) &&
    (!requiresReturnTemperature(component) ||
      validReturnTemperature(inspection.minimumTemperature, inspection.maximumTemperature))
  );
}
