import { openmrsFetch } from '@openmrs/esm-framework';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { transfusionRequestsMock } from '../mocks/transfusions.mock';
import type {
  RecipientSample,
  TransfusionDraft,
  TransfusionRequest,
} from '../sections/transfusions/transfusions.types';
import { openmrsTransfusionsApi } from './transfusions.api';

vi.mock('@openmrs/esm-framework', () => ({ openmrsFetch: vi.fn() }));

const fetchMock = vi.mocked(openmrsFetch);
const issuedOrderUuid = 'ae510a22-12bf-4b5b-a026-3b071f4dc230';
const base = '/ws/rest/v1/bloodbank/transfusion-requests';
const requestUrl = `${base}/${issuedOrderUuid}`;
const source = transfusionRequestsMock()[2];
const prepared: TransfusionRequest = {
  ...source,
  id: issuedOrderUuid,
  issuedOrder: true,
  revision: 1,
  order: { ...source.order, id: issuedOrderUuid, items: [{ component: 'freshFrozenPlasma', quantity: 2 }] },
};

function replyWith<T>(data: T) {
  fetchMock.mockResolvedValueOnce(Object.assign(new Response(null), { data }));
}

function expectWrite(suffix: string, body: object, method = 'POST') {
  expect(fetchMock).toHaveBeenLastCalledWith(`${requestUrl}/${suffix}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body,
    rejectOnAuthFailure: true,
  });
}

describe('native FR08 adapter', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('reads the bank workspace and prepares the issued native order by UUID', async () => {
    const workspace = { requests: [prepared], units: [], bookEntries: [] };
    replyWith(workspace);
    replyWith([]);
    expect(await openmrsTransfusionsApi.list()).toEqual({ ...workspace, returns: [] });
    expect(fetchMock).toHaveBeenNthCalledWith(1, base, { method: 'GET', rejectOnAuthFailure: true });
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/ws/rest/v1/bloodbank/transfusion-returns', {
      method: 'GET',
      rejectOnAuthFailure: true,
    });

    replyWith(prepared);
    expect(await openmrsTransfusionsApi.prepareIssuedRequest?.(prepared.order)).toEqual(prepared);
    expect(fetchMock).toHaveBeenLastCalledWith(requestUrl, { method: 'POST', rejectOnAuthFailure: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('records receipt and inspection against the dispatched detail rather than the request', async () => {
    const receipt = { returnedBy: 'Test', receivedBy: 'Test', reason: 'Test', administration: 'unused' } as const;
    const decisionUuid = '61e04227-31e2-4fdc-bc23-cb8ab1941cd3';
    const dispatch = 'dispatch/detail';
    const saved = { receipt: { ...receipt, at: '2026-11-22T17:00:00Z' }, dispatchId: dispatch };
    replyWith(saved);
    expect(await openmrsTransfusionsApi.receiveReturnedUnit?.(dispatch, decisionUuid, receipt)).toEqual(saved);
    expect(fetchMock).toHaveBeenLastCalledWith('/ws/rest/v1/bloodbank/transfusion-returns/dispatch%2Fdetail/receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { consentDecisionUuid: decisionUuid, receipt },
      rejectOnAuthFailure: true,
    });
  });

  it('sends draft, review, sample, unit assignment and dispatch with the revision from the prior response', async () => {
    const draft: TransfusionDraft = {
      ...prepared.draft,
      reviewer: 'Revisor sintético',
      reviewVerified: true,
      consentVerified: true,
      consentEncounterUuid: '61e04227-31e2-4fdc-bc23-cb8ab1941cd3',
    };
    const draftSaved = { ...prepared, draft, revision: 2 };
    replyWith(draftSaved);
    const saved = await openmrsTransfusionsApi.saveDraft(issuedOrderUuid, prepared.revision, draft);
    expect(saved).toEqual(draftSaved);
    expectWrite('draft', { revision: 1, draft }, 'PUT');

    const reviewed: TransfusionRequest = { ...draftSaved, status: 'reviewed', revision: 3 };
    replyWith(reviewed);
    const checked = await openmrsTransfusionsApi.review(issuedOrderUuid, saved.revision, draft);
    expect(checked).toEqual(reviewed);
    expectWrite('review', { revision: 2, draft });

    const sample: RecipientSample = {
      code: `M-REC-${prepared.order.number}`,
      historyNumber: prepared.order.historyNumber,
      collectedAt: '2026-11-22T16:40:00Z',
      collectedBy: 'Profesional sintético',
      printRequestedAt: '2026-11-22T16:40:00Z',
    };
    replyWith({ ...reviewed, sample, status: 'sampleReady', revision: 4 } satisfies TransfusionRequest);
    const sampled = await openmrsTransfusionsApi.saveSample(issuedOrderUuid, checked.revision, sample);
    expect(sampled.sample).toEqual(sample);
    expectWrite('recipient-sample', { revision: 3, sample });

    const unitIds = ['UNIT-SYNTHETIC-1', 'UNIT-SYNTHETIC-2'];
    replyWith({ ...sampled, status: 'compatible', revision: 5 } satisfies TransfusionRequest);
    const assigned = await openmrsTransfusionsApi.assign(issuedOrderUuid, sampled.revision, unitIds, true);
    expect(assigned.revision).toBe(5);
    expectWrite('assignments', { revision: 4, unitIds, verified: true });

    const dispatchDraft: TransfusionDraft = {
      ...assigned.draft,
      collectorName: 'Técnico sintético',
      collectorDocument: '90000001',
      deliveredBy: 'Profesional sintético',
      releaseVerified: true,
    };
    const dispatched: TransfusionRequest = {
      ...assigned,
      status: 'delivered',
      requesterStatus: 'ATENDIDA',
      deliveredAt: '2026-11-22T17:15:00Z',
      revision: 6,
    };
    replyWith(dispatched);
    expect(await openmrsTransfusionsApi.deliver(issuedOrderUuid, assigned.revision, dispatchDraft)).toEqual(dispatched);
    expectWrite('deliver', { revision: 5, draft: dispatchDraft });
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it('propagates a rejected dispatch instead of returning a synthetic receipt', async () => {
    const error = new Error('TRANSFUSION_STOCK_CONFLICT');
    fetchMock.mockRejectedValueOnce(error);
    await expect(openmrsTransfusionsApi.deliver(issuedOrderUuid, prepared.revision, prepared.draft)).rejects.toBe(
      error,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
