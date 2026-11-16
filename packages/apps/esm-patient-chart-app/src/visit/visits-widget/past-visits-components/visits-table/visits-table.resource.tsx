import { openmrsFetch, restBaseUrl, useConnectivity } from '@openmrs/esm-framework';
import useSWRImmutable from 'swr/immutable';

interface EncounterTypeOption {
  uuid: string;
  display: string;
  viewPrivilege?: { display?: string } | null;
}

async function fetchEncounterTypes(url: string) {
  const types = new Map<string, EncounterTypeOption>();
  let startIndex = 0;
  while (true) {
    const { data } = await openmrsFetch<{
      results: EncounterTypeOption[];
      links?: { rel: string }[];
    }>(`${url}&startIndex=${startIndex}`);
    const initialSize = types.size;
    for (const item of data.results) types.set(item.uuid, item);
    if (!data.links?.some(({ rel }) => rel === 'next')) return [...types.values()];
    if (types.size === initialSize) throw new Error('Encounter type pagination did not advance');
    startIndex += data.results.length;
  }
}

export function useEncounterTypeCatalog() {
  const online = useConnectivity();
  const url = `${restBaseUrl}/encountertype?v=custom:(uuid,display,viewPrivilege:(display))&limit=100`;
  return useSWRImmutable(online ? url : null, fetchEncounterTypes);
}

export function deleteEncounter(encounterUuid: string, abortController: AbortController) {
  return openmrsFetch(`${restBaseUrl}/encounter/${encounterUuid}`, {
    method: 'DELETE',
    signal: abortController.signal,
  });
}
