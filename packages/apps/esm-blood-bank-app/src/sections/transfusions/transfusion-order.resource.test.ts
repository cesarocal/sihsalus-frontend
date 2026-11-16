import { openmrsFetch } from '@openmrs/esm-framework';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createTransfusionOrder,
  type Fr08Fields,
  issuedOrderStatus,
  listIssuedTransfusionOrders,
  receiveTransfusionOrder,
  type TransfusionOrderConfig,
} from './transfusion-order.resource';

vi.mock('@openmrs/esm-framework', () => ({ openmrsFetch: vi.fn(), restBaseUrl: '/ws/rest/v1' }));

const config: TransfusionOrderConfig = {
  orderTypeUuid: 'transfusion-type',
  conceptUuid: 'transfusion-concept',
  encounterTypeUuid: 'visit-order',
  careSettingUuid: 'inpatient',
  historyIdentifierTypeUuid: 'history',
  documentIdentifierTypeUuids: [],
};
const fields: Fr08Fields = {
  bloodGroup: 'O+',
  service: 'Hospitalización',
  ward: '1',
  bed: '2',
  diagnosis: 'Indicación de prueba',
  hemoglobin: '',
  hematocrit: '',
  platelets: '',
  priorTransfusions: 'unknown',
  priorReactions: 'no',
  pregnancies: '',
  abortions: '',
  maternalIncompatibility: '',
  items: [
    { component: 'redCells', quantity: 2 },
    { component: 'freshFrozenPlasma', quantity: 1 },
  ],
};
const context = {
  recipient: {
    uuid: 'patient',
    name: 'Paciente de prueba',
    historyNumber: 'HC-1',
    document: '',
    age: '45',
    sex: 'M' as const,
  },
  visitUuid: 'visit',
  locationUuid: 'location',
  providerUuid: 'provider',
  registration: 'CMP-TEST',
};
const row = {
  uuid: 'order',
  orderNumber: 'ORD-01',
  dateActivated: '2026-11-16T10:00:00Z',
  action: 'NEW',
  voided: false,
  dateStopped: null,
  fulfillerStatus: null,
  patient: { uuid: 'patient' },
  encounter: { uuid: 'encounter' },
  orderType: { uuid: config.orderTypeUuid },
  concept: { uuid: config.conceptUuid },
  orderer: { uuid: 'provider', display: 'Médico de prueba' },
  accessionNumber: 'FR08-key',
  instructions: JSON.stringify({
    format: 'EG05-FR08/v1',
    request: {
      ...fields,
      priority: 'scheduled',
      patientName: context.recipient.name,
      historyNumber: context.recipient.historyNumber,
      document: '',
      age: '45',
      sex: 'M',
      doctorLicense: 'CMP-TEST',
    },
  }),
};
const fetch = vi.mocked(openmrsFetch);
function respond(data: unknown) {
  fetch.mockResolvedValueOnce({ data } as Awaited<ReturnType<typeof openmrsFetch>>);
}

describe('FR08 orders', () => {
  beforeEach(() => fetch.mockReset());

  it('creates one order with all requested components in a single encounter write', async () => {
    respond({ results: [] });
    respond({ uuid: 'encounter' });
    respond({ results: [row] });
    const created = await createTransfusionOrder(config, context, fields, 'FR08-key');
    expect(created.order.items).toEqual(fields.items);
    expect(created.order.number).toBe('ORD-01');
    expect(fetch.mock.calls[1][1]).toMatchObject({
      method: 'POST',
      body: {
        visit: 'visit',
        patient: 'patient',
        orders: [
          {
            orderType: config.orderTypeUuid,
            concept: config.conceptUuid,
            urgency: 'ROUTINE',
            orderer: 'provider',
          },
        ],
      },
    });
  });

  it('reconciles a retry against the existing order before writing again', async () => {
    respond({ results: [row] });
    expect((await createTransfusionOrder(config, context, fields, 'FR08-key')).order.id).toBe('order');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('keeps chart history scoped to the selected patient and loads the server status', async () => {
    respond({
      results: [
        { ...row, fulfillerStatus: 'RECEIVED' },
        { ...row, patient: { uuid: 'different' } },
      ],
    });
    const records = await listIssuedTransfusionOrders(config, 'patient');
    expect(records).toHaveLength(1);
    expect(issuedOrderStatus(records[0])).toBe('fr08Received');
    expect(String(fetch.mock.calls[0][0])).toContain('patient=patient');
  });

  it('revalidates the order before accepting it and refuses to overwrite later states', async () => {
    respond(row);
    respond(null);
    await receiveTransfusionOrder(config, 'order');
    expect(fetch.mock.calls[1]).toEqual(
      expect.arrayContaining([
        '/ws/rest/v1/order/order/fulfillerdetails/',
        expect.objectContaining({ body: { fulfillerStatus: 'RECEIVED' } }),
      ]),
    );
    fetch.mockClear();
    respond({ ...row, fulfillerStatus: 'COMPLETED' });
    await expect(receiveTransfusionOrder(config, 'order')).rejects.toThrow('FR08_ORDER_STATE_CONFLICT');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
