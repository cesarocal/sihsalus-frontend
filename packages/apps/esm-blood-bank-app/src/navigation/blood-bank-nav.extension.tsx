import { SideNavLink, SideNavMenu, SideNavMenuItem } from '@carbon/react';
import { navigate } from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, useLocation } from 'react-router-dom';

import { ProtectedSection } from '../access/protected-section.component';
import { RequireAnyPrivilege } from '../access/require-any-privilege.component';
import { basePath, moduleName } from '../constants';
import { bloodBankNavigation } from './blood-bank-navigation';

function BloodBankNavContent() {
  const { t } = useTranslation(moduleName);
  const { pathname } = useLocation();
  const modulePath = `${globalThis.getOpenmrsSpaBase().slice(0, -1)}${basePath}`;
  const hrefFor = (path: string) => `${modulePath}${path === '/' ? '' : path}`;
  const open = (event: React.MouseEvent, href: string) => {
    event.preventDefault();
    navigate({ to: href });
  };

  return (
    <>
      {bloodBankNavigation.map((item) =>
        item.children ? (
          <RequireAnyPrivilege
            key={item.path}
            privileges={item.children.map((child) => child.privilege)}
            enforcePrivileges
          >
            <SideNavMenu
              title={t(item.labelKey, item.defaultLabel)}
              defaultExpanded={pathname.startsWith(hrefFor(item.path))}
            >
              {item.children.map((child) => {
                const href = hrefFor(child.path);
                return (
                  <ProtectedSection key={child.path} privilege={child.privilege} enforcePrivileges hideUnauthorized>
                    <SideNavMenuItem
                      href={href}
                      isActive={pathname === href}
                      onClick={(event) => open(event, href)}
                    >
                      {t(child.labelKey, child.defaultLabel)}
                    </SideNavMenuItem>
                  </ProtectedSection>
                );
              })}
            </SideNavMenu>
          </RequireAnyPrivilege>
        ) : (
          <ProtectedSection key={item.path} privilege={item.privilege} enforcePrivileges hideUnauthorized>
            <SideNavLink
              href={hrefFor(item.path)}
              isActive={pathname === hrefFor(item.path)}
              onClick={(event) => open(event, hrefFor(item.path))}
            >
              {t(item.labelKey, item.defaultLabel)}
            </SideNavLink>
          </ProtectedSection>
        ),
      )}
    </>
  );
}

export default function BloodBankNav() {
  return <BrowserRouter><BloodBankNavContent /></BrowserRouter>;
}
