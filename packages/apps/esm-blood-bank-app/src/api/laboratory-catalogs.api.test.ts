import { openmrsFetch } from '@openmrs/esm-framework';
import { beforeEach, expect, it, vi } from 'vitest';
import { cmvIgGConceptUuid, cmvIgGTestName } from '../sections/laboratory/screening/screening.types';
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

it('loads the module-owned CMV IgG test by UUID', async () => {
  const catalogs = createLaboratoryCatalogs({});
  fetch.mockResolvedValue({
    data: { uuid: cmvIgGConceptUuid, display: cmvIgGTestName, retired: false },
  } as Awaited<ReturnType<typeof openmrsFetch>>);
  await expect(catalogs.listAdditionalTestConcepts()).resolves.toEqual([
    { uuid: cmvIgGConceptUuid, display: cmvIgGTestName },
  ]);
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining(`/concept/${cmvIgGConceptUuid}?`), {
    rejectOnAuthFailure: true,
  });
  fetch.mockRejectedValue(new Error('expired session'));
  await expect(catalogs.listAdditionalTestConcepts()).rejects.toThrow('expired session');
});

it('rejects a different configured assay', async () => {
  const catalogs = createLaboratoryCatalogs({ cmvIgGConceptUuid: 'wrong-cmv-igm' });
  await expect(catalogs.listAdditionalTestConcepts()).rejects.toThrow('LABORATORY_CMV_IGG_CONFIG_INVALID');
  expect(fetch).not.toHaveBeenCalled();
});
