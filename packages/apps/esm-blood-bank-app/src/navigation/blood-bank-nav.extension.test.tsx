import { SideNav, SideNavItems } from '@carbon/react';
import { navigate } from '@openmrs/esm-framework';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bloodBankPrivileges } from '../access/blood-bank-privileges';
import BloodBankNav from './blood-bank-nav.extension';

const allowed = vi.hoisted(() => new Set<string>());
vi.mock('@sihsalus/esm-rbac', () => ({
  RequirePrivilege: ({
    privilege,
    children,
    fallback,
    hideUnauthorized,
  }: {
    privilege: string;
    children: ReactNode;
    fallback?: ReactNode;
    hideUnauthorized?: boolean;
  }) => (allowed.has(privilege) ? children : hideUnauthorized ? null : (fallback ?? null)),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }) }));

function showNavigation(path: string) {
  window.history.replaceState(null, '', path);
  return render(
    <SideNav isPersistent expanded aria-label="Banco de Sangre">
      <SideNavItems>
        <BloodBankNav />
      </SideNavItems>
    </SideNav>,
  );
}
describe('blood bank navigation active state', () => {
  beforeEach(() => {
    allowed.clear();
    [bloodBankPrivileges.module, bloodBankPrivileges.donors, bloodBankPrivileges.applicantSelection].forEach((p) => {
      allowed.add(p);
    });
    vi.stubGlobal('getOpenmrsSpaBase', () => '/openmrs/spa/');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState(null, '', '/');
  });
  it('shows only authorized links and navigates through the shared framework', () => {
    allowed.delete(bloodBankPrivileges.applicantSelection);
    showNavigation('/openmrs/spa/blood-bank');
    expect(screen.getByRole('link', { name: 'Inicio' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Donantes' })).toHaveAttribute('href', '/openmrs/spa/blood-bank/donors');
    expect(screen.queryByRole('link', { name: 'Inventario' })).not.toBeInTheDocument();
    expect(screen.queryByText('Laboratorio')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Donantes' }));
    expect(vi.mocked(navigate)).toHaveBeenCalledWith({ to: '/openmrs/spa/blood-bank/donors' });
  });
  it('shows a group when only one subsection is authorized', () => {
    allowed.clear();
    allowed.add(bloodBankPrivileges.compatibility);
    showNavigation('/openmrs/spa/blood-bank/laboratory/compatibility');
    expect(screen.getByText('Laboratorio')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Compatibilidad' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Tamizaje' })).not.toBeInTheDocument();
  });
  it('preserves the short labels of authorized subsections', () => {
    allowed.clear();
    allowed.add(bloodBankPrivileges.screening);
    allowed.add(bloodBankPrivileges.donorFollowUp);
    allowed.add(bloodBankPrivileges.recipientFollowUp);
    showNavigation('/openmrs/spa/blood-bank');
    expect(screen.getByRole('link', { name: 'Tamizaje' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Al donante' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Al receptor' })).toBeInTheDocument();
  });
  it.each([
    '/openmrs/spa/blood-bank/donors',
    '/openmrs/spa/blood-bank/donors/DON-0001',
    '/openmrs/spa/blood-bank/donors/DON-0001?from=list',
  ])('keeps only Donors active on %s, including direct detail loads', (path) => {
    showNavigation(path);
    expect(screen.getByRole('link', { name: 'Donantes' })).toHaveClass('cds--side-nav__link--current');
    expect(screen.getByRole('link', { name: 'Inicio' })).not.toHaveClass('cds--side-nav__link--current');
    expect(screen.getByRole('link', { name: 'Selección del postulante' })).not.toHaveClass(
      'cds--side-nav__link--current',
    );
  });
  it('does not activate Donors for a similarly prefixed route', () => {
    showNavigation('/openmrs/spa/blood-bank/donors-other');
    expect(screen.getByRole('link', { name: 'Donantes' })).not.toHaveClass('cds--side-nav__link--current');
  });
  it('keeps the selection section active independently', () => {
    showNavigation('/openmrs/spa/blood-bank/applicant-selection');
    expect(screen.getByRole('link', { name: 'Donantes' })).not.toHaveClass('cds--side-nav__link--current');
    expect(screen.getByRole('link', { name: 'Selección del postulante' })).toHaveClass('cds--side-nav__link--current');
  });
  it('derives the SPA base from OpenMRS instead of assuming a local hostname or context', () => {
    vi.stubGlobal('getOpenmrsSpaBase', () => '/custom/spa/');
    showNavigation('/custom/spa/blood-bank/donors/DON-0001');
    expect(screen.getByRole('link', { name: 'Donantes' })).toHaveAttribute('href', '/custom/spa/blood-bank/donors');
    expect(screen.getByRole('link', { name: 'Donantes' })).toHaveClass('cds--side-nav__link--current');
  });
  it('never displays Donors without its privilege even on a donor detail URL', () => {
    allowed.delete(bloodBankPrivileges.donors);
    showNavigation('/openmrs/spa/blood-bank/donors/DON-0001');
    expect(screen.queryByRole('link', { name: 'Donantes' })).not.toBeInTheDocument();
  });
});
