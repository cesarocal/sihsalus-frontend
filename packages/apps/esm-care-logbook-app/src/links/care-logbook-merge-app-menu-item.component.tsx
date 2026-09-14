import { ClickableTile } from '@carbon/react';
import { Merge } from '@carbon/react/icons';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import { useTranslation } from 'react-i18next';

import { careLogbookBasePath, careLogbookMergePrivileges, careLogbookPrivilege, moduleName } from '../constants';
import styles from './links.scss';

export default function CareLogbookMergeAppMenuItem() {
  const { t } = useTranslation(moduleName);

  return (
    <RequirePrivilege privilege={[careLogbookPrivilege, ...careLogbookMergePrivileges]} hideUnauthorized>
      <ClickableTile href={`${globalThis.getOpenmrsSpaBase().slice(0, -1)}${careLogbookBasePath}/merge`}>
        <Merge size={32} aria-hidden="true" />
        <span className={styles.appMenuLabel}>{t('mergeDuplicatePatients', 'Merge duplicate records')}</span>
      </ClickableTile>
    </RequirePrivilege>
  );
}
