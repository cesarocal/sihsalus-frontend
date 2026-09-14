import { userHasAccess, useSession } from '@openmrs/esm-framework';
import { createClinicalDashboardGroup } from '@openmrs/esm-patient-common-lib';
import type { ComponentProps } from 'react';

import { maternalHealthPrivileges, maternalPatientChartPrivilege } from '../constants';
import { maternalAndChildHealthNavGroup } from './dashboard.meta';

const ClinicalGroup = createClinicalDashboardGroup(maternalAndChildHealthNavGroup);

export default function MaternalHealthNavGroup(props: ComponentProps<typeof ClinicalGroup>) {
  const session = useSession();
  const user = session?.user;
  const canView =
    session?.authenticated &&
    user?.uuid &&
    userHasAccess(maternalPatientChartPrivilege, user) &&
    maternalHealthPrivileges.some(({ view }) => userHasAccess(view, user));

  return canView ? <ClinicalGroup {...props} /> : null;
}
