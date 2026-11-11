import { SideNavLink, SideNavMenu, SideNavMenuItem } from '@carbon/react';
import { navigate } from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, useLocation } from 'react-router-dom';

import { ProtectedSection } from '../access/protected-section.component';
import { RequireAnyPrivilege } from '../access/require-any-privilege.component';
import { bloodBankPrivileges as p } from '../access/blood-bank-privileges';
import { basePath, donorsPath, moduleName } from '../constants';
import { bloodBankNavigation, type NavigationItem } from './blood-bank-navigation';
import styles from './blood-bank-nav.scss';

function decorativeIcon(Icon: NonNullable<NavigationItem['icon']>) {
  return function DecorativeIcon() {
    return (
      <span aria-hidden="true">
        <Icon size={16} />
      </span>
    );
  };
}

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
        item.path === '/' ? (
          <RequireAnyPrivilege
            key={item.path}
            privileges={[p.homeSelection, p.homeLaboratory, p.homeInventory, p.homeSupervisor]}
          >
            <SideNavLink
              href={hrefFor('/')}
              renderIcon={item.icon ? decorativeIcon(item.icon) : undefined}
              isActive={pathname === hrefFor('/')}
              onClick={(event) => open(event, hrefFor('/'))}
            >
              {t(item.labelKey, item.defaultLabel)}
            </SideNavLink>
          </RequireAnyPrivilege>
        ) : item.children ? (
          <RequireAnyPrivilege key={item.path} privileges={item.children.map((child) => child.privilege)}>
            <SideNavMenu
              title={t(item.labelKey, item.defaultLabel)}
              renderIcon={item.icon ? decorativeIcon(item.icon) : undefined}
              defaultExpanded={pathname.startsWith(hrefFor(item.path))}
            >
              {item.children.map((child) => {
                const href = hrefFor(child.path);
                const ChildIcon = child.icon;
                return (
                  <ProtectedSection key={child.path} privilege={child.privilege} hideUnauthorized>
                    <SideNavMenuItem href={href} isActive={pathname === href} onClick={(event) => open(event, href)}>
                      <span className="sihsalus-side-nav__item">
                        {ChildIcon && (
                          <span aria-hidden="true">
                            <ChildIcon className="sihsalus-side-nav__icon" size={20} />
                          </span>
                        )}
                        <span className={`sihsalus-side-nav__text ${styles.subsectionLabel}`}>
                          {t(child.labelKey, child.defaultLabel)}
                        </span>
                      </span>
                    </SideNavMenuItem>
                  </ProtectedSection>
                );
              })}
            </SideNavMenu>
          </RequireAnyPrivilege>
        ) : (
          <ProtectedSection key={item.path} privilege={item.privilege} hideUnauthorized>
            <SideNavLink
              href={hrefFor(item.path)}
              renderIcon={item.icon ? decorativeIcon(item.icon) : undefined}
              isActive={
                pathname === hrefFor(item.path) ||
                (item.path === donorsPath && pathname.startsWith(`${hrefFor(item.path)}/`))
              }
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
  return (
    <BrowserRouter>
      <BloodBankNavContent />
    </BrowserRouter>
  );
}
