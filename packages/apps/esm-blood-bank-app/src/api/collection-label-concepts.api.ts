import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import type { CollectionLabelConceptConfig } from '../config-schema';
import type { CollectionConcept } from '../sections/collection/collection.types';
import type { CollectionApi } from './blood-bank-processing.api';

interface OpenmrsCollectionConcept extends CollectionConcept {
  retired: boolean;
  set?: boolean;
  setMembers?: OpenmrsCollectionConcept[];
}

const active = (concept: OpenmrsCollectionConcept) =>
  concept?.retired === false && Boolean(concept.uuid?.trim() && concept.display?.trim());

async function getConcept(uuid: string, fields: string) {
  const { data } = await openmrsFetch<OpenmrsCollectionConcept>(
    `${restBaseUrl}/concept/${encodeURIComponent(uuid)}?v=custom:(${fields})`,
    { rejectOnAuthFailure: true },
  );
  if (data?.uuid !== uuid || !active(data)) throw new Error('COLLECTION_CONCEPT_UNAVAILABLE');
  return data;
}

export function createCollectionLabelConceptLoader({
  bloodBankServiceUuid,
  campaignServiceUuid,
  anticoagulantSetUuid,
}: CollectionLabelConceptConfig): CollectionApi['listLabelConcepts'] {
  return async (field) => {
    const fields = 'uuid,display,retired';
    if (field === 'service') {
      if (!bloodBankServiceUuid || !campaignServiceUuid || bloodBankServiceUuid === campaignServiceUuid)
        throw new Error('COLLECTION_SERVICES_NOT_CONFIGURED');
      const services = await Promise.all([
        getConcept(bloodBankServiceUuid, fields),
        getConcept(campaignServiceUuid, fields),
      ]);
      return services.map(({ uuid, display }) => ({ uuid, display }));
    }
    if (!anticoagulantSetUuid) throw new Error('COLLECTION_ANTICOAGULANTS_NOT_CONFIGURED');
    const set = await getConcept(anticoagulantSetUuid, `${fields},set,setMembers:(${fields})`);
    if (set.set !== true || !Array.isArray(set.setMembers)) throw new Error('COLLECTION_ANTICOAGULANTS_INVALID');
    return Array.from(
      new Map(set.setMembers.filter(active).map(({ uuid, display }) => [uuid, { uuid, display }])).values(),
    );
  };
}
