import { useSession, userHasAccess } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import { mockSession } from 'test-utils';

import routes from '../routes.json';
import { maternalAndChildHealthNavGroup } from './dashboard.meta';
import MaternalHealthNavGroup from './maternal-health-nav-group.component';

const group = vi.hoisted(() => ({ render: vi.fn(), config: undefined as unknown }));

vi.mock('@openmrs/esm-patient-common-lib', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@openmrs/esm-patient-common-lib')>()),
  createClinicalDashboardGroup: (config) => {
    group.config = config;
    return (props) => {
      group.render(props);
      return <div data-testid="maternal-clinical-group" />;
    };
  },
}));

beforeEach(() => {
  vi.mocked(useSession).mockReturnValue(mockSession.data);
});

it.each([
  'app:hoja.clinica.controlPrenatal',
  'app:hoja.clinica.partoPuerperio',
  'app:hoja.clinica.atencionPostnatal',
  'app:hoja.clinica.planificacionFamiliar',
  'app:hoja.clinica.prevencionCancer',
])('allows the group with chart access and %s without requiring another panel', (viewPrivilege) => {
  vi.mocked(userHasAccess).mockImplementation(
    (privilege) => privilege === 'app:hoja.clinica' || privilege === viewPrivilege,
  );

  render(<MaternalHealthNavGroup basePath="/patient/synthetic-patient/chart" />);

  expect(screen.getByTestId('maternal-clinical-group')).toBeInTheDocument();
  expect(group.render).toHaveBeenCalledWith({ basePath: '/patient/synthetic-patient/chart' });
  expect(group.config).toEqual(maternalAndChildHealthNavGroup);
});

it.each([
  { privileges: [] },
  { privileges: ['app:hoja.clinica'] },
  { privileges: ['app:hoja.clinica.partoPuerperio'] },
  { privileges: ['app:hoja.clinica', 'app:hoja.clinica.partoPuerperio.editar'] },
])('does not mount the clinical group with incomplete access $privileges', ({ privileges }) => {
  vi.mocked(userHasAccess).mockImplementation((privilege) => privileges.includes(String(privilege)));

  render(<MaternalHealthNavGroup basePath="/patient/synthetic-patient/chart" />);

  expect(group.render).not.toHaveBeenCalled();
});

it('unmounts the group when the session is no longer authenticated', () => {
  vi.mocked(userHasAccess).mockReturnValue(true);
  const { rerender } = render(<MaternalHealthNavGroup basePath="/patient/synthetic-patient/chart" />);
  expect(screen.getByTestId('maternal-clinical-group')).toBeInTheDocument();

  vi.mocked(useSession).mockReturnValue({ ...mockSession.data, authenticated: false });
  rerender(<MaternalHealthNavGroup basePath="/patient/synthetic-patient/chart" />);
  expect(screen.queryByTestId('maternal-clinical-group')).not.toBeInTheDocument();
});

it('keeps chart access at shared registrations and individual dashboard privileges', () => {
  expect(
    routes.extensions.find(({ name }) => name === 'maternal-and-child-health-dashboard-group-link')?.privileges,
  ).toBe('app:hoja.clinica');
  for (const workspaces of [routes.workspaces, routes.workspaces2]) {
    expect(workspaces.find(({ name }) => name === 'maternal-health-forms-selector-workspace')?.privileges).toBe(
      'app:hoja.clinica',
    );
  }
  expect(routes.extensions.find(({ name }) => name === 'labour-and-delivery-dashboard-link')?.privileges).toBe(
    'app:hoja.clinica.partoPuerperio',
  );
  expect(routes.extensions.find(({ name }) => name === 'postnatal-care-dashboard-link')?.privileges).toBe(
    'app:hoja.clinica.atencionPostnatal',
  );
});
