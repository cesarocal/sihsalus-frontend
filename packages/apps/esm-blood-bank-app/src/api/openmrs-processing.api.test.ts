import { openmrsFetch } from '@openmrs/esm-framework';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { openmrsCollectionApi, openmrsScreeningApi, processingEndpoints } from './blood-bank-processing.api';
import { fractionationEndpoints, openmrsFractionationApi } from './fractionation.api';

vi.mock('@openmrs/esm-framework', () => ({ openmrsFetch: vi.fn() }));

const fetchMock = vi.mocked(openmrsFetch);

describe('experimental processing OMOD adapters', () => {
  beforeEach(() => fetchMock.mockReset());

  it('creates a collection and then updates its server-assigned identifier', async () => {
    const draft = { id: 'new-collection-application-id', revision: 0 } as never;
    const saved = { id: 'collection-uuid', revision: 1 } as never;
    fetchMock.mockResolvedValueOnce({ data: saved } as never);
    expect(await openmrsCollectionApi.saveCollection(draft, 'label')).toEqual(saved);
    expect(fetchMock).toHaveBeenCalledWith(processingEndpoints.collections, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: { record: draft, step: 'label' },
    });
    fetchMock.mockResolvedValueOnce({ data: { id: 'collection-uuid', revision: 2 } } as never);
    await openmrsCollectionApi.saveCollection(saved, 'volume');
    expect(fetchMock).toHaveBeenLastCalledWith(`${processingEndpoints.collections}/collection-uuid`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: { record: saved, step: 'volume' },
    });
  });

  it('sends screening results and apheresis registration to distinct endpoints', async () => {
    const record = { id: 'sample-uuid', revision: 1 } as never;
    fetchMock.mockResolvedValueOnce({ data: record } as never);
    await openmrsScreeningApi.saveScreening(record, 'results');
    expect(fetchMock).toHaveBeenLastCalledWith(`${processingEndpoints.screenings}/sample-uuid`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: { record, step: 'results' },
    });
    const draft = { revision: 1, candidate: { applicationId: 'application-uuid' } } as never;
    fetchMock.mockResolvedValueOnce({ data: record } as never);
    await openmrsScreeningApi.registerApheresisSample(draft);
    expect(fetchMock).toHaveBeenLastCalledWith(processingEndpoints.apheresisSamples, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: draft,
    });
  });

  it('saves a repeat as a draft, records its results, and validates it by revision', async () => {
    const input = { roundId: 'sample-uuid-R2', revision: 0, results: { hbsag: 'nonReactive' as const }, operatorName: 'Laboratorio' };
    const response = { id: input.roundId, revision: 1, status: 'draft' };
    fetchMock.mockResolvedValueOnce({ data: response } as never);
    await expect(openmrsScreeningApi.saveScreeningRepeat('sample-uuid', input)).resolves.toEqual(response);
    expect(fetchMock).toHaveBeenLastCalledWith(`${processingEndpoints.screenings}/sample-uuid/repeats`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: { input, step: null },
    });

    for (const [step, revision] of [['results', 1], ['validation', 2]] as const) {
      const command = { ...input, revision };
      fetchMock.mockResolvedValueOnce({ data: { ...response, revision: revision + 1 } } as never);
      await openmrsScreeningApi.saveScreeningRepeat('sample-uuid', command, step);
      expect(fetchMock).toHaveBeenLastCalledWith(`${processingEndpoints.screenings}/sample-uuid/repeats`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: { input: command, step },
      });
    }
  });

  it('starts and finalizes a fractionation batch through the OMOD', async () => {
    const batch = { id: 'batch-uuid', revision: 1 } as never;
    fetchMock.mockResolvedValueOnce({ data: batch } as never);
    await openmrsFractionationApi.start(['unit-uuid'], 'location-uuid');
    expect(fetchMock).toHaveBeenLastCalledWith(fractionationEndpoints.start, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: { sourceIds: ['unit-uuid'], locationUuid: 'location-uuid' },
      rejectOnAuthFailure: true,
    });
    fetchMock.mockResolvedValueOnce({ data: batch } as never);
    await openmrsFractionationApi.finalize(batch);
    expect(fetchMock).toHaveBeenLastCalledWith(fractionationEndpoints.finalize('batch-uuid'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: batch,
      rejectOnAuthFailure: true,
    });
    await openmrsFractionationApi.recordPrint?.(batch, 'print-operation-uuid');
    expect(fetchMock).toHaveBeenLastCalledWith(fractionationEndpoints.print('batch-uuid'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: { revision: 1, operationUuid: 'print-operation-uuid' },
      rejectOnAuthFailure: true,
    });
  });
});
