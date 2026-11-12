import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import type { BloodBankConfig } from '../config-schema';
import { cmvIgGTestName } from '../sections/laboratory/screening/screening.types';
import { conceptFields, getActiveConceptSet, getConcept } from './collection-label-concepts.api';
import type { FractionationApi, FractionationCatalogField } from './fractionation.api';

type LaboratoryCatalogConfig = NonNullable<BloodBankConfig['laboratoryCatalogs']>;

export function createLaboratoryCatalogs(config: LaboratoryCatalogConfig, anticoagulantSetUuid?: string) {
  const sets: Record<FractionationCatalogField, string | undefined> = {
    anticoagulant: anticoagulantSetUuid,
    storageTemperature: config.storageTemperatureSetUuid,
    antibodies: config.irregularAntibodySetUuid,
  };
  const listLabelConcepts: FractionationApi['listLabelConcepts'] = async (field) => {
    const uuid = sets[field];
    if (!uuid) throw new Error('LABORATORY_CONCEPT_SET_NOT_CONFIGURED');
    return getActiveConceptSet(uuid);
  };
  const listAdditionalTestConcepts = async () => {
    if (config.cmvIgGConceptUuid) {
      const { uuid, display } = await getConcept(config.cmvIgGConceptUuid);
      return [{ uuid, display }];
    }
    const query = new URLSearchParams({
      q: cmvIgGTestName,
      v: `custom:(${conceptFields})`,
    });
    const { data } = await openmrsFetch<{ results: { uuid: string; display: string; retired: boolean }[] }>(
      `${restBaseUrl}/concept?${query}`,
      { rejectOnAuthFailure: true },
    );
    const matches = data.results.filter(
      ({ uuid, display, retired }) =>
        uuid && retired === false && display?.trim().toLowerCase() === cmvIgGTestName.toLowerCase(),
    );
    return matches.length === 1 ? matches.map(({ uuid, display }) => ({ uuid, display })) : [];
  };
  const getModifierLocation = config.modifierLocationUuid
    ? async () => {
        const { data } = await openmrsFetch<{ display: string; retired: boolean }>(
          `${restBaseUrl}/location/${encodeURIComponent(config.modifierLocationUuid ?? '')}?v=custom:(display,retired)`,
          { rejectOnAuthFailure: true },
        );
        if (data.retired !== false || !data.display?.trim()) throw new Error('MODIFIER_LOCATION_UNAVAILABLE');
        return data.display.trim();
      }
    : undefined;
  return { listLabelConcepts, listAdditionalTestConcepts, getModifierLocation };
}
