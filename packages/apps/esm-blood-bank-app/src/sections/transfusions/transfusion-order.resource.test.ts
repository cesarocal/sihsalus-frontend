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
  priority: 'scheduled',
  scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
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
            urgency: 'ON_SCHEDULED_DATE',
            scheduledDate: fields.scheduledDate,
            orderer: 'provider',
          },
        ],
      },
    });
  });

  it.each(['urgent', 'veryUrgent'] as const)('issues %s requests without a schedule', async (priority) => {
    const request: Fr08Fields = {
      ...fields,
      priority,
      scheduledDate: undefined,
      items: [{ component: 'plasma24', quantity: 2 }],
    };
    const snapshot = JSON.parse(row.instructions);
    respond({ results: [] });
    respond({ uuid: 'encounter' });
    respond({
      results: [
        { ...row, instructions: JSON.stringify({ ...snapshot, request: { ...snapshot.request, ...request } }) },
      ],
    });
    const { order } = await createTransfusionOrder(config, context, request, 'FR08-key');
    expect(order.priority).toBe(priority);
    expect(order.items).toEqual(request.items);
    expect(order.scheduledDate).toBeUndefined();
    const payload = fetch.mock.calls[1][1]?.body as { orders: { urgency: string; scheduledDate?: string }[] };
    expect(payload.orders[0].urgency).toBe('STAT');
    expect(payload.orders[0]).not.toHaveProperty('scheduledDate');
  });

  it('rejects a past schedule or an empty component list before writing', async () => {
    await expect(
      createTransfusionOrder(config, context, { ...fields, scheduledDate: '2000-01-01T10:00:00Z' }, 'past'),
    ).rejects.toThrow('INVALID_FR08');
    await expect(createTransfusionOrder(config, context, { ...fields, items: [] }, 'empty')).rejects.toThrow(
      'INVALID_FR08',
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps previously issued requests with a free-text component readable', async () => {
    const snapshot = JSON.parse(row.instructions);
    const otherComponent = { description: 'Plasma tratado', quantity: 2 };
    respond({
      results: [
        {
          ...row,
          instructions: JSON.stringify({ ...snapshot, request: { ...snapshot.request, items: [], otherComponent } }),
        },
      ],
    });
    const [issued] = await listIssuedTransfusionOrders(config);
    expect(issued.order.otherComponent).toEqual(otherComponent);
  });

  it('reconciles a retry against the existing order before writing again', async () => {
    respond({ results: [row] });
    expect((await createTransfusionOrder(config, context, fields, 'FR08-key')).order.id).toBe('order');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('keeps chart history scoped to the selected patient and loads the server status', async () => {
    const snapshot = JSON.parse(row.instructions);
    delete snapshot.request.scheduledDate;
    respond({
      results: [
        { ...row, fulfillerStatus: 'RECEIVED', instructions: JSON.stringify(snapshot) },
        { ...row, patient: { uuid: 'different' } },
      ],
    });
    const records = await listIssuedTransfusionOrders(config, 'patient');
    expect(records).toHaveLength(1);
    expect(issuedOrderStatus(records[0])).toBe('fr08Received');
    expect(records[0].order.scheduledDate).toBeUndefined();
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
