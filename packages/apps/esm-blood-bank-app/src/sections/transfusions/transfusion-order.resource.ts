import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import type { BloodBankConfig } from '../../config-schema';
import { componentDefinitions } from '../laboratory/fractionation/fractionation-rules';
import type { TransfusionOrder } from './transfusions.types';

export type TransfusionOrderConfig = NonNullable<BloodBankConfig['transfusionOrders']>;
type Ref = { uuid: string; display?: string };
type Snapshot = Omit<
  TransfusionOrder,
  'id' | 'number' | 'patientId' | 'encounterId' | 'orderer' | 'requestedAt' | 'history'
>;
export type Fr08Fields = Pick<
  Snapshot,
  | 'bloodGroup'
  | 'service'
  | 'ward'
  | 'bed'
  | 'diagnosis'
  | 'hemoglobin'
  | 'hematocrit'
  | 'platelets'
  | 'priorTransfusions'
  | 'priorReactions'
  | 'pregnancies'
  | 'abortions'
  | 'maternalIncompatibility'
  | 'items'
>;
export interface OrderRecipient {
  uuid: string;
  name: string;
  historyNumber: string;
  document: string;
  age: string;
  sex: 'M' | 'F';
}
export interface IssuedTransfusionOrder {
  order: TransfusionOrder;
  fulfillerStatus: string | null;
  stopped: boolean;
}
interface RestOrder {
  uuid: string;
  orderNumber: string;
  dateActivated: string;
  action: string;
  voided: boolean;
  dateStopped: string | null;
  fulfillerStatus: string | null;
  instructions: string;
  accessionNumber: string | null;
  concept: Ref;
  patient: Ref;
  encounter: Ref;
  orderType: Ref;
  orderer: Ref;
}
const orderRep =
  'custom:(uuid,orderNumber,dateActivated,action,voided,dateStopped,fulfillerStatus,instructions,accessionNumber,' +
  'concept:ref,patient:ref,encounter:ref,orderType:ref,orderer:ref)';
export const transfusionOrdersChanged = 'sihsalus:transfusion-orders-changed';

export function configuredTransfusionOrders(config?: TransfusionOrderConfig): config is TransfusionOrderConfig {
  return Boolean(
    config?.orderTypeUuid &&
      config.conceptUuid &&
      config.encounterTypeUuid &&
      config.careSettingUuid &&
      config.historyIdentifierTypeUuid,
  );
}

const answers = new Set(['yes', 'no', 'unknown']);
const textFields = [
  'bloodGroup',
  'service',
  'ward',
  'bed',
  'diagnosis',
  'hemoglobin',
  'hematocrit',
  'platelets',
  'pregnancies',
  'abortions',
  'maternalIncompatibility',
] as const;

export function validFr08(fields: Fr08Fields) {
  return (
    textFields.every((key) => typeof fields[key] === 'string' && fields[key].length <= 500) &&
    /^(A|B|AB|O)[+-]$/.test(fields.bloodGroup) &&
    Boolean(fields.service.trim() && fields.diagnosis.trim()) &&
    answers.has(fields.priorTransfusions) &&
    answers.has(fields.priorReactions) &&
    Array.isArray(fields.items) &&
    fields.items.length > 0 &&
    fields.items.every(
      (item) =>
        item &&
        Object.hasOwn(componentDefinitions, item.component) &&
        Number.isInteger(item.quantity) &&
        item.quantity >= 1 &&
        item.quantity <= 99,
    ) &&
    new Set(fields.items.map((item) => item.component)).size === fields.items.length
  );
}

export async function loadOrderRecipient(config: TransfusionOrderConfig, patientUuid: string): Promise<OrderRecipient> {
  const rep = 'custom:(uuid,person:(display,gender,age),identifiers:(identifier,identifierType:(uuid)))';
  const { data } = await openmrsFetch<{
    uuid: string;
    person: { display: string; gender: string; age: number | null };
    identifiers: { identifier: string; identifierType: Ref }[];
  }>(`${restBaseUrl}/patient/${encodeURIComponent(patientUuid)}?v=${encodeURIComponent(rep)}`);
  const identifier = (type: string) =>
    data.identifiers.find((item) => item.identifierType.uuid === type)?.identifier || '';
  const { gender, display, age } = data.person;
  const historyNumber = identifier(config.historyIdentifierTypeUuid);
  if (data.uuid !== patientUuid || !historyNumber || !display.trim() || (gender !== 'M' && gender !== 'F')) {
    throw new Error('FR08_RECIPIENT_INCOMPLETE');
  }
  return {
    uuid: data.uuid,
    name: display,
    historyNumber,
    document: config.documentIdentifierTypeUuids.map(identifier).find(Boolean) ?? '',
    age: typeof age === 'number' ? String(age) : '',
    sex: gender,
  };
}

function readOrder(row: RestOrder, config: TransfusionOrderConfig): IssuedTransfusionOrder | null {
  if (row.voided || row.action === 'DISCONTINUE' || row.orderType?.uuid !== config.orderTypeUuid) return null;
  if (!row.concept?.uuid) throw new Error('FR08_ORDER_METADATA_UNAVAILABLE');
  if (row.concept.uuid !== config.conceptUuid) return null;
  const stored: { format?: unknown; request?: Snapshot } = JSON.parse(row.instructions);
  const request = stored?.request;
  if (
    stored?.format !== 'EG05-FR08/v1' ||
    !request ||
    !validFr08(request) ||
    request.priority !== 'scheduled' ||
    typeof request.patientName !== 'string' ||
    !request.patientName.trim() ||
    typeof request.historyNumber !== 'string' ||
    !request.historyNumber.trim() ||
    (request.sex !== 'M' && request.sex !== 'F') ||
    typeof request.age !== 'string' ||
    !row.patient?.uuid ||
    !row.encounter?.uuid ||
    !row.orderer?.display ||
    !row.orderNumber ||
    !Number.isFinite(Date.parse(row.dateActivated))
  ) {
    throw new Error('INVALID_FR08_ORDER');
  }
  return {
    order: {
      ...request,
      id: row.uuid,
      number: row.orderNumber,
      patientId: row.patient.uuid,
      encounterId: row.encounter.uuid,
      orderer: row.orderer.display,
      requestedAt: row.dateActivated,
      history: [],
    },
    fulfillerStatus: row.fulfillerStatus,
    stopped: Boolean(row.dateStopped),
  };
}

type OrderPage = { results: RestOrder[]; links?: { rel: string }[] };
async function readOrders(config: TransfusionOrderConfig, patientUuid?: string, accessionNumber?: string) {
  const params = new URLSearchParams({ orderTypes: config.orderTypeUuid, v: orderRep, limit: '100' });
  if (patientUuid) params.set('patient', patientUuid);
  if (accessionNumber) params.set('accessionNumber', accessionNumber);
  const found = new Map<string, IssuedTransfusionOrder>();
  let startIndex = 0;
  for (;;) {
    params.set('startIndex', String(startIndex));
    const { data } = await openmrsFetch<OrderPage>(`${restBaseUrl}/order?${params}`);
    for (const row of data.results) {
      if (
        (patientUuid && row.patient?.uuid !== patientUuid) ||
        (accessionNumber && row.accessionNumber !== accessionNumber)
      )
        continue;
      const order = readOrder(row, config);
      if (order) found.set(order.order.id, order);
    }
    if (!data.links?.some((link) => link.rel === 'next')) break;
    if (!data.results.length) throw new Error('INVALID_FR08_ORDER_PAGE');
    startIndex += data.results.length;
  }
  return [...found.values()].sort((a, b) => Date.parse(b.order.requestedAt) - Date.parse(a.order.requestedAt));
}
export const listIssuedTransfusionOrders = (config: TransfusionOrderConfig, patientUuid?: string) =>
  readOrders(config, patientUuid);

export async function createTransfusionOrder(
  config: TransfusionOrderConfig,
  context: {
    recipient: OrderRecipient;
    visitUuid: string;
    locationUuid: string;
    providerUuid: string;
    registration: string;
  },
  fields: Fr08Fields,
  accessionNumber: string,
): Promise<IssuedTransfusionOrder> {
  const { recipient, visitUuid, locationUuid, providerUuid, registration } = context;
  if (
    !recipient.historyNumber ||
    !recipient.name ||
    !visitUuid ||
    !locationUuid ||
    !providerUuid ||
    !validFr08(fields)
  ) {
    throw new Error('INVALID_FR08');
  }
  const find = async () => {
    const results = await readOrders(config, recipient.uuid, accessionNumber);
    if (results.length > 1) throw new Error('DUPLICATE_FR08_ORDER');
    return results[0];
  };
  const existing = await find();
  if (existing) return existing;
  const request: Snapshot = {
    ...fields,
    priority: 'scheduled',
    patientName: recipient.name,
    historyNumber: recipient.historyNumber,
    document: recipient.document,
    age: recipient.age,
    sex: recipient.sex,
    doctorLicense: registration,
  };
  try {
    await openmrsFetch(`${restBaseUrl}/encounter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        patient: recipient.uuid,
        visit: visitUuid,
        location: locationUuid,
        encounterType: config.encounterTypeUuid,
        orders: [
          {
            type: 'order',
            action: 'NEW',
            patient: recipient.uuid,
            orderer: providerUuid,
            orderType: config.orderTypeUuid,
            concept: config.conceptUuid,
            careSetting: config.careSettingUuid,
            urgency: 'ROUTINE',
            accessionNumber,
            instructions: JSON.stringify({ format: 'EG05-FR08/v1', request }),
          },
        ],
      },
    });
  } catch (error) {
    const recovered = await find();
    if (recovered) return recovered;
    throw error;
  }
  const saved = await find();
  if (!saved) throw new Error('FR08_ORDER_NOT_CONFIRMED');
  return saved;
}

export function issuedOrderStatus({ stopped, fulfillerStatus }: IssuedTransfusionOrder) {
  if (stopped) return 'fr08Cancelled';
  switch (fulfillerStatus) {
    case 'RECEIVED':
      return 'fr08Received';
    case 'IN_PROGRESS':
      return 'fr08InProgress';
    case 'COMPLETED':
      return 'fr08Fulfilled';
    case 'DECLINED':
      return 'fr08Declined';
    case 'ON_HOLD':
      return 'fr08OnHold';
    case 'EXCEPTION':
      return 'fr08Exception';
    default:
      return 'fr08Sent';
  }
}

export async function receiveTransfusionOrder(config: TransfusionOrderConfig, uuid: string) {
  const url = `${restBaseUrl}/order/${encodeURIComponent(uuid)}`;
  const { data } = await openmrsFetch<RestOrder>(`${url}?v=${encodeURIComponent(orderRep)}`);
  const request = readOrder(data, config);
  if (!request || request.stopped) throw new Error('FR08_ORDER_UNAVAILABLE');
  if (request.fulfillerStatus) {
    if (request.fulfillerStatus === 'RECEIVED') return;
    throw new Error('FR08_ORDER_STATE_CONFLICT');
  }
  await openmrsFetch(`${url}/fulfillerdetails/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { fulfillerStatus: 'RECEIVED' },
  });
}
