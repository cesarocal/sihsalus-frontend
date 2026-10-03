import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockApplicantSelectionApi } from '../../api/mock-applicant-selection.api';
import { ApplicantSelectionPage } from './applicant-selection-page.component';
import { selectionMessages } from './selection-messages';
import { SelectionReport } from './selection-report.component';
import { SelectionStageFields } from './selection-stage-fields.component';
import { validApplication } from './selection.test-helpers';
import { SelectionWorkflow } from './selection-workflow.component';
import type { SelectionApplication, SelectionStep } from './selection.types';
import { showSnackbar } from '@openmrs/esm-framework';

vi.mock('@openmrs/esm-framework', () => ({
  PageHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  PageHeaderContent: ({ title }: { title: string }) => <div>{title}</div>,
  useSession: () => ({ sessionLocation: { display: 'Hospital de prueba' } }),
  formatDatetime: () => '03 oct 2026, 13:47',
  showSnackbar: vi.fn(),
  BloodBankPictogram: () => null,
  UserFollowIcon: () => null,
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }) }));
const t = (key: string) => selectionMessages[key]?.es ?? key;

function Fields({ initial, stage }: { initial: SelectionApplication; stage: SelectionStep }) {
  const [application, update] = useState(initial);
  return <SelectionStageFields application={application} stage={stage} readOnly={false} update={update} t={t} />;
}

describe('applicant selection UI', () => {
  beforeEach(() => sessionStorage.clear());

  it('lists applications, filters by state and searches by document', async () => {
    render(<ApplicantSelectionPage api={createMockApplicantSelectionApi()} />);
    expect(await screen.findByText('90000011', { exact: false })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'awaitingInterview' } });
    const table = screen.getByRole('table');
    expect(within(table).getByText('Entrevistar')).toBeInTheDocument();
    expect(within(table).queryByText('90000010', { exact: false })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Buscar postulantes'), { target: { value: 'missing' } });
    expect(screen.getByText('No se encontraron postulantes')).toBeInTheDocument();
  });

  it('places the new-application action beside search and adds smaller card descriptions without prototype notices', async () => {
    render(<ApplicantSelectionPage api={createMockApplicantSelectionApi()} />);
    const button = await screen.findByRole('button', { name: 'Nueva Postulación' });
    expect(button.parentElement).toContainElement(screen.getByLabelText('Buscar postulantes'));
    expect(screen.getAllByText('Postulantes', { selector: 'small' })).toHaveLength(3);
    expect(screen.queryByText(/Modo de prueba|Prototipo con datos/)).not.toBeInTheDocument();
  });

  it('uses a safe loading error instead of leaking backend information', async () => {
    const api = createMockApplicantSelectionApi();
    api.listApplications = async () => {
      throw new Error('PRIVATE_STACK_TRACE');
    };
    render(<ApplicantSelectionPage api={api} />);
    expect(await screen.findByText('No se pudieron cargar las postulaciones')).toBeInTheDocument();
    expect(screen.queryByText('PRIVATE_STACK_TRACE')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nueva Postulación' })).toBeDisabled();
  });

  it('announces a successfully saved selection draft through the shell rather than a page notice', async () => {
    render(<ApplicantSelectionPage api={createMockApplicantSelectionApi()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Nueva Postulación' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y salir' }));
    await waitFor(() =>
      expect(showSnackbar).toHaveBeenCalledWith({
        title: t('draftCreated'),
        kind: 'success',
        isLowContrast: true,
        autoClose: true,
        timeoutInMs: 5000,
      }),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText(t('draftCreated'))).not.toBeInTheDocument();
  });
  it('distinguishes an updated application draft from a newly created one', async () => {
    const api = createMockApplicantSelectionApi();
    const application = await api.saveDraft(validApplication());
    const saved = vi.fn();
    render(<SelectionWorkflow application={application} api={api} onClose={vi.fn()} onSaved={saved} t={t} />);
    fireEvent.change(screen.getByLabelText('Número de documento'), { target: { value: '90000999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y salir' }));
    await waitFor(() => expect(saved).toHaveBeenCalledWith('draftUpdated'));
    expect(saved).not.toHaveBeenCalledWith('draftCreated');
    expect((await api.listApplications()).find((item) => item.id === application.id)?.admission.documentNumber).toBe(
      '90000999',
    );
  });
  it.each([
    'X',
    'saveAndExit',
  ])('closes an unchanged application via %s without writing or claiming a save', async (action) => {
    const api = createMockApplicantSelectionApi();
    const application = await api.saveDraft(validApplication());
    const write = vi.spyOn(api, 'saveDraft');
    const saved = vi.fn();
    const closed = vi.fn();
    render(<SelectionWorkflow application={application} api={api} onClose={closed} onSaved={saved} t={t} />);
    if (action === 'X') {
      fireEvent.click(screen.getByRole('button', { name: 'Salir del proceso' }));
      fireEvent.click(screen.getByRole('button', { name: 'Salir' }));
    } else fireEvent.click(screen.getByRole('button', { name: 'Guardar y salir' }));
    await waitFor(() => expect(closed).toHaveBeenCalledOnce());
    expect(write).not.toHaveBeenCalled();
    expect(saved).not.toHaveBeenCalled();
    expect(showSnackbar).not.toHaveBeenCalled();
    expect((await api.listApplications()).find((item) => item.id === application.id)?.revision).toBe(
      application.revision,
    );
  });
  it('announces completed admission without claiming the whole application is selected', async () => {
    const api = createMockApplicantSelectionApi();
    const saved = vi.fn();
    render(<SelectionWorkflow application={validApplication()} api={api} onClose={vi.fn()} onSaved={saved} t={t} />);
    await screen.findByText(t('admissionHelp'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y continuar' }));
    await screen.findByLabelText('Nombres');
    expect(showSnackbar).toHaveBeenCalledWith(expect.objectContaining({ title: t('admissionCreated') }));
    expect(saved).not.toHaveBeenCalled();
  });

  it('shows conditional interview details and clears hidden values when changed to no', () => {
    render(<Fields initial={validApplication()} stage="interview" />);
    const question = screen.getByRole('group', { name: t('medication') });
    expect(screen.queryByLabelText(t('medicationWhich'))).not.toBeInTheDocument();
    fireEvent.click(within(question).getByLabelText('Sí'));
    fireEvent.change(screen.getByLabelText(t('medicationWhich')), { target: { value: 'Detalle ficticio' } });
    fireEvent.click(within(question).getByLabelText('No'));
    expect(screen.queryByLabelText(t('medicationWhich'))).not.toBeInTheDocument();
    fireEvent.click(within(question).getByLabelText('Sí'));
    expect(screen.getByLabelText(t('medicationWhich'))).toHaveValue('');
  });

  it('shows the female block only for women', () => {
    const application = validApplication();
    const view = render(<Fields key="male" initial={application} stage="interview" />);
    expect(screen.queryByText(t('women'))).not.toBeInTheDocument();
    application.personal.sex = 'F';
    view.rerender(<Fields key="female" initial={application} stage="interview" />);
    expect(screen.getByLabelText(t('pregnancies'))).toBeInTheDocument();
    expect(screen.getByRole('group', { name: t('pregnant') })).toBeInTheDocument();
  });

  it('keeps whole blood and apheresis mutually exclusive', () => {
    render(<Fields initial={validApplication()} stage="admission" />);
    fireEvent.click(screen.getByLabelText('Aféresis'));
    expect(screen.getByLabelText('Aféresis')).toBeChecked();
    expect(screen.getByLabelText('Sangre total')).not.toBeChecked();
  });

  it('requires confirmation on X and saves a partial draft before leaving', async () => {
    const api = createMockApplicantSelectionApi();
    const saved = vi.fn();
    render(<SelectionWorkflow application={validApplication()} api={api} onClose={vi.fn()} onSaved={saved} t={t} />);
    fireEvent.change(screen.getByLabelText('Código de donante (opcional)'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salir del proceso' }));
    const confirmation = screen.getByRole('dialog', { name: '¿Desea salir del proceso?' });
    expect(within(confirmation).getByLabelText('Guardar el avance antes de salir')).toBeChecked();
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Salir' }));
    await waitFor(() => expect(saved).toHaveBeenCalledWith('draftCreated'));
    expect((await api.listApplications()).find((a) => a.number === '000005')?.status).toBe('draft');
  });

  it('offers exit without deleting the previously saved draft if changes cannot be saved', async () => {
    const closed = vi.fn();
    render(
      <SelectionWorkflow
        application={validApplication()}
        api={createMockApplicantSelectionApi()}
        onClose={closed}
        onSaved={vi.fn()}
        t={t}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Salir del proceso' }));
    const confirmation = within(screen.getByRole('dialog', { name: '¿Desea salir del proceso?' }));
    fireEvent.click(confirmation.getByLabelText('Guardar el avance antes de salir'));
    fireEvent.click(confirmation.getByRole('button', { name: /Salir$/ }));
    expect(closed).toHaveBeenCalledOnce();
  });

  it('keeps the original modal open when cancelling the exit confirmation', () => {
    render(
      <SelectionWorkflow
        application={validApplication()}
        api={createMockApplicantSelectionApi()}
        onClose={vi.fn()}
        onSaved={vi.fn()}
        t={t}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Salir del proceso' }));
    const confirmation = screen.getByRole('dialog', { name: '¿Desea salir del proceso?' });
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Seguir editando' }));
    expect(screen.getByRole('dialog', { name: t('applicationForm') }).closest('.cds--modal')).toHaveClass('is-visible');
  });

  it('keeps the selection form and pending changes when saving through Exit fails', async () => {
    const api = createMockApplicantSelectionApi();
    api.saveDraft = vi.fn().mockRejectedValue(new Error('PRIVATE_EXIT_TRACE'));
    const saved = vi.fn();
    const closed = vi.fn();
    render(<SelectionWorkflow application={validApplication()} api={api} onClose={closed} onSaved={saved} t={t} />);
    fireEvent.change(screen.getByLabelText('Número de documento'), { target: { value: '90000999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salir del proceso' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salir' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: t('leaveTitle') })).not.toBeInTheDocument());
    expect(screen.getByRole('dialog', { name: t('applicationForm') }).closest('.cds--modal')).toHaveClass('is-visible');
    expect(screen.getByLabelText('Número de documento')).toHaveValue('90000999');
    expect(screen.getByText(t('saveFailed'))).toBeInTheDocument();
    expect(screen.queryByText('PRIVATE_EXIT_TRACE')).not.toBeInTheDocument();
    expect(closed).not.toHaveBeenCalled();
    expect(saved).not.toHaveBeenCalled();
  });

  it('starts an interview by reviewing the three locked earlier sections', async () => {
    const api = createMockApplicantSelectionApi();
    const application = (await api.listApplications()).find((a) => a.status === 'awaitingInterview');
    expect(application).toBeDefined();
    if (!application) throw new Error('Missing synthetic interview fixture');
    render(<SelectionWorkflow application={application} api={api} onClose={vi.fn()} onSaved={vi.fn()} t={t} />);
    expect(screen.getByLabelText('Número de documento')).toHaveAttribute('readonly');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y continuar' }));
    expect(screen.getByLabelText('Nombres')).toHaveAttribute('readonly');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y continuar' }));
    expect(screen.getByLabelText('Peso (kg)')).toHaveAttribute('readonly');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y continuar' }));
    expect(screen.getByRole('group', { name: t('understoodInformation') })).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: t('understoodInformation') })).getByLabelText('Sí')).toBeEnabled();
  });

  it('requires notes to continue after physical warnings or lets the clinician stop', async () => {
    const api = createMockApplicantSelectionApi();
    const application = validApplication();
    application.completedSteps = ['admission', 'personal'];
    application.physical.systolic = '181';
    const saved = await api.saveDraft(application);
    render(<SelectionWorkflow application={saved} api={api} onClose={vi.fn()} onSaved={vi.fn()} t={t} />);
    fireEvent.click(screen.getByRole('button', { name: 'Finalizar examen físico' }));
    const warning = screen.getByRole('dialog', { name: 'Valores que requieren evaluación' });
    expect(within(warning).getByRole('button', { name: 'Continuar con entrevista' })).toBeDisabled();
    fireEvent.click(within(warning).getByRole('button', { name: 'No continuar; registrar no apto' }));
    await waitFor(() => expect(screen.getByLabelText('Nombre completo del entrevistador')).toBeInTheDocument());
    expect(screen.getByLabelText('Apto')).toBeDisabled();
    expect((await api.listApplications()).find((a) => a.id === saved.id)?.status).toBe('awaitingQualification');
  });

  it('autofills donor data and warns about duration without exposing the reason', async () => {
    const application = validApplication();
    application.personal.givenName = '';
    application.admission.documentNumber = '90000002';
    render(
      <SelectionWorkflow
        application={application}
        api={createMockApplicantSelectionApi()}
        onClose={vi.fn()}
        onSaved={vi.fn()}
        t={t}
      />,
    );
    expect(await screen.findByText('Antecedente: no apto temporal')).toBeInTheDocument();
    expect(screen.getByText(/2099-12-31/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y continuar' }));
    expect(await screen.findByLabelText('Nombres')).toHaveValue('Persona 2');
    fireEvent.change(screen.getByLabelText('Nombres'), { target: { value: 'Persona editada' } });
    expect(screen.getByLabelText('Nombres')).toHaveValue('Persona editada');
  });

  it('does not advance with invalid data and focuses an accessible error summary', () => {
    const application = validApplication();
    application.admission.documentNumber = '';
    render(
      <SelectionWorkflow
        application={application}
        api={createMockApplicantSelectionApi()}
        onClose={vi.fn()}
        onSaved={vi.fn()}
        t={t}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y continuar' }));
    expect(screen.getByRole('alert', { name: t('checkForm') })).toHaveTextContent(t('validDocumentRequired'));
    expect(screen.getByRole('alert', { name: t('checkForm') })).toHaveFocus();
  });

  it('escapes printable input and includes blank physical-signature spaces', () => {
    const application = validApplication();
    application.personal.givenName = '<script>alert(1)</script>';
    const html = renderToStaticMarkup(<SelectionReport application={application} t={t} />);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('data-signatures');
    expect(html).toContain('NO VÁLIDO PARA USO CLÍNICO');
  });
});
