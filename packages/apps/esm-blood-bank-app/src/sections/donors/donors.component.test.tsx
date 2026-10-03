import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockBloodBankApi } from '../../api/mock-blood-bank.api';
import { BloodBankApp } from '../../blood-bank-app.component';
import { bloodBankPrivileges } from '../../access/blood-bank-privileges';
import { MemoryRouter } from 'react-router-dom';
import { ApplicantSelectionRoute } from '../applicant-selection/applicant-selection-route.component';

const allowedPrivileges = vi.hoisted(() => new Set<string>());
vi.mock('@sihsalus/esm-rbac', () => ({
  RequirePrivilege: ({
    privilege,
    children,
    hideUnauthorized,
  }: {
    privilege: string;
    children: ReactNode;
    hideUnauthorized?: boolean;
  }) => (allowedPrivileges.has(privilege) ? children : hideUnauthorized ? null : <div>Sin acceso</div>),
}));

vi.mock('@openmrs/esm-framework', () => ({
  PageHeader: ({
    title,
    illustration,
    children,
  }: {
    title?: ReactNode;
    illustration?: ReactNode;
    children?: ReactNode;
  }) => (
    <header>
      {children}
      {illustration}
      {title}
    </header>
  ),
  PageHeaderContent: ({ title, illustration }: { title: ReactNode; illustration: ReactNode }) => (
    <div>
      {illustration}
      {title}
    </div>
  ),
  PatientsPictogram: () => <svg data-testid="donors-pictogram" />,
  UserFollowIcon: () => <svg />,
  useSession: () => ({ sessionLocation: { display: 'Hospital de prueba' } }),
  formatDatetime: () => '03 oct 2026, 13:47',
  showSnackbar: vi.fn(),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }) }));

describe('donor screens', () => {
  beforeEach(() => {
    sessionStorage.clear();
    allowedPrivileges.clear();
    allowedPrivileges.add(bloodBankPrivileges.donors);
    allowedPrivileges.add(bloodBankPrivileges.applicantSelection);
  });

  it('uses the shared page header, registry action and descriptive cards', async () => {
    render(<BloodBankApp api={mockBloodBankApi} initialPath="/donors" />);
    expect(await screen.findByText('Ana Torres García')).toBeInTheDocument();
    expect(screen.getByTestId('donors-pictogram')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registro de donantes' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Registrar donante' })).not.toBeInTheDocument();
    expect(screen.getAllByText('Donantes', { selector: 'small' })).toHaveLength(2);
  });

  it('combines case/accent-insensitive search with status and blood-group filters', async () => {
    render(<BloodBankApp api={mockBloodBankApi} initialPath="/donors" />);
    await screen.findByText('Ana Torres García');
    fireEvent.change(screen.getByLabelText('Buscar donantes'), { target: { value: 'garcia' } });
    expect(within(screen.getByRole('table')).getByText('Ana Torres García')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).queryByText('Luis Quispe Ramos')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Grupo sanguíneo y Rh'), { target: { value: 'A-' } });
    expect(screen.getByText('No se encontraron registros')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Buscar donantes'), { target: { value: '' } });
    expect(within(screen.getByRole('table')).getByText('Luis Quispe Ramos')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'Apto' } });
    expect(screen.getByText('No se encontraron registros')).toBeInTheDocument();
  });

  it('opens full-page read-only details and donation history and returns to the list', async () => {
    render(<BloodBankApp api={mockBloodBankApi} initialPath="/donors" />);
    const row = (await screen.findByText('Ana Torres García')).closest('tr');
    if (!row) throw new Error('Missing donor row');
    fireEvent.click(within(row).getByRole('button', { name: 'Ver detalle' }));
    expect(await screen.findByText('donante1@example.invalid')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Ana Torres García' })).not.toBeInTheDocument();
    expect(screen.getAllByText('Ana Torres García')).toHaveLength(1);
    const personalHeading = screen.getByRole('heading', { level: 2, name: 'Datos personales' });
    expect(personalHeading).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Volver al listado' }).closest('header')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Datos personales' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Historial de donaciones' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('table', { name: 'Historial de donaciones' })).getByText('U-DEMO-HIST-1'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Datos personales' })).queryByRole('textbox'),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Listado de donantes' })).not.toBeInTheDocument();
    const historyHeading = screen.getByRole('heading', { name: 'Historial de donaciones' });
    expect(historyHeading.parentElement).toContainElement(screen.getByRole('button', { name: 'Registrar donación' }));
    fireEvent.click(screen.getByRole('button', { name: 'Volver al listado' }));
    expect(await screen.findByRole('table', { name: 'Listado de donantes' })).toBeInTheDocument();
  });

  it('opens the donor registry with search/filters and returns to the donor list', async () => {
    render(<BloodBankApp api={mockBloodBankApi} initialPath="/donors" />);
    await screen.findByText('Ana Torres García');
    fireEvent.click(screen.getByRole('button', { name: 'Registro de donantes' }));
    await screen.findByText('U-DEMO-HIST-1');
    fireEvent.change(screen.getByLabelText('Buscar en el registro de donantes'), { target: { value: 'LOTE-DEMO-1' } });
    expect(within(screen.getByRole('table')).getByText('Ana Torres García')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).queryByText('Luis Quispe Ramos')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Estado de extracción'), { target: { value: 'incomplete' } });
    expect(screen.getByText('No se encontraron registros')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Volver a donantes' }));
    expect(screen.getByRole('table', { name: 'Listado de donantes' })).toBeInTheDocument();
  });

  it('removes the explanation and retains a separate read-only adverse reaction history below donations', async () => {
    render(<BloodBankApp api={mockBloodBankApi} initialPath="/donors/DON-0001" />);
    const donations = await screen.findByRole('table', { name: 'Historial de donaciones' });
    expect(screen.queryByText(/Este historial reúne/)).not.toBeInTheDocument();
    const reactions = screen.getByRole('table', { name: 'Historial de reacciones adversas del donante' });
    const historyHeading = screen.getByRole('heading', { name: 'Historial de donaciones' });
    expect(historyHeading.compareDocumentPosition(donations) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(donations.compareDocumentPosition(reactions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      within(reactions)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Fecha', 'Código de unidad', 'Reacción', 'Severidad']);
    expect(within(reactions).getByText('Mareo')).toBeInTheDocument();
    expect(within(reactions).getByText('Leve')).toBeInTheDocument();
    expect(within(reactions).getByText('13/08/2026')).toBeInTheDocument();
    expect(screen.getAllByRole('table')).toHaveLength(2);
    expect(within(reactions).queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('retains the adverse reaction table headings and an empty state for a donor without events', async () => {
    render(<BloodBankApp api={mockBloodBankApi} initialPath="/donors/DON-0002" />);
    const reactions = await screen.findByRole('table', { name: 'Historial de reacciones adversas del donante' });
    expect(within(reactions).getAllByRole('columnheader')).toHaveLength(4);
    expect(within(reactions).getAllByRole('row')).toHaveLength(1);
    expect(screen.getByText('No hay reacciones adversas registradas para este donante.')).toBeInTheDocument();
    expect(screen.queryByText('Mareo')).not.toBeInTheDocument();
  });

  it('combines donation date, modality and identifier filters, and clears them without filtering adverse reactions', async () => {
    render(<BloodBankApp api={mockBloodBankApi} initialPath="/donors/DON-0001" />);
    const history = await screen.findByRole('table', { name: 'Historial de donaciones' });
    expect(within(history).getByText('U-DEMO-HIST-1')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-08-12' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-08-12' } });
    fireEvent.change(screen.getByLabelText('Buscar en el historial de donaciones'), { target: { value: 'demo-1' } });
    expect(
      within(screen.getByRole('table', { name: 'Historial de donaciones' })).getByText('U-DEMO-HIST-1'),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Modalidad'), { target: { value: 'apheresis' } });
    expect(screen.getByText('No hay donaciones que coincidan. Revise o limpie los filtros.')).toBeInTheDocument();
    expect(
      within(screen.getByRole('table', { name: 'Historial de reacciones adversas del donante' })).getByText('Mareo'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    fireEvent.change(screen.getByLabelText('Buscar en el historial de donaciones'), {
      target: { value: 'u-demo-hist-1' },
    });
    expect(
      within(screen.getByRole('table', { name: 'Historial de donaciones' })).getByText('U-DEMO-HIST-1'),
    ).toBeInTheDocument();
  });

  it('shows an invalid range warning instead of claiming that there are no donations', async () => {
    render(<BloodBankApp api={mockBloodBankApi} initialPath="/donors/DON-0001" />);
    await screen.findByRole('table', { name: 'Historial de donaciones' });
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-10-03' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-01-01' } });
    expect(screen.getByLabelText('Hasta')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByRole('table', { name: 'Historial de donaciones' })).not.toBeInTheDocument();
    expect(screen.queryByText('No se encontraron registros')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(
      within(screen.getByRole('table', { name: 'Historial de donaciones' })).getByText('U-DEMO-HIST-1'),
    ).toBeInTheDocument();
  });

  it('resets history to the first page after changing filters, without hiding earlier matching records', async () => {
    const getDonorDetail = async (id: string) => {
      const detail = await mockBloodBankApi.getDonorDetail(id);
      detail.donations = Array.from({ length: 22 }, (_, index) => ({
        ...detail.donations[0],
        id: `synthetic-history-${index}`,
        unitCode: `U-HISTORY-${index + 1}`,
      }));
      return detail;
    };
    render(<BloodBankApp api={{ ...mockBloodBankApi, getDonorDetail }} initialPath="/donors/DON-0001" />);
    await screen.findByRole('table', { name: 'Historial de donaciones' });
    const history = within(screen.getByRole('region', { name: 'Historial de donaciones' }));
    fireEvent.click(history.getByRole('button', { name: 'Página siguiente' }));
    expect(within(history.getByRole('table')).getByText('U-HISTORY-11')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Buscar en el historial de donaciones'), {
      target: { value: 'U-HISTORY-' },
    });
    expect(within(history.getByRole('table')).getByText('U-HISTORY-1')).toBeInTheDocument();
    expect(within(history.getByRole('table')).queryByText('U-HISTORY-11')).not.toBeInTheDocument();
  });

  it('hides backend details and retries a failed donor detail', async () => {
    const getDonorDetail = vi
      .fn()
      .mockRejectedValueOnce(new Error('PRIVATE_BACKEND_STACK'))
      .mockImplementation(mockBloodBankApi.getDonorDetail);
    render(<BloodBankApp api={{ ...mockBloodBankApi, getDonorDetail }} initialPath="/donors" />);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Ver detalle' }))[0]);
    expect(await screen.findByText('No se pudieron cargar los datos')).toBeInTheDocument();
    expect(screen.queryByText('PRIVATE_BACKEND_STACK')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Volver al listado' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await screen.findByText('donante1@example.invalid');
  });

  it('starts and saves a fresh donation application with editable donor demographics, consuming navigation state once', async () => {
    const lookupApplicant = vi.fn(mockBloodBankApi.selection.lookupApplicant);
    render(
      <BloodBankApp
        api={{ ...mockBloodBankApi, selection: { ...mockBloodBankApi.selection, lookupApplicant } }}
        initialPath="/donors/DON-0001"
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Registrar donación' }));
    await waitFor(() => expect(screen.getByLabelText('Código de donante (opcional)')).toHaveValue('DON-0001'));
    expect(screen.getByLabelText('Número de documento')).toHaveValue('70000001');
    fireEvent.change(screen.getByLabelText('Tipo de donación'), { target: { value: 'voluntary' } });
    fireEvent.click(screen.getByLabelText('Sangre total'));
    await waitFor(() => expect(lookupApplicant).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y continuar' }));
    const givenName = await screen.findByLabelText('Nombres');
    expect(givenName).toHaveValue('Ana');
    expect(givenName).toBeEnabled();
    fireEvent.change(givenName, { target: { value: 'Ana actualizada' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y salir' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const application = (await mockBloodBankApi.selection.listApplications()).find(
      (a) => a.admission.donorCode === 'DON-0001',
    );
    expect(application?.personal.givenName).toBe('Ana actualizada');
    expect(application?.physical.weight).toBe('');
    expect(application?.interview.answers).toEqual({});
    fireEvent.click(screen.getByRole('button', { name: 'Nueva Postulación' }));
    expect(screen.getByLabelText('Código de donante (opcional)')).toHaveValue('');
    expect(screen.getByLabelText('Número de documento')).toHaveValue('');
  });

  it('hides Register donation without the Selection privilege while allowing donor history', async () => {
    allowedPrivileges.delete(bloodBankPrivileges.applicantSelection);
    render(<BloodBankApp api={mockBloodBankApi} initialPath="/donors/DON-0001" />);
    expect(await screen.findByRole('table', { name: 'Historial de donaciones' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Registrar donación' })).not.toBeInTheDocument();
  });

  it('does not read donor data through forged prefill state without the Donors privilege', () => {
    allowedPrivileges.delete(bloodBankPrivileges.donors);
    const getDonorDetail = vi.fn(mockBloodBankApi.getDonorDetail);
    render(
      <MemoryRouter initialEntries={[{ pathname: '/applicant-selection', state: { bloodBankDonorId: 'DON-0001' } }]}>
        <ApplicantSelectionRoute api={{ ...mockBloodBankApi, getDonorDetail }} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Sin acceso')).toBeInTheDocument();
    expect(getDonorDetail).not.toHaveBeenCalled();
  });

  it('keeps a safe prefill failure retryable without opening a blank application', async () => {
    const getDonorDetail = vi
      .fn()
      .mockImplementationOnce(mockBloodBankApi.getDonorDetail)
      .mockRejectedValueOnce(new Error('PRIVATE_PREFILL_ERROR'))
      .mockImplementation(mockBloodBankApi.getDonorDetail);
    render(<BloodBankApp api={{ ...mockBloodBankApi, getDonorDetail }} initialPath="/donors/DON-0001" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Registrar donación' }));
    await screen.findByText('No se pudieron cargar los datos del donante');
    expect(screen.queryByText('PRIVATE_PREFILL_ERROR')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nueva Postulación' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(screen.getByLabelText('Código de donante (opcional)')).toHaveValue('DON-0001'));
  });

  it('keeps an unknown donor recoverable through Back to list', async () => {
    render(<BloodBankApp api={mockBloodBankApi} initialPath="/donors/missing" />);
    await screen.findByText('No se pudieron cargar los datos');
    expect(screen.queryByRole('button', { name: 'Registrar donación' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Volver al listado' }));
    expect(await screen.findByRole('table', { name: 'Listado de donantes' })).toBeInTheDocument();
  });
});
