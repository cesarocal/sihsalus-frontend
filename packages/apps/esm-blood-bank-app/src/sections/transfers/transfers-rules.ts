import { isDate } from '../applicant-selection/selection-rules';
import { inventoryExpiry } from '../inventory/inventory-rules';
import { componentDefinitions } from '../laboratory/fractionation/fractionation-rules';
import { screeningTests } from '../laboratory/screening/screening.types';
import { localDateTime } from '../laboratory/screening/screening-rules';
import type { TransferDirection, TransferRequest, TransferRequestData, TransferUnit } from './transfers.types';

export const transferBloodGroups = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
export const transferStatusKeys = {
  draft: 'transferDraft',
  received: 'transferReceived',
  prepared: 'transferPrepared',
  delivered: 'transferDelivered',
  rejected: 'transferRejected',
  issued: 'transferIssued',
} as const;
export const transferDirection = (request: TransferRequest): TransferDirection => request.direction ?? 'incoming';
export const normalizedGroup = (value: string) => value.replace('−', '-');
export function newTransferRequest(direction: TransferDirection = 'incoming'): TransferRequest {
  return {
    id: '',
    revision: 0,
    direction,
    status: 'draft',
    data: {
      office: '',
      date: localDateTime().slice(0, 10),
      channel: 'email',
      externalId: '',
      requestingInstitution: '',
      destinationInstitution: '',
      requestingDirector: '',
      addressedDirector: '',
      attention: '',
      requestingAttention: '',
      contact: '',
      patientName: '',
      patientAge: '',
      patientDocument: '',
      patientHistory: '',
      patientBloodGroup: '',
      ward: '',
      bed: '',
      requestingDoctor: '',
      requestingDoctorLicense: '',
      diagnosis: '',
      transfusionReason: '',
      transferReason: '',
      // FR09's requested age limit, editable per request; not a universal shelf-life rule.
      maxCollectionAgeDays: 5,
      items: [{ id: 'item-1', component: 'wholeBlood', quantity: 1, bloodGroup: '' }],
    },
    preparation: { unitIds: [], certificateOffice: '', responsible: '', evaluationVerified: false },
    delivery: { collectorName: '', collectorDocument: '', deliveredBy: '', transportVerified: false },
    certificateUnits: [],
    createdAt: '',
    updatedAt: '',
    preparedAt: null,
    deliveredAt: null,
    pickupRecordedAt: null,
    rejectionReason: '',
  };
}
export function validateTransferRequest(data: TransferRequestData): string[] {
  const errors: string[] = [];
  if (
    !data.office.trim() ||
    !data.requestingInstitution.trim() ||
    !data.destinationInstitution.trim() ||
    !data.requestingDirector.trim() ||
    !data.addressedDirector.trim() ||
    !data.attention.trim()
  )
    errors.push('transferInstitutionRequired');
  if (!isDate(data.date) || data.date > localDateTime().slice(0, 10)) errors.push('transferDateRequired');
  if (
    !data.patientName.trim() ||
    !data.patientHistory.trim() ||
    !/^\d{1,3}$/.test(data.patientAge) ||
    !transferBloodGroups.includes(normalizedGroup(data.patientBloodGroup)) ||
    !data.diagnosis.trim()
  )
    errors.push('transferPatientRequired');
  if (!data.transfusionReason.trim() || !data.transferReason.trim()) errors.push('transferReasonsRequired');
  if (!['email', 'paper', 'api'].includes(data.channel) || (data.channel === 'api' && !data.externalId.trim()))
    errors.push('transferOriginRequired');
  if (
    data.maxCollectionAgeDays !== null &&
    (!Number.isSafeInteger(data.maxCollectionAgeDays) || data.maxCollectionAgeDays < 1)
  )
    errors.push('transferAgeLimitRequired');
  if (
    !data.items.length ||
    new Set(data.items.map((item) => item.id)).size !== data.items.length ||
    data.items.some(
      (item) =>
        !item.id ||
        !componentDefinitions[item.component] ||
        !Number.isSafeInteger(item.quantity) ||
        item.quantity < 1 ||
        !transferBloodGroups.includes(normalizedGroup(item.bloodGroup)),
    ) ||
    new Set(data.items.map((item) => `${item.component}:${normalizedGroup(item.bloodGroup)}`)).size !==
      data.items.length
  )
    errors.push('transferItemsRequired');
  return errors;
}
export function candidateForRequest(unit: TransferUnit, request: TransferRequest): boolean {
  const today = localDateTime().slice(0, 10);
  const age = (Date.parse(`${today}T12:00:00Z`) - Date.parse(`${unit.collectedOn}T12:00:00Z`)) / 86400000;
  const expiry = inventoryExpiry(unit.expiresAt);
  return (
    transferDirection(request) === 'incoming' &&
    unit.status === 'APTO' &&
    !!unit.sealId &&
    !unit.qualityIssues.length &&
    unit.screeningResult === 'nonReactive' &&
    !!expiry &&
    expiry >= today &&
    (!unit.expiresAt.includes('T') || new Date(unit.expiresAt).getTime() > Date.now()) &&
    isDate(unit.collectedOn) &&
    age >= 0 &&
    (request.data.maxCollectionAgeDays === null || age <= request.data.maxCollectionAgeDays) &&
    screeningTests.every((test) => unit.screening[test] === 'nonReactive') &&
    request.data.items.some(
      (item) =>
        unit.componentType === item.component && normalizedGroup(unit.bloodGroup) === normalizedGroup(item.bloodGroup),
    )
  );
}
export function completeTransferSelection(request: TransferRequest, units: TransferUnit[]): boolean {
  const ids = request.preparation.unitIds;
  if (
    !ids.length ||
    new Set(ids).size !== ids.length ||
    ids.length !== request.data.items.reduce((total, item) => total + item.quantity, 0)
  )
    return false;
  const selected = ids.map((id) => units.find((unit) => unit.id === id));
  return (
    selected.every((unit): unit is TransferUnit => !!unit && candidateForRequest(unit, request)) &&
    request.data.items.every(
      (item) =>
        selected.filter(
          (unit) =>
            unit?.componentType === item.component &&
            normalizedGroup(unit.bloodGroup) === normalizedGroup(item.bloodGroup),
        ).length === item.quantity,
    )
  );
}
export function validateTransferPreparation(request: TransferRequest, units: TransferUnit[]): string[] {
  const errors = validateTransferRequest(request.data);
  if (!request.preparation.certificateOffice.trim()) errors.push('transferOfficeRequired');
  if (!request.preparation.responsible.trim() || !request.preparation.evaluationVerified)
    errors.push('transferEvaluationRequired');
  if (!completeTransferSelection(request, units)) errors.push('transferSelectionRequired');
  return errors;
}
export function validateTransferDelivery(request: TransferRequest): string[] {
  return request.delivery.collectorName.trim() &&
    /^\d{8}$/.test(request.delivery.collectorDocument) &&
    request.delivery.deliveredBy.trim() &&
    request.delivery.transportVerified
    ? []
    : ['transferDeliveryRequired'];
}
