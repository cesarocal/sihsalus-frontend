import { InlineNotification } from '@carbon/react';
import { useConfig, useLeftNav, userHasAccess, useSession } from '@openmrs/esm-framework';
import { AppErrorBoundary, RequirePrivilege } from '@sihsalus/esm-rbac';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { bloodBankPrivileges } from './access/blood-bank-privileges';
import { mockBloodBankApi, openmrsBloodBankApi } from './api';
import { type SavedBloodBankSettings, readBloodBankSettings, updateBloodBankSettings } from './api/blood-bank-settings.api';
import { createCollectionLabelConceptLoader } from './api/collection-label-concepts.api';
import { createDisposalSignatoriesLoader } from './api/inventory.api';
import { createLaboratoryCatalogs } from './api/laboratory-catalogs.api';
import { BloodBankApp } from './blood-bank-app.component';
import type { BloodBankConfig } from './config-schema';
import { appName, basePath, moduleName } from './constants';
import {
  type BloodBankSettings,
  defaultBloodBankSettings,
  isExpiryWarningDays,
  isStockMinimum,
  readMockBloodBankSettings,
  saveMockBloodBankSettings,
  signatoryLookupError,
} from './sections/settings/blood-bank-settings';

function BloodBankContent({ config }: { config: BloodBankConfig }) {
  const modulePath = `${globalThis.getOpenmrsSpaBase().slice(0, -1)}${basePath}`;
  const leftNav = useMemo(() => ({ name: 'blood-bank-nav-slot', basePath: modulePath }), [modulePath]);
  useLeftNav(leftNav);
  const { collectionLabelConcepts, laboratoryCatalogs, useMockData } = config;
  const { authenticated, sessionLocation, user } = useSession();
  const locationUuid = sessionLocation?.uuid;
  const [saved, setSaved] = useState<{ locationUuid: string; settings: BloodBankSettings }>();
  const [persisted, setPersisted] = useState<{ locationUuid: string; settings: SavedBloodBankSettings }>();
  const stored = useMemo(
    () =>
      useMockData && locationUuid
        ? saved?.locationUuid === locationUuid
          ? saved.settings
          : readMockBloodBankSettings(locationUuid)
        : undefined,
    [locationUuid, saved, useMockData],
  );
  const defaults = defaultBloodBankSettings(config);
  const realSettings = persisted?.locationUuid === locationUuid ? persisted?.settings : undefined;
  const settings = useMockData ? stored ?? defaults : realSettings ?? defaults;
  const { servicePersonUuid, epidemiologyPersonUuid } = settings;
  const canConfigure = authenticated && userHasAccess([bloodBankPrivileges.module, bloodBankPrivileges.settings], user);
  const canLoadSettings = Boolean(authenticated && (canConfigure || userHasAccess(bloodBankPrivileges.inventory, user)));
  const defaultWarningDays = defaults.expiryWarningDays;

  useEffect(() => {
    setPersisted(undefined);
    if (!locationUuid || useMockData || !canLoadSettings) return;
    let current = true;
    void readBloodBankSettings(locationUuid, defaultWarningDays)
      .then((settings) => {
        if (current) setPersisted({ locationUuid, settings });
      })
      .catch(() => {
        if (current) setPersisted(undefined);
      });
    return () => {
      current = false;
    };
  }, [locationUuid, useMockData, canLoadSettings, defaultWarningDays]);

  const canSave = Boolean(canConfigure && locationUuid && (useMockData || realSettings));
  const saveSettings = async (next: BloodBankSettings) => {
    if (
      !canSave ||
      !locationUuid ||
      !isExpiryWarningDays(next.expiryWarningDays) ||
      !Object.values(next.stockMinimums).every(isStockMinimum)
    )
      throw new Error('BLOOD_BANK_SETTINGS_UNAVAILABLE');

    if (!useMockData) {
      if (!realSettings) throw new Error('BLOOD_BANK_SETTINGS_UNAVAILABLE');
      const persistedSettings = await updateBloodBankSettings(locationUuid, { ...next, revision: realSettings.revision });
      setPersisted((current) =>
        current?.locationUuid === locationUuid ? { locationUuid, settings: persistedSettings } : current,
      );
      return;
    }

    const service = next.servicePersonUuid === servicePersonUuid ? '' : next.servicePersonUuid;
    const epidemiology = next.epidemiologyPersonUuid === epidemiologyPersonUuid ? '' : next.epidemiologyPersonUuid;
    if (service || epidemiology) {
      try {
        const names = await createDisposalSignatoriesLoader({
          servicePersonUuid: service,
          epidemiologyPersonUuid: epidemiology,
        })();
        if ((service && !names.serviceResponsible) || (epidemiology && !names.epidemiologyResponsible))
          throw new Error(signatoryLookupError);
      } catch {
        throw new Error(signatoryLookupError);
      }
    }
    saveMockBloodBankSettings(locationUuid, next);
    setSaved({ locationUuid, settings: next });
  };
  const api = useMemo(() => {
    const source = useMockData ? mockBloodBankApi : openmrsBloodBankApi;
    const concepts = collectionLabelConcepts ?? {};
    const catalogs = createLaboratoryCatalogs(laboratoryCatalogs ?? {}, concepts.anticoagulantSetUuid);
    return {
      ...source,
      inventory: useMockData
        ? {
            ...source.inventory,
            getDisposalSignatories: createDisposalSignatoriesLoader({ servicePersonUuid, epidemiologyPersonUuid }),
          }
        : source.inventory,
      collection: useMockData
        ? source.collection
        : { ...source.collection, listLabelConcepts: createCollectionLabelConceptLoader(concepts) },
      fractionation: {
        ...source.fractionation,
        listLabelConcepts: (field: Parameters<typeof catalogs.listLabelConcepts>[0]) => {
          const options = {
            anticoagulant: concepts.anticoagulantSetUuid,
            storageTemperature: laboratoryCatalogs?.storageTemperatureSetUuid,
            antibodies: laboratoryCatalogs?.irregularAntibodySetUuid,
          };
          return useMockData || options[field]
            ? catalogs.listLabelConcepts(field)
            : source.fractionation.listLabelConcepts(field);
        },
        getModifierLocation: catalogs.getModifierLocation,
        modifierLocationUuid: laboratoryCatalogs?.modifierLocationUuid,
      },
      screening: { ...source.screening, listAdditionalTestConcepts: catalogs.listAdditionalTestConcepts },
    };
  }, [collectionLabelConcepts, servicePersonUuid, epidemiologyPersonUuid, laboratoryCatalogs, useMockData]);

  return (
    <BloodBankApp
      api={api}
      settings={settings}
      saveSettings={canSave ? saveSettings : undefined}
      settingsLocationUuid={locationUuid && (useMockData || realSettings ? locationUuid : `${locationUuid}:pending`)}
      transfusionOrders={config.transfusionOrders}
      useMockData={useMockData}
      basename={modulePath}
      router="browser"
    />
  );
}

export default function Root() {
  const config = useConfig<BloodBankConfig>();
  const { t } = useTranslation(moduleName);

  return (
    <AppErrorBoundary appName={appName}>
      <RequirePrivilege privilege={bloodBankPrivileges.module}>
        {config.enabled ? (
          <BloodBankContent config={config} />
        ) : (
          <InlineNotification
            hideCloseButton
            kind="info"
            title={t('moduleDisabled', 'Banco de Sangre deshabilitado')}
          />
        )}
      </RequirePrivilege>
    </AppErrorBoundary>
  );
}
