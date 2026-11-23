import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import type { PaperConsentConfig } from '../../config-schema';
import type { SelectionApplication } from '../applicant-selection/selection.types';
import { isHemovigilanceTestPatient } from '../hemovigilance/hemovigilance.resource';
import type { TransfusionOrder } from '../transfusions/transfusions.types';

type Ref = { uuid: string };
type Parent = { patient: Ref; location: Ref | null };
type ConsentKind = 'donor' | 'recipient';
export type ConsentSubject = {
  kind: ConsentKind;
  id: string;
  number: string;
  patientId: string;
  contextId: string;
  name: string;
  identification: string;
  age?: string;
  sex?: TransfusionOrder['sex'];
  service?: string;
  bed?: string;
  priority?: TransfusionOrder['priority'];
  demo?: boolean;
};
export type Decision = 'granted' | 'declined' | 'revoked' | 'emergency';
export const recipientConsentChanged = 'blood-bank-recipient-consent-changed';

export function closesTransfusion(decision?: Decision): decision is 'declined' | 'revoked' {
  return decision === 'declined' || decision === 'revoked';
}

export function permitsAdministration(subject: ConsentSubject, record?: ConsentRecord) {
  return record?.decision === 'granted' || (subject.priority === 'veryUrgent' && record?.decision === 'emergency');
}
export type ConsentInput = {
  decision: Decision;
  folio?: string;
  decidedAt: string;
  signer: string;
  signerRole: 'self' | 'representative' | 'physician';
  reason?: string;
};
export type ConsentRecord = ConsentInput & { uuid: string; recordedAt: string; provider: string };
type Document = ConsentInput & { format: string; reference: string; operation: string };
type Encounter = {
  uuid: string;
  patient: Ref;
  visit: Ref | null;
  encounterType: Ref;
  encounterDatetime: string;
  voided?: boolean;
  obs?: { concept: Ref; value: unknown; voided?: boolean }[];
  encounterProviders?: { provider: Ref & { display?: string } }[];
};
type EncounterPage = { results: Encounter[]; links?: { rel: string }[] };

const uuidPattern = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
export const isClinicalUuid = (value?: string) => Boolean(value && uuidPattern.test(value));
export const consentFormat = (kind: ConsentKind) => (kind === 'donor' ? 'EG05-FR05' : 'EG05-FR12');
const encounterType = (metadata: PaperConsentConfig, kind: ConsentKind) =>
  kind === 'donor' ? metadata.donorEncounterTypeUuid : metadata.recipientEncounterTypeUuid;
const endpoint = (path: string, params: Record<string, string>) =>
  `${restBaseUrl}/${path}?${new URLSearchParams(params)}`;
const requestOptions = { cache: 'no-store', rejectOnAuthFailure: true } as const;

export function donorConsentSubject(
  application: SelectionApplication,
  metadata?: PaperConsentConfig,
  localDemo = false,
): ConsentSubject {
  const demo = localDemo && application.id === metadata?.demoDonorApplicationId;
  return {
    kind: 'donor',
    id: application.id,
    number: application.number,
    patientId: (demo ? metadata.demoDonorPatientUuid : application.patientUuid) ?? '',
    contextId: (demo ? metadata.demoDonorVisitUuid : application.visitUuid) ?? '',
    name: [application.personal.givenName, application.personal.familyName].filter(Boolean).join(' '),
    identification: `${application.admission.documentType} ${application.admission.documentNumber}`,
    demo,
  };
}

export function recipientConsentSubject(order: TransfusionOrder): ConsentSubject {
  return {
    kind: 'recipient',
    id: order.id,
    number: order.number,
    patientId: order.patientId,
    contextId: order.encounterId,
    name: order.patientName,
    identification: order.historyNumber,
    age: order.age,
    sex: order.sex,
    service: order.service,
    bed: order.bed,
    priority: order.priority,
  };
}

function hasSubject(subject: ConsentSubject) {
  return subject.id && isClinicalUuid(subject.patientId) && isClinicalUuid(subject.contextId);
}

export function validConsentInput(input: ConsentInput, kind: ConsentKind) {
  if (input.reason !== undefined && (typeof input.reason !== 'string' || input.reason.length > 500)) return false;
  if (input.decision === 'emergency') {
    return (
      input.signerRole === 'physician' &&
      input.signer === '' &&
      kind === 'recipient' &&
      (input.folio === undefined || input.folio === '') &&
      Boolean(input.reason?.trim()) &&
      Number.isFinite(Date.parse(input.decidedAt))
    );
  }
  return (
    ['granted', 'declined', 'revoked'].includes(input.decision) &&
    (input.folio === undefined || (typeof input.folio === 'string' && input.folio.length <= 80)) &&
    (kind === 'recipient' || Boolean(input.folio?.trim())) &&
    typeof input.signer === 'string' &&
    Boolean(input.signer.trim()) &&
    input.signer.length <= 200 &&
    ['self', 'representative'].includes(input.signerRole) &&
    Number.isFinite(Date.parse(input.decidedAt))
  );
}

type ConsentEntry = { record: ConsentRecord; operation: string };

async function readConsentEncounters(patientId: string, type: string) {
  const rows: Encounter[] = [];
  for (let startIndex = 0; ; ) {
    const { data } = await openmrsFetch<EncounterPage>(
      endpoint('encounter', {
        patient: patientId,
        encounterType: type,
        limit: '100',
        startIndex: String(startIndex),
        v: 'custom:(uuid,encounterDatetime,voided,patient:(uuid),visit:(uuid),encounterType:(uuid),obs:(concept:(uuid),value,voided),encounterProviders:(provider:(uuid,display)))',
      }),
      requestOptions,
    );
    rows.push(
      ...data.results.filter((row) => !row.voided && row.patient.uuid === patientId && row.encounterType.uuid === type),
    );
    if (!data.links?.some(({ rel }) => rel === 'next')) return rows;
    if (!data.results.length) throw new Error('CONSENT_INVALID_PAGE');
    startIndex += data.results.length;
  }
}

function consentEntries(metadata: PaperConsentConfig, subject: ConsentSubject, rows: Encounter[]) {
  const entries: ConsentEntry[] = [];
  for (const row of rows) {
    if (subject.kind === 'donor' && row.visit?.uuid !== subject.contextId) continue;
    const values = (row.obs ?? []).filter(
      ({ concept, voided }) => concept.uuid === metadata.documentConceptUuid && !voided,
    );
    if (values.length !== 1 || typeof values[0].value !== 'string') throw new Error('CONSENT_INVALID_RECORD');
    const document = JSON.parse(values[0].value) as Document | null;
    if (!document?.reference) throw new Error('CONSENT_INVALID_RECORD');
    if (document.reference !== subject.id) continue;
    if (
      document.format !== `${consentFormat(subject.kind)}/v1` ||
      !validConsentInput(document, subject.kind) ||
      (document.decision === 'emergency' && (subject.kind !== 'recipient' || subject.priority !== 'veryUrgent')) ||
      !isClinicalUuid(document.operation) ||
      !Number.isFinite(Date.parse(row.encounterDatetime))
    )
      throw new Error('CONSENT_INVALID_RECORD');
    const { operation, format: _format, reference: _reference, ...fields } = document;
    entries.push({
      operation,
      record: {
        ...fields,
        uuid: row.uuid,
        recordedAt: row.encounterDatetime,
        provider: row.encounterProviders?.[0]?.provider.display ?? '',
      },
    });
  }
  return entries.sort((a, b) => {
    const decisionOrder = Date.parse(b.record.decidedAt) - Date.parse(a.record.decidedAt);
    const recordedOrder = Date.parse(b.record.recordedAt) - Date.parse(a.record.recordedAt);
    const closureOrder = Number(closesTransfusion(b.record.decision)) - Number(closesTransfusion(a.record.decision));
    const signedOrder = Number(a.record.decision === 'emergency') - Number(b.record.decision === 'emergency');
    // A signed refusal or withdrawal closes the referred FR08 even if another session records a grant concurrently.
    return (
      (subject.kind === 'recipient' ? closureOrder : 0) ||
      decisionOrder ||
      closureOrder ||
      signedOrder ||
      recordedOrder ||
      b.record.uuid.localeCompare(a.record.uuid)
    );
  });
}

async function consentEncounters(metadata: PaperConsentConfig, subject: ConsentSubject) {
  if (!hasSubject(subject)) throw new Error('CONSENT_MISSING_CONTEXT');
  if (subject.demo && !(await isHemovigilanceTestPatient(subject.patientId)))
    throw new Error('CONSENT_TEST_PATIENT_REQUIRED');
  const rows = await readConsentEncounters(subject.patientId, encounterType(metadata, subject.kind));
  return consentEntries(metadata, subject, rows);
}

export async function listConsent(metadata: PaperConsentConfig, subject: ConsentSubject) {
  return (await consentEncounters(metadata, subject)).map(({ record }) => record);
}

/** Reuse the encounter query for multiple FR08 orders for the same patient. Missing keys mean a read failure. */
export async function listLatestRecipientConsents(metadata: PaperConsentConfig, orders: TransfusionOrder[]) {
  const byPatient = new Map<string, Promise<Encounter[]>>();
  const results = await Promise.allSettled(
    orders.map(async (order) => {
      const subject = recipientConsentSubject(order);
      if (!hasSubject(subject)) throw new Error('CONSENT_MISSING_CONTEXT');
      if (!byPatient.has(subject.patientId)) {
        byPatient.set(subject.patientId, readConsentEncounters(subject.patientId, metadata.recipientEncounterTypeUuid));
      }
      const rows = await byPatient.get(subject.patientId);
      return [order.id, consentEntries(metadata, subject, rows ?? [])[0]?.record] as const;
    }),
  );
  return new Map(results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : [])));
}

async function readVisit(subject: ConsentSubject) {
  const { data: encounter } =
    subject.kind === 'recipient'
      ? await openmrsFetch<Parent & { visit: Ref | null }>(
          endpoint(`encounter/${encodeURIComponent(subject.contextId)}`, {
            v: 'custom:(patient:(uuid),location:(uuid),visit:(uuid))',
          }),
          requestOptions,
        )
      : { data: undefined };
  if (encounter && (encounter.patient.uuid !== subject.patientId || !encounter.visit))
    throw new Error('CONSENT_MISSING_CONTEXT');
  const id = encounter?.visit?.uuid ?? subject.contextId;
  const { data: visit, headers } = await openmrsFetch<Parent & { stopDatetime?: string; voided?: boolean }>(
    endpoint(`visit/${encodeURIComponent(id)}`, { v: 'custom:(patient:(uuid),location:(uuid),stopDatetime,voided)' }),
    requestOptions,
  );
  const location = encounter?.location ?? visit.location;
  if (visit.voided || visit.patient.uuid !== subject.patientId || !location?.uuid)
    throw new Error('CONSENT_MISSING_CONTEXT');
  const date = Date.parse(headers?.get('Date') ?? '');
  return {
    id,
    location: location.uuid,
    time: Number.isFinite(date) ? date : Date.now(),
    endTime: Date.parse(visit.stopDatetime ?? ''),
  };
}

export async function saveConsent(
  metadata: PaperConsentConfig,
  subject: ConsentSubject,
  input: ConsentInput,
  providerUuid: string,
  operation: string,
  previous?: string,
) {
  if (
    !validConsentInput(input, subject.kind) ||
    !isClinicalUuid(providerUuid) ||
    !isClinicalUuid(operation) ||
    (input.decision === 'emergency' && (subject.kind !== 'recipient' || subject.priority !== 'veryUrgent')) ||
    (subject.kind === 'recipient' && closesTransfusion(input.decision) && !input.reason?.trim())
  )
    throw new Error('CONSENT_INVALID_INPUT');
  const entries = await consentEncounters(metadata, subject);
  const alreadySaved = entries.find((entry) => entry.operation === operation);
  if (alreadySaved) return alreadySaved.record;
  const latest = entries[0]?.record;
  if (
    latest?.uuid !== previous ||
    (latest && Date.parse(input.decidedAt) < Date.parse(latest.decidedAt)) ||
    (input.decision === 'revoked' && latest?.decision !== 'granted') ||
    (subject.kind === 'recipient' && closesTransfusion(latest?.decision)) ||
    (input.decision === 'emergency' && Boolean(latest))
  )
    throw new Error('CONSENT_CONFLICT');
  const visit = await readVisit(subject);
  if (Date.parse(input.decidedAt) >= visit.time + 60_000) throw new Error('CONSENT_INVALID_INPUT');
  const at = new Date(Math.min(visit.time - 1000, Number.isFinite(visit.endTime) ? visit.endTime : visit.time))
    .toISOString()
    .replace('Z', '+00:00');
  const { folio, ...decision } = input;
  const document: Document = {
    ...decision,
    ...(subject.kind === 'donor' ? { folio: folio?.trim() } : {}),
    signer: input.signer.trim(),
    ...(input.reason ? { reason: input.reason.trim() } : {}),
    format: `${consentFormat(subject.kind)}/v1`,
    reference: subject.id,
    operation,
  };
  try {
    const { data } = await openmrsFetch<Ref>(`${restBaseUrl}/encounter`, {
      ...requestOptions,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patient: subject.patientId,
        visit: visit.id,
        location: visit.location,
        encounterType: encounterType(metadata, subject.kind),
        encounterDatetime: at,
        encounterProviders: [{ provider: providerUuid, encounterRole: metadata.encounterRoleUuid }],
        obs: [{ concept: metadata.documentConceptUuid, value: JSON.stringify(document) }],
      }),
    });
    if (!data.uuid) throw new Error('CONSENT_UNCONFIRMED_WRITE');
  } catch (error) {
    const recovered = (await consentEncounters(metadata, subject)).find((entry) => entry.operation === operation);
    if (recovered) return recovered.record;
    throw error;
  }
  const saved = (await consentEncounters(metadata, subject)).find((entry) => entry.operation === operation);
  if (!saved) throw new Error('CONSENT_UNCONFIRMED_WRITE');
  return saved.record;
}
