import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { StrictMode, useState, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockApplicantSelectionApi } from '../../api/mock-applicant-selection.api';
import { ApplicantSelectionPage } from './applicant-selection-page.component';
import { selectionMessages } from './selection-messages';
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
// A development server renderer may expect React debug internals absent from the production shell.
vi.mock('react-dom/server', () => ({
  renderToStaticMarkup: () => {
    throw new TypeError('ReactDebugCurrentFrame.getCurrentStack is unavailable');
  },
}));
const t = (key: string) => selectionMessages[key]?.es ?? key;

function Fields({ initial, stage }: { initial: SelectionApplication; stage: SelectionStep }) {
  const [application, update] = useState(initial);
  return <SelectionStageFields application={application} stage={stage} readOnly={false} update={update} t={t} />;
}

describe('applicant selection UI', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => {
    document.querySelectorAll('iframe').forEach((frame) => {
      frame.remove();
    });
  });

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

  it('warns about invalid personal contact numbers and requires correction before continuing', async () => {
    const api = createMockApplicantSelectionApi();
    const application = await api.completeStep(validApplication(), 'admission');
    const completeStep = vi.spyOn(api, 'completeStep');
    render(<SelectionWorkflow application={application} api={api} onClose={vi.fn()} onSaved={vi.fn()} t={t} />);

    const phone = screen.getByLabelText('Teléfono');
    const mobile = screen.getByLabelText('Celular');
    const continueButton = screen.getByRole('button', { name: 'Guardar y continuar' });
    fireEvent.change(phone, { target: { value: '123456' } });
    fireEvent.change(mobile, { target: { value: '1234567890' } });
    expect(phone).toHaveAccessibleDescription('El teléfono debe tener exactamente 7 dígitos.');
    expect(mobile).toHaveAccessibleDescription('El celular debe tener exactamente 9 dígitos.');

    fireEvent.click(continueButton);
    expect(screen.getByRole('alert', { name: t('checkForm') })).toBeInTheDocument();
    expect(completeStep).not.toHaveBeenCalled();

    fireEvent.change(phone, { target: { value: '0123456' } });
    fireEvent.change(mobile, { target: { value: '900000001' } });
    expect(phone).not.toHaveAccessibleDescription();
    expect(mobile).not.toHaveAccessibleDescription();
    fireEvent.click(continueButton);
    expect(await screen.findByRole('heading', { name: t('physical') })).toBeInTheDocument();
  });

  it.each([
    ['medication', 'medicationWhich', 'medicationItem', 'addMedication'],
    ['vaccinated', 'vaccineWhich', 'vaccineItem', 'addVaccine'],
    ['chronicCondition', 'conditionWhich', 'conditionItem', 'addCondition'],
  ])('preserves and edits independent %s entries, then clears them on No', (id, key, item, add) => {
    const application = validApplication();
    application.interview.answers[id] = 'yes';
    application.interview.details[key] = 'Detalle anterior';
    render(<Fields initial={application} stage="interview" />);

    const first = `${t(item)} 1`;
    expect(screen.getByLabelText(first)).toHaveValue('Detalle anterior');
    fireEvent.click(screen.getByRole('button', { name: t(add) }));
    fireEvent.change(screen.getByLabelText(`${t(item)} 2`), { target: { value: 'Detalle nuevo' } });
    fireEvent.click(screen.getByRole('button', { name: `Eliminar · ${first}` }));
    expect(screen.getByLabelText(first)).toHaveValue('Detalle nuevo');

    const question = within(screen.getByRole('group', { name: t(id) }));
    fireEvent.click(question.getByLabelText('No'));
    expect(screen.queryByRole('button', { name: t(add) })).not.toBeInTheDocument();
    fireEvent.click(question.getByLabelText('Sí'));
    expect(screen.getByRole('heading', { name: `${t(key)} (0)` })).toBeInTheDocument();
    expect(screen.queryByLabelText(first)).not.toBeInTheDocument();
  });

  it('scrolls to the next question or to a newly opened detail when answering', async () => {
    const targets: HTMLElement[] = [];
    const scroll = vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(function (this: HTMLElement) {
      targets.push(this);
    });
    try {
      render(<Fields initial={validApplication()} stage="interview" />);
      const health = within(screen.getByRole('group', { name: t('feelsWell') }));
      fireEvent.click(health.getByLabelText('No'));
      await waitFor(() => expect(targets.at(-1)?.dataset.interviewQuestion).toBe('strenuousActivity'));
      const medication = within(screen.getByRole('group', { name: t('medication') }));
      fireEvent.click(medication.getByLabelText('Sí'));
      await waitFor(() =>
        expect(targets.at(-1)).toContainElement(screen.getByRole('button', { name: t('addMedication') })),
      );
    } finally {
      scroll.mockRestore();
    }
  });

  it('shows the STI guidance and requested order without an interview observations field', () => {
    render(<Fields initial={validApplication()} stage="interview" />);
    expect(screen.queryByLabelText('Observaciones')).not.toBeInTheDocument();
    expect(screen.queryByText(t('stiGuidanceTitle'))).not.toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('group', { name: t('sti') })).getByLabelText('Sí'));
    expect(screen.getByText(t('stiGuidanceTitle'))).toBeInTheDocument();
    expect(screen.getByText(t('stiGuidance'), { exact: false })).toBeInTheDocument();
    const stiLabels = [t('syphilis'), t('chancroid'), t('gonorrhea'), t('otherSti')];
    expect(
      screen
        .getAllByRole('group')
        .map((group) => group.querySelector('legend')?.textContent ?? '')
        .filter((label) => stiLabels.includes(label)),
    ).toEqual(stiLabels);
  });

  it('starts with zero trips and adds or removes independent travel blocks', async () => {
    const api = createMockApplicantSelectionApi();
    const application = await api.completeStep(validApplication(), 'admission');
    render(<SelectionWorkflow application={application} api={api} onClose={vi.fn()} onSaved={vi.fn()} t={t} />);

    expect(screen.getByRole('heading', { name: 'Viajes (0)' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Lugar del viaje')).not.toBeInTheDocument();
    const add = screen.getByRole('button', { name: 'Añadir viaje' });
    fireEvent.click(add);
    expect(screen.getByRole('heading', { name: 'Viajes (1)' })).toBeInTheDocument();
    fireEvent.click(add);
    expect(screen.getByRole('heading', { name: 'Viajes (2)' })).toBeInTheDocument();

    const second = within(screen.getByRole('region', { name: 'Viaje 2' }));
    fireEvent.change(second.getByLabelText('Lugar del viaje'), { target: { value: 'Nauta' } });
    fireEvent.change(second.getByLabelText('Permanencia'), { target: { value: '2 días' } });
    fireEvent.change(second.getByLabelText('Fecha del viaje'), { target: { value: application.admission.date } });
    const continueButton = screen.getByRole('button', { name: 'Guardar y continuar' });
    fireEvent.click(continueButton);
    expect(screen.getByRole('alert', { name: t('checkForm') })).toHaveTextContent(t('tripDetailsRequired'));

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar viaje · Viaje 1' }));
    const remaining = within(screen.getByRole('region', { name: 'Viaje 1' }));
    expect(remaining.getByLabelText('Lugar del viaje')).toHaveValue('Nauta');
    expect(remaining.getByLabelText('Permanencia')).toHaveValue('2 días');
    expect(remaining.getByLabelText('Fecha del viaje')).toHaveValue(application.admission.date);
    fireEvent.click(remaining.getByRole('button', { name: 'Eliminar viaje · Viaje 1' }));
    expect(screen.getByRole('heading', { name: 'Viajes (0)' })).toBeInTheDocument();
    fireEvent.click(continueButton);
    expect(await screen.findByRole('heading', { name: t('physical') })).toBeInTheDocument();
  });

  it('shows the female block only for women', () => {
    const application = validApplication();
    const view = render(<Fields key="male" initial={application} stage="interview" />);
    expect(screen.queryByText(t('women'))).not.toBeInTheDocument();
    application.personal.sex = 'F';
    view.rerender(<Fields key="female" initial={application} stage="interview" />);
    expect(screen.getByRole('heading', { name: t('menstruationAndPregnancy') })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: t('deliveryAndBreastfeeding') })).toBeInTheDocument();
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

  it('shows the physical observation count and blocks saving overflow without truncating it', async () => {
    const api = createMockApplicantSelectionApi();
    const application = validApplication();
    application.completedSteps = ['admission', 'personal'];
    const saved = await api.saveDraft(application);
    const onSaved = vi.fn();
    render(<SelectionWorkflow application={saved} api={api} onClose={vi.fn()} onSaved={onSaved} t={t} />);

    const observations = screen.getByLabelText('Observaciones');
    expect(observations).toHaveAccessibleDescription('0 / 500 caracteres');
    const overflow = `${'á'.repeat(499)}🩸`;
    fireEvent.change(observations, { target: { value: overflow } });
    expect(observations).toHaveValue(overflow);
    expect(observations).toHaveAccessibleDescription(/501 \/ 500/);
    fireEvent.click(screen.getByRole('button', { name: 'Finalizar examen físico' }));
    expect(screen.getByRole('alert', { name: t('checkForm') })).toHaveTextContent(t('observationsTooLong'));

    fireEvent.click(screen.getByRole('button', { name: 'Salir del proceso' }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: t('leaveTitle') })).getByRole('button', { name: 'Salir' }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog', { name: t('leaveTitle') })).not.toBeInTheDocument());
    expect(onSaved).not.toHaveBeenCalled();
    expect(observations).toHaveValue(overflow);
    expect((await api.listApplications()).find(({ id }) => id === saved.id)?.revision).toBe(saved.revision);

    const atLimit = `${'á'.repeat(498)}🩸`;
    fireEvent.change(observations, { target: { value: atLimit } });
    expect(observations).toHaveAccessibleDescription('500 / 500 caracteres');
    fireEvent.click(screen.getByRole('button', { name: 'Finalizar examen físico' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('readyForInterview'));
    expect((await api.listApplications()).find(({ id }) => id === saved.id)?.physical.observations).toBe(atLimit);
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
    expect(screen.queryByText(t('stoppedAfterPhysical'))).not.toBeInTheDocument();
    expect(showSnackbar).toHaveBeenCalledExactlyOnceWith({
      title: t('stoppedAfterPhysical'),
      subtitle: t('physicalStopped'),
      kind: 'info',
      isLowContrast: true,
      autoClose: true,
      timeoutInMs: 5000,
    });
    expect((await api.listApplications()).find((a) => a.id === saved.id)?.status).toBe('awaitingQualification');
  });

  it('shows one temporary notice when a stopped application resumes in prequalification', async () => {
    const api = createMockApplicantSelectionApi();
    const application = validApplication();
    application.completedSteps = ['admission', 'personal'];
    application.stoppedAfterPhysical = true;
    application.qualification.result = 'temporary';
    const saved = await api.completeStep(application, 'physical');
    render(
      <StrictMode>
        <SelectionWorkflow application={saved} api={api} onClose={vi.fn()} onSaved={vi.fn()} t={t} />
      </StrictMode>,
    );

    expect(screen.getByRole('heading', { name: t('qualification') })).toBeInTheDocument();
    expect(screen.queryByText(t('stoppedAfterPhysical'))).not.toBeInTheDocument();
    expect(showSnackbar).toHaveBeenCalledExactlyOnceWith({
      title: t('stoppedAfterPhysical'),
      subtitle: undefined,
      kind: 'info',
      isLowContrast: true,
      autoClose: true,
      timeoutInMs: 5000,
    });
  });

  it('shows the observations limit in qualification', () => {
    render(<Fields initial={validApplication()} stage="qualification" />);
    const observations = screen.getByLabelText('Observaciones');
    expect(observations).toHaveAccessibleDescription('0 / 500 caracteres');
    const overflow = 'a'.repeat(501);
    fireEvent.change(observations, { target: { value: overflow } });
    expect(observations).toHaveValue(overflow);
    expect(observations).toHaveAccessibleDescription(/501 \/ 500/);
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

  it.each(['awaitingQualification', 'deferred'] as const)('prints a temporary deferral in %s', (status) => {
    const application = validApplication();
    application.status = status;
    application.completedSteps = ['admission', 'personal', 'physical', 'qualification'];
    application.stoppedAfterPhysical = status === 'awaitingQualification';
    if (!application.stoppedAfterPhysical) {
      application.completedSteps.splice(3, 0, 'interview');
      application.interview.answers.medication = 'yes';
      application.interview.listDetails = {
        medicationWhich: [
          { id: 1, value: 'Medicamento A DEMO' },
          { id: 2, value: 'Medicamento B DEMO' },
        ],
      };
      application.interview.observations = 'Observación histórica DEMO';
    }
    Object.assign(application.qualification, { result: 'temporary', duration: '7', reason: 'Motivo sintético' });
    application.personal.givenName = '<script>alert(1)</script>';
    application.personal.trips = [
      { id: 1, place: 'Iquitos', duration: '1 día', date: '2026-01-01' },
      { id: 2, place: 'Nauta', duration: '2 días', date: '2026-01-02' },
    ];
    render(
      <SelectionWorkflow
        application={application}
        api={createMockApplicantSelectionApi()}
        onClose={vi.fn()}
        onSaved={vi.fn()}
        t={t}
      />,
    );

    const button = screen.getByRole('button', { name: t('printForm') });
    expect(screen.getByRole('heading', { name: t('review') })).toBeInTheDocument();
    button.focus();
    fireEvent.click(button);
    const frame = document.querySelector('iframe');
    if (!frame?.contentWindow) throw new Error('TEST_PRINT_FRAME_MISSING');
    const html = frame.srcdoc;
    expect(html).toContain('@page { size: A4; margin: 12mm; }');
    expect(html).toContain(t('temporary'));
    expect(html).toContain('Motivo sintético');
    if (application.stoppedAfterPhysical) {
      expect(html).toContain(t('stoppedAfterPhysical'));
    } else {
      expect(html).toContain('<li>Medicamento A DEMO</li><li>Medicamento B DEMO</li>');
      expect(html).not.toContain('Observación histórica DEMO');
    }
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('<td>Iquitos</td><td>1 día</td><td>2026-01-01</td>');
    expect(html).toContain('<td>Nauta</td><td>2 días</td><td>2026-01-02</td>');
    expect(html).toContain('data-signatures');
    expect(html).toContain('NO VÁLIDO PARA USO CLÍNICO');
    const print = vi.fn();
    vi.spyOn(frame.contentWindow, 'focus').mockImplementation(() => {});
    Object.defineProperty(frame.contentWindow, 'print', { configurable: true, value: print });
    frame.onload?.call(frame, new Event('load'));
    expect(print).toHaveBeenCalledOnce();
    frame.contentWindow.dispatchEvent(new Event('afterprint'));
    expect(frame).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it('shows a safe message if the browser cannot print the selection form', () => {
    const application = validApplication();
    application.status = 'deferred';
    render(
      <SelectionWorkflow
        application={application}
        api={createMockApplicantSelectionApi()}
        onClose={vi.fn()}
        onSaved={vi.fn()}
        t={t}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: t('printForm') }));
    const frame = document.querySelector('iframe');
    if (!frame?.contentWindow) throw new Error('TEST_PRINT_FRAME_MISSING');
    vi.spyOn(frame.contentWindow, 'focus').mockImplementation(() => {});
    Object.defineProperty(frame.contentWindow, 'print', {
      configurable: true,
      value: () => {
        throw new Error('PRIVATE_PRINTER_ERROR');
      },
    });
    act(() => frame.onload?.call(frame, new Event('load')));
    expect(screen.getByText(t('printFailed'))).toBeInTheDocument();
    expect(screen.queryByText('PRIVATE_PRINTER_ERROR')).not.toBeInTheDocument();
  });
});
