import { openmrsFetch } from '@openmrs/esm-framework';
import { beforeEach, expect, it, vi } from 'vitest';
import { cmvIgGTestName } from '../sections/laboratory/screening/screening.types';
import { createLaboratoryCatalogs } from './laboratory-catalogs.api';

vi.mock('@openmrs/esm-framework', () => ({ openmrsFetch: vi.fn(), restBaseUrl: '/ws/rest/v1' }));
const fetch = vi.mocked(openmrsFetch);

beforeEach(() => {
  fetch.mockReset();
});

it('reads active OpenMRS members and rejects an unconfigured set without a request', async () => {
  const catalogs = createLaboratoryCatalogs({ storageTemperatureSetUuid: 'temperatures' });
  await expect(catalogs.listLabelConcepts('antibodies')).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
  fetch.mockResolvedValue({
    data: {
      uuid: 'temperatures',
      display: 'Temperatures',
      retired: false,
      set: true,
      setMembers: [
        { uuid: 'refrigerated', display: '1–6 °C', retired: false },
        { uuid: 'retired', display: 'Retired', retired: true },
      ],
    },
  } as Awaited<ReturnType<typeof openmrsFetch>>);
  await expect(catalogs.listLabelConcepts('storageTemperature')).resolves.toEqual([
    { uuid: 'refrigerated', display: '1–6 °C' },
  ]);
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/concept/temperatures'), { rejectOnAuthFailure: true });
});

it('accepts the specific CMV IgG test and excludes other CMV tests', async () => {
  const catalogs = createLaboratoryCatalogs({});
  fetch.mockResolvedValue({
    data: {
      results: [
        { uuid: 'igg', display: cmvIgGTestName, retired: false },
        { uuid: 'igm', display: 'CMV IgM', retired: false },
      ],
    },
  } as Awaited<ReturnType<typeof openmrsFetch>>);
  await expect(catalogs.listAdditionalTestConcepts()).resolves.toEqual([{ uuid: 'igg', display: cmvIgGTestName }]);
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/concept?q='), { rejectOnAuthFailure: true });
  fetch.mockRejectedValue(new Error('expired session'));
  await expect(catalogs.listAdditionalTestConcepts()).rejects.toThrow('expired session');
});
