import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { moduleName } from '../constants';
import { ProtectedSection } from '../access/protected-section.component';
import { RequireAnyPrivilege } from '../access/require-any-privilege.component';
import { bloodBankNavigation } from '../navigation/blood-bank-navigation';
import styles from '../styles/app.scss';

export function BloodBankLayout({ title, enforcePrivileges }: { title: string; enforcePrivileges: boolean }) {
  const { t } = useTranslation(moduleName);

  return (
    <div className={enforcePrivileges ? styles.shell : styles.standaloneShell}>
      {!enforcePrivileges && <aside className={styles.sidebar} aria-label={t('bloodBankSections', 'Secciones de Banco de Sangre')}>
        <div className={styles.brand}>
          <span>{t('sihSalus', 'SIH Salus')}</span>
          <strong>{t('appTitle', title)}</strong>
        </div>
        <nav>
          {bloodBankNavigation.map((item) => (
            <div className={styles.navGroup} key={item.path}>
              {item.children ? (
                <RequireAnyPrivilege privileges={item.children.map((child) => child.privilege)} enforcePrivileges={enforcePrivileges}>
                  <span className={styles.navHeading}>{t(item.labelKey, item.defaultLabel)}</span>
                </RequireAnyPrivilege>
              ) : (
                <ProtectedSection privilege={item.privilege} enforcePrivileges={enforcePrivileges} hideUnauthorized>
                  <NavLink className={({ isActive }) => (isActive ? styles.active : undefined)} end={item.path === '/'} to={item.path}>
                    {t(item.labelKey, item.defaultLabel)}
                  </NavLink>
                </ProtectedSection>
              )}
              {item.children?.map((child) => (
                <ProtectedSection privilege={child.privilege} enforcePrivileges={enforcePrivileges} hideUnauthorized key={child.path}>
                  <NavLink
                    className={({ isActive }) => `${styles.navChild}${isActive ? ` ${styles.active}` : ''}`}
                    to={child.path}
                  >
                    {t(child.labelKey, child.defaultLabel)}
                  </NavLink>
                </ProtectedSection>
              ))}
            </div>
          ))}
        </nav>
      </aside>}
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
