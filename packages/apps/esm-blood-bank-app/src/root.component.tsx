import { InlineNotification } from '@carbon/react';
import { useConfig } from '@openmrs/esm-framework';
import { AppErrorBoundary } from '@sihsalus/esm-rbac';
import { useTranslation } from 'react-i18next';

import { BloodBankPrototype } from './blood-bank-prototype.component';
import type { BloodBankConfig } from './config-schema';
import { appName, moduleName } from './constants';

export default function Root() {
  const config = useConfig<BloodBankConfig>();
  const { t } = useTranslation(moduleName);

  if (!config.enabled) {
    return <InlineNotification hideCloseButton kind="info" title={t('moduleDisabled', 'Módulo deshabilitado')} subtitle={t('moduleDisabledHelp', 'La configuración actual no permite mostrar Banco de Sangre.')} />;
  }

  return (
    <AppErrorBoundary appName={appName}>
      <BloodBankPrototype {...config} />
    </AppErrorBoundary>
  );
}
