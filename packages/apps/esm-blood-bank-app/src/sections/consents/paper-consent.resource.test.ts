import { openmrsFetch } from '@openmrs/esm-framework';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PaperConsentConfig } from '../../config-schema';
import {
  type ConsentInput,
  type ConsentSubject,
  listConsent,
  permitsAdministration,
  saveConsent,
} from './paper-consent.resource';

vi.mock('@openmrs/esm-framework', () => ({ restBaseUrl: '/ws/rest/v1', openmrsFetch: vi.fn() }));

const metadata: PaperConsentConfig = {
  donorEncounterTypeUuid: 'fr05',
  recipientEncounterTypeUuid: 'fr12',
  documentConceptUuid: 'document',
  encounterRoleUuid: 'signer-role',
};
const uuid = (suffix: number) => `11111111-1111-4111-8111-${String(suffix).padStart(12, '0')}`;
const patient = { uuid: uuid(1) };
const visit = { uuid: uuid(2) };
const location = { uuid: uuid(3) };
const provider = { uuid: uuid(4), display: 'Profesional de prueba' };
const orderEncounter = uuid(5);
const orderId = uuid(6);
const donor: ConsentSubject = {
  kind: 'donor',
  id: 'test-application',
  number: '001',
  patientId: patient.uuid,
  contextId: visit.uuid,
  name: 'Postulante de prueba',
  identification: 'TEST-01',
};
const recipient: ConsentSubject = {
  ...donor,
  kind: 'recipient',
  id: orderId,
  number: 'ORD-00',
  contextId: orderEncounter,
};
const granted: ConsentInput = {
  decision: 'granted',
  folio: 'TEST-01',
  decidedAt: '2026-11-21T15:15:00.000Z',
  signer: donor.name,
  signerRole: 'self',
};
const fetch = vi.mocked(openmrsFetch);
const serverTime = 'Sat, 21 Nov 2026 16:00:00 GMT';
const response = (data: unknown) =>
  ({
    data,
    headers: new Headers({ Date: serverTime }),
  }) as Awaited<ReturnType<typeof openmrsFetch>>;
const row = (id: number, subject = recipient, fields = granted, operation = uuid(id + 100)) => ({
  uuid: uuid(id),
  patient,
  visit,
  encounterType: { uuid: subject.kind === 'donor' ? 'fr05' : 'fr12' },
  encounterDatetime: '2026-11-21T15:58:00.000Z',
  obs: [
    {
      concept: { uuid: 'document' },
      value: JSON.stringify({
        ...fields,
        format: subject.kind === 'donor' ? 'EG05-FR05/v1' : 'EG05-FR12/v1',
        reference: subject.id,
        operation,
      }),
    },
  ],
  encounterProviders: [{ provider }],
});

describe('paper consent encounters', () => {
  beforeEach(() => fetch.mockReset());

  it('reads only decisions for the requested FR08 and uses the most recent decision', async () => {
    const revoked = { ...granted, decision: 'revoked' as const, decidedAt: '2026-11-21T15:30:00.000Z' };
    fetch.mockResolvedValue(
      response({ results: [row(10), row(11, { ...recipient, id: uuid(13) }, revoked), row(12, recipient, revoked)] }),
    );
    const records = await listConsent(metadata, recipient);
    expect(records.map(({ uuid, decision }) => [uuid, decision])).toEqual([
      [uuid(12), 'revoked'],
      [uuid(10), 'granted'],
    ]);
    expect(fetch.mock.calls[0][0]).toContain(`patient=${patient.uuid}`);
  });

  it('does not reopen a closed FR08, even if a grant is recorded concurrently', async () => {
    const declined = { ...granted, decision: 'declined' as const, reason: 'Negativa escrita' };
    const laterGrant = { ...granted, decidedAt: '2026-11-21T15:16:00.000Z' };
    fetch.mockResolvedValue(response({ results: [row(10, recipient, declined), row(11, recipient, laterGrant)] }));
    expect((await listConsent(metadata, recipient)).map(({ decision }) => decision)).toEqual(['declined', 'granted']);
    await expect(saveConsent(metadata, recipient, laterGrant, provider.uuid, uuid(102), uuid(10))).rejects.toThrow(
      'CONSENT_CONFLICT',
    );
    expect(fetch.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
  });

  it('records a documented emergency separately from the signed FR12 for a very urgent order', async () => {
    const emergency: ConsentInput = {
      decision: 'emergency',
      folio: '',
      decidedAt: granted.decidedAt,
      signer: '',
      signerRole: 'physician',
      reason: 'Emergencia documentada en la historia clínica',
    };
    const veryUrgent = { ...recipient, priority: 'veryUrgent' as const };
    await expect(saveConsent(metadata, recipient, emergency, provider.uuid, uuid(102))).rejects.toThrow(
      'CONSENT_INVALID_INPUT',
    );
    expect(fetch).not.toHaveBeenCalled();
    fetch.mockResolvedValueOnce(response({ results: [] }));
    fetch.mockResolvedValueOnce(response({ patient, location, visit }));
    fetch.mockResolvedValueOnce(response({ patient, location }));
    fetch.mockResolvedValueOnce(response({ uuid: uuid(10) }));
    fetch.mockResolvedValueOnce(response({ results: [row(10, veryUrgent, emergency, uuid(102))] }));
    const record = await saveConsent(metadata, veryUrgent, emergency, provider.uuid, uuid(102));
    expect(record).toMatchObject({
      decision: 'emergency',
      provider: provider.display,
      folio: '',
      reason: emergency.reason,
    });
    expect(permitsAdministration(veryUrgent, record)).toBe(true);
    expect(permitsAdministration(recipient, record)).toBe(false);
  });

  it('writes a signed FR05 to the donor visit and recovers an ambiguous response without duplicating it', async () => {
    const operation = uuid(100);
    fetch.mockResolvedValueOnce(response({ results: [] }));
    fetch.mockResolvedValueOnce(response({ patient, location }));
    fetch.mockRejectedValueOnce(new Error('Response lost'));
    fetch.mockResolvedValueOnce(response({ results: [row(10, donor, granted, operation)] }));
    const saved = await saveConsent(metadata, donor, granted, provider.uuid, operation);
    expect(saved.folio).toBe('TEST-01');
    const post = fetch.mock.calls[2][1];
    expect(JSON.parse(String(post?.body))).toMatchObject({
      patient: patient.uuid,
      visit: visit.uuid,
      location: location.uuid,
      encounterType: 'fr05',
      encounterProviders: [{ provider: provider.uuid, encounterRole: metadata.encounterRoleUuid }],
      obs: [{ concept: 'document', value: expect.stringContaining('TEST-01') }],
    });
  });

  it('saves a new FR12 using the FR08 reference without a paper folio', async () => {
    const operation = uuid(102);
    const signed: ConsentInput = {
      decision: 'granted',
      signer: recipient.name,
      signerRole: 'self',
      decidedAt: granted.decidedAt,
    };
    fetch.mockResolvedValueOnce(response({ results: [] }));
    fetch.mockResolvedValueOnce(response({ patient, location, visit }));
    fetch.mockResolvedValueOnce(response({ patient, location }));
    fetch.mockResolvedValueOnce(response({ uuid: uuid(10) }));
    fetch.mockResolvedValueOnce(response({ results: [row(10, recipient, signed, operation)] }));
    const record = await saveConsent(metadata, recipient, signed, provider.uuid, operation);
    expect(record.decision).toBe('granted');
    const body = JSON.parse(String(fetch.mock.calls[3][1]?.body));
    const document = JSON.parse(body.obs[0].value);
    expect(document).toMatchObject({ format: 'EG05-FR12/v1', reference: recipient.id, ...signed });
    expect(document).not.toHaveProperty('folio');
  });

  it('rejects a stale grant and checks patient ownership before writing a new recipient decision', async () => {
    fetch.mockResolvedValueOnce(response({ results: [row(10)] }));
    await expect(saveConsent(metadata, recipient, granted, provider.uuid, uuid(101))).rejects.toThrow(
      'CONSENT_CONFLICT',
    );
    fetch.mockResolvedValueOnce(response({ results: [] }));
    fetch.mockResolvedValueOnce(response({ patient: { uuid: uuid(8) }, location, visit }));
    await expect(saveConsent(metadata, recipient, granted, provider.uuid, uuid(101))).rejects.toThrow(
      'CONSENT_MISSING_CONTEXT',
    );
    expect(fetch.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
  });
});
