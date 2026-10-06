import { isDate } from '../applicant-selection/selection-rules';
import { localDateTime } from '../laboratory/screening/screening-rules';
import type { InventorySummary } from '../../types/blood-bank.types';
import type { InventoryOperation, InventoryUnit } from './inventory.types';
import { isDisposalCause } from './disposal-causes';

export const inventoryStatusKey: Record<InventorySummary['status'], string> = {
  Disponible: 'inventoryAvailable',
  Reservada: 'inventoryReserved',
  Cuarentena: 'quarantine',
  'En laboratorio': 'fractionationInLab',
  APTO: 'inventorySuitable',
};
export function newInventoryOperation(
  kind: InventoryOperation['kind'],
  units: InventorySummary[] = [],
): InventoryOperation {
  const now = localDateTime();
  return {
    id: '',
    revision: 0,
    kind,
    stage: 'draft',
    units: structuredClone(units),
    causes: {},
    date: now.slice(0, 10),
    time: now.slice(11, 16),
    witnesses: '',
    serviceResponsible: '',
    epidemiologyResponsible: '',
    labelsVerified: false,
    integrityVerified: false,
    recordsVerified: false,
    requestedAt: null,
    completedAt: null,
    updatedAt: '',
  };
}
/** Native controls remain native; only the display is formatted. Unknown dates never qualify for a seal. */
export function inventoryExpiry(value: string): string {
  const dayFirst = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (
    !dayFirst &&
    (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{3})?)?(Z|[+-]\d{2}:\d{2})?)?$/.test(value) ||
      !Number.isFinite(new Date(value).getTime()))
  )
    return '';
  const date = dayFirst ? `${dayFirst[3]}-${dayFirst[2]}-${dayFirst[1]}` : value.slice(0, 10);
  return isDate(date) ? date : '';
}
export function inventoryDisplayDate(value: string): string {
  const date = inventoryExpiry(value);
  return date ? `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}` : '—';
}
export function canSeal(unit: InventoryUnit) {
  return (
    unit.screeningResult === 'nonReactive' &&
    unit.status === 'Cuarentena' &&
    !unit.sealId &&
    unit.qualityIssues.length === 0
  );
}
export function validateInventoryOperation(operation: InventoryOperation, selectionOnly = false): string[] {
  const errors: string[] = [];
  if (!operation.units.length || new Set(operation.units.map((unit) => unit.id)).size !== operation.units.length)
    errors.push('inventorySelectionRequired');
  if (selectionOnly) return errors;
  if (
    !isDate(operation.date) ||
    operation.date > localDateTime().slice(0, 10) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(operation.time) ||
    `${operation.date}T${operation.time}` > localDateTime()
  )
    errors.push('inventoryDateRequired');
  if (!operation.serviceResponsible.trim()) errors.push('inventoryResponsibleRequired');
  if (operation.kind === 'qualitySeal') {
    if (!operation.labelsVerified || !operation.integrityVerified || !operation.recordsVerified)
      errors.push('inventoryChecksRequired');
  } else {
    if (!operation.witnesses.trim() || !operation.epidemiologyResponsible.trim())
      errors.push('inventoryWitnessesRequired');
    if (operation.units.some((unit) => !isDisposalCause(operation.causes[unit.id])))
      errors.push('inventoryCausesRequired');
  }
  return errors;
}
