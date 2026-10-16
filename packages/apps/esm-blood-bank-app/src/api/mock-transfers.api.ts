import { withInventoryFixtures } from '../mocks/inventory.mock';
import { screeningTests } from '../sections/laboratory/screening/screening.types';
import type {
  TransferBookEntry,
  TransferRequest,
  TransferStore,
  TransferUnit,
} from '../sections/transfers/transfers.types';
import {
  candidateForRequest,
  transferDirection,
  validateTransferDelivery,
  validateTransferPreparation,
  validateTransferRequest,
} from '../sections/transfers/transfers-rules';
import { fractionationStore } from './mock-fractionation.api';
import { inventoryWorkspace } from './mock-inventory.api';
import {
  type MockStorage,
  type ProcessingState,
  readProcessingState,
  writeProcessingState,
} from './mock-processing-store';
import { transferStore } from './mock-transfers-store';
import type { TransfersApi } from './transfers.api';

export function transferUnits(state: ProcessingState): TransferUnit[] {
  const fractions = fractionationStore(state).units;
  return inventoryWorkspace(state).units.map((unit) => {
    const fraction = fractions.find((item) => item.code === unit.id);
    const collection = state.collections.find((item) => item.unitCode === unit.originalCode);
    const panel = state.screenings
      .filter((item) => item.unitCode === unit.originalCode && item.collectionId === collection?.id)
      .sort((a, b) => (b.validatedAt ?? '').localeCompare(a.validatedAt ?? ''))[0];
    return {
      ...unit,
      componentType: fraction?.component ?? null,
      collectedOn: fraction?.collectedAt ?? collection?.registry.date ?? '',
      bagLot: collection?.registry.bagLot ?? '',
      screening: Object.fromEntries(
        screeningTests.map((test) => [test, panel?.tests[test]?.result ?? '']),
      ) as TransferUnit['screening'],
    };
  });
}

export function createMockTransfersApi(getStorage: () => MockStorage = () => globalThis.sessionStorage): TransfersApi {
  const load = () => {
    const state = withInventoryFixtures(readProcessingState(getStorage));
    return { state, store: transferStore(state), units: transferUnits(state) };
  };
  const current = (store: TransferStore, id: string, revision: number, status: TransferRequest['status']) => {
    const request = store.requests.find((item) => item.id === id);
    if (
      !request ||
      transferDirection(request) !== 'incoming' ||
      request.revision !== revision ||
      request.status !== status
    )
      throw new Error('TRANSFER_CONFLICT');
    return structuredClone(request);
  };
  const persist = (state: ProcessingState, store: TransferStore, request: TransferRequest) => {
    request.revision += 1;
    request.updatedAt = new Date().toISOString();
    request.createdAt ||= request.updatedAt;
    const index = store.requests.findIndex((item) => item.id === request.id);
    if (index < 0) store.requests.push(request);
    else store.requests[index] = request;
    // Same document as stock, seals and disposal: one write commits the whole mock operation.
    writeProcessingState(getStorage, { ...state, transfers: store });
    return structuredClone(request);
  };
  return {
    async list() {
      const { store, units } = load();
      return structuredClone({ ...store, units });
    },
    async saveRequest(input, submit) {
      const { state, store } = load();
      if (submit && validateTransferRequest(input.data).length) throw new Error('INVALID_TRANSFER_REQUEST');
      const previous = input.id ? store.requests.find((item) => item.id === input.id) : undefined;
      const direction = transferDirection(input);
      if (!['incoming', 'outgoing'].includes(direction) || (previous && transferDirection(previous) !== direction))
        throw new Error('TRANSFER_CONFLICT');
      const submittedStatus = direction === 'outgoing' ? 'issued' : 'received';
      const issuer = input.data.requestingInstitution.trim().toLocaleLowerCase();
      const duplicate = store.requests.find(
        (item) =>
          item.id !== input.id &&
          transferDirection(item) === direction &&
          item.data.requestingInstitution.trim().toLocaleLowerCase() === issuer &&
          ((input.data.externalId.trim() && item.data.externalId === input.data.externalId) ||
            (input.data.office.trim() && item.data.office.trim() === input.data.office.trim())),
      );
      if (duplicate) {
        if (
          submit &&
          duplicate.status === submittedStatus &&
          JSON.stringify(duplicate.data) === JSON.stringify(input.data)
        )
          return structuredClone(duplicate);
        throw new Error('TRANSFER_DUPLICATE');
      }
      if (
        previous?.status === submittedStatus &&
        submit &&
        JSON.stringify(previous.data) === JSON.stringify(input.data)
      )
        return structuredClone(previous);
      if (
        (input.id && !previous) ||
        (previous && (previous.status !== 'draft' || previous.revision !== input.revision)) ||
        (!previous && input.revision !== 0)
      )
        throw new Error('TRANSFER_CONFLICT');
      if (previous && !submit && JSON.stringify(previous.data) === JSON.stringify(input.data))
        return structuredClone(previous);
      const request: TransferRequest = {
        ...structuredClone(previous ?? input),
        direction,
        data: structuredClone(input.data),
        id:
          previous?.id ??
          `TR-DEMO-${String(Math.max(0, ...store.requests.map((item) => Number(item.id.split('-').at(-1)) || 0)) + 1).padStart(5, '0')}`,
        revision: previous?.revision ?? 0,
        status: submit ? submittedStatus : 'draft',
        preparation: { unitIds: [], certificateOffice: '', responsible: '', evaluationVerified: false },
        delivery: { collectorName: '', collectorDocument: '', deliveredBy: '', transportVerified: false },
        certificateUnits: [],
        preparedAt: null,
        deliveredAt: null,
        pickupRecordedAt: null,
        rejectionReason: '',
      };
      return persist(state, store, request);
    },
    async savePreparation(id, revision, preparation) {
      const { state, store } = load();
      const request = current(store, id, revision, 'received');
      if (new Set(preparation.unitIds).size !== preparation.unitIds.length)
        throw new Error('INVALID_TRANSFER_SELECTION');
      if (JSON.stringify(request.preparation) === JSON.stringify(preparation)) return request;
      request.preparation = structuredClone(preparation);
      return persist(state, store, request);
    },
    async reserve(id, revision) {
      const { state, store, units } = load();
      const existing = store.requests.find((item) => item.id === id);
      if (existing?.status === 'prepared') return structuredClone(existing);
      const request = current(store, id, revision, 'received');
      if (validateTransferPreparation(request, units).length) throw new Error('INVALID_TRANSFER_PREPARATION');
      if (
        store.requests.some(
          (item) =>
            item.id !== id &&
            item.certificateUnits.length > 0 &&
            item.preparation.certificateOffice.trim() === request.preparation.certificateOffice.trim(),
        )
      )
        throw new Error('TRANSFER_OFFICE_DUPLICATE');
      request.status = 'prepared';
      request.preparedAt = new Date().toISOString();
      request.certificateUnits = request.preparation.unitIds.map((code) => {
        const unit = units.find((item) => item.id === code);
        if (!unit || !candidateForRequest(unit, request)) throw new Error('TRANSFER_STOCK_CONFLICT');
        return structuredClone(unit);
      });
      return persist(state, store, request);
    },
    async saveDelivery(id, revision, delivery) {
      const { state, store } = load();
      const request = current(store, id, revision, 'prepared');
      if (JSON.stringify(request.delivery) === JSON.stringify(delivery)) return request;
      request.delivery = structuredClone(delivery);
      request.pickupRecordedAt = validateTransferDelivery(request).length ? null : new Date().toISOString();
      return persist(state, store, request);
    },
    async deliver(id, revision) {
      const { state, store, units } = load();
      const previous = store.requests.find((item) => item.id === id);
      if (previous?.status === 'delivered') return structuredClone(previous);
      const request = current(store, id, revision, 'prepared');
      if (validateTransferDelivery(request).length) throw new Error('INVALID_TRANSFER_DELIVERY');
      if (request.certificateUnits.length !== request.preparation.unitIds.length)
        throw new Error('TRANSFER_STOCK_CONFLICT');
      for (const snapshot of request.certificateUnits) {
        const unit = units.find((item) => item.id === snapshot.id);
        // Revalidate expiry, current panel and identity at the moment of pickup.
        if (
          !unit ||
          unit.status !== 'Por transferir' ||
          !candidateForRequest({ ...unit, status: 'APTO' }, request) ||
          unit.sealId !== snapshot.sealId ||
          unit.bloodGroup !== snapshot.bloodGroup ||
          unit.componentType !== snapshot.componentType
        )
          throw new Error('TRANSFER_STOCK_CONFLICT');
      }
      request.status = 'delivered';
      request.deliveredAt = new Date().toISOString();
      const entries: TransferBookEntry[] = request.certificateUnits.map((unit) => {
        if (!unit.componentType || !unit.sealId) throw new Error('TRANSFER_STOCK_CONFLICT');
        return {
          id: `${request.id}/${unit.id}`,
          kind: 'transfer',
          unitStatus: 'TRANSFERIDO',
          requestId: request.id,
          requestOffice: request.data.office,
          certificateOffice: request.preparation.certificateOffice,
          date: request.deliveredAt ?? '',
          requestingInstitution: request.data.requestingInstitution,
          patientName: request.data.patientName,
          patientHistory: request.data.patientHistory,
          diagnosis: request.data.diagnosis,
          service: request.data.ward,
          requestingDoctor: request.data.requestingDoctor,
          requestingDoctorLicense: request.data.requestingDoctorLicense,
          unitCode: unit.id,
          seal: `${unit.sealId}/${unit.id}`,
          component: unit.componentType,
          bloodGroup: unit.bloodGroup,
          bagLot: unit.bagLot,
          collectedOn: unit.collectedOn,
          screening: structuredClone(unit.screening),
          collectorName: request.delivery.collectorName,
          collectorDocument: request.delivery.collectorDocument,
          deliveredBy: request.delivery.deliveredBy,
        };
      });
      store.bookEntries.push(...entries);
      return persist(state, store, request);
    },
    async reject(id, revision, reason) {
      const { state, store } = load();
      const previous = store.requests.find((item) => item.id === id);
      if (previous?.status === 'rejected' && previous.rejectionReason === reason) return structuredClone(previous);
      if (
        !previous ||
        transferDirection(previous) !== 'incoming' ||
        !['received', 'prepared'].includes(previous.status) ||
        !reason.trim() ||
        previous.revision !== revision
      )
        throw new Error('TRANSFER_CONFLICT');
      return persist(state, store, { ...structuredClone(previous), status: 'rejected', rejectionReason: reason });
    },
  };
}
