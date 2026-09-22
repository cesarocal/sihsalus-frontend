import { RequirePrivilege } from '@sihsalus/esm-rbac';
import type { ReactNode } from 'react';

import type { BloodBankPrivilege } from './blood-bank-privileges';

interface ProtectedSectionProps {
  children: ReactNode;
  privilege: BloodBankPrivilege;
  enforcePrivileges: boolean;
  hideUnauthorized?: boolean;
}

/** Standalone previews have no OpenMRS session; integrated pages always enforce RBAC. */
export function ProtectedSection({ children, privilege, enforcePrivileges, hideUnauthorized = false }: ProtectedSectionProps) {
  if (!enforcePrivileges) return <>{children}</>;

  return <RequirePrivilege privilege={privilege} hideUnauthorized={hideUnauthorized}>{children}</RequirePrivilege>;
}
