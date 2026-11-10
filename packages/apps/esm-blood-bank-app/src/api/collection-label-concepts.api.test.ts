import { type FetchResponse, openmrsFetch } from '@openmrs/esm-framework';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCollectionLabelConceptLoader } from './collection-label-concepts.api';

vi.mock('@openmrs/esm-framework', () => ({ openmrsFetch: vi.fn(), restBaseUrl: '/ws/rest/v1' }));

const fetchMock = vi.mocked(openmrsFetch);
const response = (data: unknown) => ({ data }) as FetchResponse<unknown>;
const catalog = createCollectionLabelConceptLoader({
  bloodBankServiceUuid: 'test-bank',
  campaignServiceUuid: 'test-campaign',
  anticoagulantSetUuid: 'test-anticoagulants',
});

beforeEach(() => fetchMock.mockReset());

describe('OpenMRS collection label concepts', () => {
  it('loads only the two configured services with the active session', async () => {
    const bank = { uuid: 'test-bank', display: 'UPSS Banco de Sangre' };
    const campaign = { uuid: 'test-campaign', display: 'Campaña de donación' };
    fetchMock.mockResolvedValueOnce(response({ ...bank, retired: false }));
    fetchMock.mockResolvedValueOnce(response({ ...campaign, retired: false }));
    expect(await catalog('service')).toEqual([bank, campaign]);
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/ws/rest/v1/concept/test-bank?v=custom:(uuid,display,retired)', {
      rejectOnAuthFailure: true,
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/ws/rest/v1/concept/test-campaign?v=custom:(uuid,display,retired)', {
      rejectOnAuthFailure: true,
    });
  });

  it('lists only active, distinct members of the configured anticoagulant set', async () => {
    const active = { uuid: 'test-cpda', display: 'CPDA-1', retired: false };
    fetchMock.mockResolvedValueOnce(
      response({
        uuid: 'test-anticoagulants',
        display: 'Anticoagulants',
        retired: false,
        set: true,
        setMembers: [active, { uuid: 'retired', display: 'Retired', retired: true }, active],
      }),
    );
    expect(await catalog('anticoagulant')).toEqual([{ uuid: 'test-cpda', display: 'CPDA-1' }]);
    expect(fetchMock).toHaveBeenCalledWith(
      '/ws/rest/v1/concept/test-anticoagulants?v=custom:(uuid,display,retired,set,setMembers:(uuid,display,retired))',
      { rejectOnAuthFailure: true },
    );
  });

  it('distinguishes an empty catalog from invalid or unavailable metadata', async () => {
    const set = { uuid: 'test-anticoagulants', display: 'Anticoagulants', set: true, retired: false, setMembers: [] };
    fetchMock.mockResolvedValueOnce(response(set));
    await expect(catalog('anticoagulant')).resolves.toEqual([]);
    fetchMock.mockResolvedValueOnce(response({ ...set, retired: true }));
    await expect(catalog('anticoagulant')).rejects.toThrow('COLLECTION_CONCEPT_UNAVAILABLE');
    await expect(createCollectionLabelConceptLoader({})('service')).rejects.toThrow(
      'COLLECTION_SERVICES_NOT_CONFIGURED',
    );
    fetchMock.mockRejectedValueOnce(new Error('SESSION_EXPIRED'));
    await expect(catalog('anticoagulant')).rejects.toThrow('SESSION_EXPIRED');
  });
});
