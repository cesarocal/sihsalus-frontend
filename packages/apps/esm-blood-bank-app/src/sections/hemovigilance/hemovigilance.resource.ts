import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { readLinkedFr08 } from '../transfusions/transfusion-order.resource';
import type { TransfusionOrder, TransfusionRequest } from '../transfusions/transfusions.types';
import {
  type Actor,
  type Dispatch,
  demoMetadata,
  type Fields,
  reportDefaults,
  type Stage,
  type UnitCase,
  validStage,
} from './hemovigilance';

type Ref = { uuid: string };
type Event = {
  version: 1;
  orderId: string;
  kind: 'dispatch' | Stage;
  dispatch?: Dispatch;
  deliveredUnits?: Dispatch[];
  fields?: Fields;
  actor?: Actor;
  previous?: string;
};
type Encounter = {
  uuid: string;
  encounterDatetime: string;
  visit: Ref | null;
  location: Ref | null;
  patient: Ref;
  encounterType: Ref;
  obs?: { concept: Ref; value: unknown }[];
};
const stages = ['conduction', 'report', 'review', 'investigation'] as const;
const endpoint = (resource: string, params: Record<string, string>) =>
  `${restBaseUrl}/${resource}?${new URLSearchParams(params)}`;

export const isLocalHemovigilance = (useMockData: boolean) =>
  useMockData && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);

async function eligible(patientId: string) {
  const { data } = await openmrsFetch<{ person: { attributes: { attributeType: Ref; value: string }[] } }>(
    endpoint(`patient/${encodeURIComponent(patientId)}`, {
      v: 'custom:(person:(attributes:(attributeType:(uuid),value)))',
    }),
  );
  return data.person.attributes.some(
    ({ attributeType, value }) => attributeType.uuid === demoMetadata.testPatient && value === 'true',
  );
}

async function encounters(patientId: string) {
  const rows: { row: Encounter; event: Event }[] = [];
  for (let startIndex = 0; ; ) {
    const { data } = await openmrsFetch<{ results: Encounter[]; links?: { rel: string }[] }>(
      endpoint('encounter', {
        patient: patientId,
        limit: '100',
        startIndex: String(startIndex),
        v: 'custom:(uuid,encounterDatetime,patient:(uuid),encounterType:(uuid),obs:(concept:(uuid),value))',
      }),
    );
    for (const row of data.results) {
      const value = row.obs?.find((obs) => obs.concept.uuid === demoMetadata.text)?.value;
      if (row.patient.uuid !== patientId || typeof value !== 'string') continue;
      const event: Event = JSON.parse(value);
      if (
        event.version !== 1 ||
        !event.orderId ||
        (event.kind === 'dispatch'
          ? !(event.deliveredUnits?.length || event.dispatch?.unitCode)
          : !event.dispatch?.unitCode) ||
        demoMetadata.encounters[event.kind] !== row.encounterType.uuid
      )
        throw new Error('INVALID_HEMOVIGILANCE');
      rows.push({ row, event });
    }
    if (!data.links?.some((link) => link.rel === 'next') || !data.results.length) break;
    startIndex += data.results.length;
  }
  return rows.sort((a, b) => Date.parse(a.row.encounterDatetime) - Date.parse(b.row.encounterDatetime));
}

export async function listHemovigilance(orders: TransfusionOrder[]): Promise<UnitCase[]> {
  const patients = new Set(orders.map((order) => order.patientId));
  const streams = await Promise.all([...patients].map(async (id) => ((await eligible(id)) ? encounters(id) : [])));
  return combineCases(orders, streams.flat());
}

export async function listPatientHemovigilance(patientUuid: string) {
  if (!(await eligible(patientUuid))) return [];
  const events = await encounters(patientUuid);
  const orderIds = new Set(events.filter(({ event }) => event.kind === 'dispatch').map(({ event }) => event.orderId));
  const orders = await Promise.all([...orderIds].map((uuid) => readLinkedFr08(uuid, patientUuid)));
  return combineCases(orders, events);
}

function combineCases(orders: TransfusionOrder[], events: Awaited<ReturnType<typeof encounters>>): UnitCase[] {
  const map = new Map<string, UnitCase>();
  const orderById = new Map(orders.map((order) => [order.id, order]));
  for (const { row, event } of events.filter(({ event }) => event.kind === 'dispatch')) {
    const order = orderById.get(event.orderId);
    if (!order || order.patientId !== row.patient.uuid) continue;
    const deliveries = event.deliveredUnits ?? (event.dispatch ? [event.dispatch] : []);
    for (const dispatch of deliveries) {
      const id = `${order.id}/${dispatch.unitCode}`;
      if (!map.has(id)) map.set(id, { order, dispatch, sections: {} });
    }
  }
  for (const [id, unit] of map) {
    for (const stage of stages) {
      const revisions = events.filter(
        ({ event }) => event.kind === stage && `${event.orderId}/${event.dispatch?.unitCode}` === id,
      );
      let previous = '';
      while (revisions.length) {
        const next = revisions.filter(({ event }) => event.previous === previous);
        if (next.length !== 1) throw new Error('HEMOVIGILANCE_CONFLICT');
        const { row, event } = next[0];
        if (!event.fields || !event.actor) throw new Error('INVALID_HEMOVIGILANCE');
        unit.sections[stage] = { uuid: row.uuid, at: row.encounterDatetime, actor: event.actor, fields: event.fields };
        revisions.splice(revisions.indexOf(next[0]), 1);
        previous = row.uuid;
      }
    }
  }
  return [...map.values()];
}

async function persist(order: TransfusionOrder, event: Event) {
  const { data: parent } = await openmrsFetch<Encounter>(
    endpoint(`encounter/${encodeURIComponent(order.encounterId)}`, {
      v: 'custom:(uuid,patient:(uuid),visit:(uuid),location:(uuid))',
    }),
  );
  if (parent.patient.uuid !== order.patientId || !parent.visit || !parent.location)
    throw new Error('INVALID_HEMOVIGILANCE_ENCOUNTER');
  await openmrsFetch(`${restBaseUrl}/encounter`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      patient: order.patientId,
      visit: parent.visit.uuid,
      location: parent.location.uuid,
      encounterType: demoMetadata.encounters[event.kind],
      encounterDatetime: new Date().toISOString(),
      obs: [{ concept: demoMetadata.text, value: JSON.stringify(event) }],
    }),
  });
}

export async function recordDemoDispatch(request: TransfusionRequest) {
  if (!request.issuedOrder || !request.deliveredAt || !(await eligible(request.order.patientId))) return;
  const deliveredAt = request.deliveredAt;
  const existing = await listHemovigilance([request.order]);
  const assigned = request.assignments.filter(({ active }) => active);
  if (
    !assigned.length ||
    (existing.length && !existing.every((entry) => assigned.some(({ unit }) => unit.id === entry.dispatch.unitCode)))
  )
    throw new Error('HEMOVIGILANCE_DISPATCH_CONFLICT');
  const units = assigned.filter(({ unit }) => !existing.some((item) => item.dispatch.unitCode === unit.id));
  if (!units.length) return;
  await persist(request.order, {
    version: 1,
    kind: 'dispatch',
    orderId: request.order.id,
    deliveredUnits: units.map(({ unit }) => {
      if (!unit.componentType) throw new Error('INVALID_HEMOVIGILANCE_COMPONENT');
      return {
        unitCode: unit.id,
        lot: unit.bagLot,
        component: unit.componentType,
        bloodGroup: unit.bloodGroup,
        seal: unit.sealId ?? '',
        deliveredAt,
      };
    }),
  });
}

export async function saveHemovigilance(unit: UnitCase, kind: Stage, fields: Fields, actor: Actor) {
  const current = (await listHemovigilance([unit.order])).find(
    (entry) => entry.dispatch.unitCode === unit.dispatch.unitCode,
  );
  const previous = unit.sections[kind]?.uuid ?? '';
  const copied = reportDefaults(current?.sections.conduction?.fields);
  if (
    !current ||
    (current.sections[kind]?.uuid ?? '') !== previous ||
    !validStage(kind, fields, current.sections) ||
    (kind === 'report' && ['startTime', 'transfused'].some((key) => copied[key] && copied[key] !== fields[key])) ||
    !actor.name.trim() ||
    !actor.personUuid ||
    Object.values(fields).some((value) => typeof value !== 'string' || value.length > 500)
  )
    throw new Error('HEMOVIGILANCE_CONFLICT');
  await persist(unit.order, {
    version: 1,
    kind,
    orderId: unit.order.id,
    dispatch: unit.dispatch,
    previous,
    fields,
    actor,
  });
}

export async function actorLicense(personUuid: string, providerUuid: string) {
  if (!personUuid || !providerUuid) return '';
  const { data } = await openmrsFetch<{
    person: Ref | null;
    retired: boolean;
    attributes: { attributeType: { display: string }; value: unknown }[];
  }>(
    endpoint(`provider/${encodeURIComponent(providerUuid)}`, {
      v: 'custom:(person:(uuid),retired,attributes:(attributeType:(display),value))',
    }),
  );
  if (data.retired || data.person?.uuid !== personUuid) return '';
  const registration = data.attributes.find(
    ({ attributeType }) => attributeType.display === 'Número de Colegiatura',
  )?.value;
  return typeof registration === 'string' ? registration : '';
}
