import { InlineNotification } from '@carbon/react';
import { useConfig, useLeftNav } from '@openmrs/esm-framework';
import { AppErrorBoundary, RequirePrivilege } from '@sihsalus/esm-rbac';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { mockBloodBankApi, openmrsBloodBankApi } from './api';
import { createCollectionLabelConceptLoader } from './api/collection-label-concepts.api';
import { createLaboratoryCatalogs } from './api/laboratory-catalogs.api';
import { bloodBankPrivileges } from './access/blood-bank-privileges';
import { BloodBankApp } from './blood-bank-app.component';
import type { BloodBankConfig } from './config-schema';
import { appName, basePath, moduleName } from './constants';

function BloodBankContent({ config }: { config: BloodBankConfig }) {
  const modulePath = `${globalThis.getOpenmrsSpaBase().slice(0, -1)}${basePath}`;
  const leftNav = useMemo(() => ({ name: 'blood-bank-nav-slot', basePath: modulePath }), [modulePath]);
  useLeftNav(leftNav);
  const { collectionLabelConcepts, laboratoryCatalogs, useMockData } = config;
  const api = useMemo(() => {
    const source = useMockData ? mockBloodBankApi : openmrsBloodBankApi;
    const concepts = collectionLabelConcepts ?? {};
    const catalogs = createLaboratoryCatalogs(laboratoryCatalogs ?? {}, concepts.anticoagulantSetUuid);
    return {
      ...source,
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
  }, [collectionLabelConcepts, laboratoryCatalogs, useMockData]);

  return (
    <BloodBankApp
      api={api}
      expiryWarningDays={config.dashboardExpiryWarningDays}
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
