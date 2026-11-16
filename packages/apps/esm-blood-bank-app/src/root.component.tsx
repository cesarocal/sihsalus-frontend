import { InlineNotification } from '@carbon/react';
import { useConfig, useLeftNav, userHasAccess, useSession } from '@openmrs/esm-framework';
import { AppErrorBoundary, RequirePrivilege } from '@sihsalus/esm-rbac';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { bloodBankPrivileges } from './access/blood-bank-privileges';
import { mockBloodBankApi, openmrsBloodBankApi } from './api';
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
  const stored = useMemo(
    () =>
      useMockData && locationUuid
        ? saved?.locationUuid === locationUuid
          ? saved.settings
          : readMockBloodBankSettings(locationUuid)
        : undefined,
    [locationUuid, saved, useMockData],
  );
  const settings = stored ?? defaultBloodBankSettings(config);
  const { servicePersonUuid, epidemiologyPersonUuid } = settings;
  const canSave =
    useMockData &&
    authenticated &&
    locationUuid &&
    userHasAccess([bloodBankPrivileges.module, bloodBankPrivileges.settings], user);
  const saveSettings = async (next: BloodBankSettings) => {
    if (!canSave || !locationUuid || !isExpiryWarningDays(next.expiryWarningDays))
      throw new Error('BLOOD_BANK_SETTINGS_UNAVAILABLE');

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
      collection:
        useMockData && !Object.values(concepts).some(Boolean)
          ? source.collection
          : { ...source.collection, listLabelConcepts: createCollectionLabelConceptLoader(concepts) },
      fractionation: {
        ...source.fractionation,
        listLabelConcepts: catalogs.listLabelConcepts,
        getModifierLocation: catalogs.getModifierLocation,
      },
      screening: { ...source.screening, listAdditionalTestConcepts: catalogs.listAdditionalTestConcepts },
    };
  }, [collectionLabelConcepts, servicePersonUuid, epidemiologyPersonUuid, laboratoryCatalogs, useMockData]);

  return (
    <BloodBankApp
      api={api}
      settings={settings}
      saveSettings={canSave ? saveSettings : undefined}
      settingsLocationUuid={locationUuid}
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
