import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import type { BloodBankConfig } from '../config-schema';
import { cmvIgGConceptUuid } from '../sections/laboratory/screening/screening.types';
import { getActiveConceptSet, getConcept } from './collection-label-concepts.api';
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
    if (config.cmvIgGConceptUuid?.trim() && config.cmvIgGConceptUuid.trim() !== cmvIgGConceptUuid) {
      throw new Error('LABORATORY_CMV_IGG_CONFIG_INVALID');
    }
    const { uuid, display } = await getConcept(cmvIgGConceptUuid);
    return [{ uuid, display }];
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
