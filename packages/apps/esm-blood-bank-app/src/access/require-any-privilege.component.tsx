import { RequirePrivilege } from '@sihsalus/esm-rbac';
import type { ReactNode } from 'react';

import type { BloodBankPrivilege } from './blood-bank-privileges';

export function RequireAnyPrivilege({ privileges, children, enforcePrivileges }: { privileges: BloodBankPrivilege[]; children: ReactNode; enforcePrivileges: boolean }) {
  if (!enforcePrivileges) return <>{children}</>;

  const [first, ...rest] = privileges;
  if (!first) return null;

  return (
    <RequirePrivilege privilege={first} fallback={rest.length > 0 ? <RequireAnyPrivilege privileges={rest} enforcePrivileges>{children}</RequireAnyPrivilege> : null} hideUnauthorized={rest.length === 0}>
      {children}
    </RequirePrivilege>
  );
}
