import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import spanish from '../../../translations/es.json';
import { createMockApplicantSelectionApi } from '../../api/mock-applicant-selection.api';
import { createMockProcessingApi } from '../../api/mock-blood-bank-processing.api';
import { CollectionPage } from './collection-page.component';
import { CollectionLabelDocument, DonationCertificateDocument } from './collection-documents.component';
import { newCollection } from './collection-rules';
import { applicationsMock } from '../../mocks/applicant-selection.mock';
import { CollectionWorkflow } from './collection-workflow.component';
import { ScreeningPage } from '../laboratory/screening/screening-page.component';
import { screeningTests } from '../laboratory/screening/screening.types';
import { localDateTime } from '../laboratory/screening/screening-rules';
import { showSnackbar } from '@openmrs/esm-framework';
import { calculateReturnDate, today } from '../applicant-selection/selection-rules';

const sessionPerson = vi.hoisted(() => ({ display: 'Rosa Torres García' }));

vi.mock('@openmrs/esm-framework', () => ({
  PageHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  PageHeaderContent: ({ title }: { title: string }) => <div>{title}</div>,
  useSession: () => ({
    authenticated: true,
    user: { username: 'operador.demo', person: sessionPerson },
    sessionLocation: { display: 'Hospital de prueba' },
  }),
  formatDatetime: () => '03 oct 2026, 13:47',
  showSnackbar: vi.fn(),
  BloodBankPictogram: () => null,
  LaboratoryPictogram: () => null,
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }) }));
const t = (key: string, values?: Record<string, string>) =>
  ((spanish.processing as Record<string, string>)[key] ?? key).replace(
    /\{\{(\w+)\}\}/g,
    (match, name) => values?.[name] ?? match,
  );
const api = () => createMockProcessingApi(createMockApplicantSelectionApi());
describe('collection and screening screens', () => {
  beforeEach(() => {
    sessionStorage.clear();
    sessionPerson.display = 'Rosa Torres García';
  });
  it.each([
    'collection',
    'screening',
  ])('adds a descriptive unit to %s cards without a prototype notice', async (section) => {
    const processing = api();
    render(
      section === 'collection' ? (
        <CollectionPage api={processing.collection} />
      ) : (
        <ScreeningPage api={processing.screening} />
      ),
    );
    expect(
      screen.getAllByText(section === 'collection' ? 'Postulantes' : 'Muestras', { selector: 'small' }),
    ).toHaveLength(3);
    expect(screen.queryByText(/Prototipo con datos sintéticos/)).not.toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: section === 'collection' ? 'Extraer sangre' : 'Registrar tamizaje' }),
    ).toBeInTheDocument();
  });
  it('renders the selected-applicant queue and filters it without adding admitted applicants', async () => {
    render(<CollectionPage api={api().collection} />);
    expect(await screen.findByRole('button', { name: 'Extraer sangre' })).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('90000012', { exact: false })).toBeInTheDocument();
    expect(within(screen.getByRole('table')).queryByText('90000010', { exact: false })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Buscar en la lista'), { target: { value: 'missing' } });
    expect(screen.getByText('No se encontraron registros')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Buscar en la lista'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Registro de donaciones' }));
    expect(await screen.findByRole('button', { name: 'Ver constancia' })).toBeInTheDocument();
  });
  it('keeps the original modal open when cancelling X and preserves a saved partial label on reopen', async () => {
    render(<CollectionPage api={api().collection} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Extraer sangre' }));
    await screen.findByRole('option', { name: 'UPSS Banco de Sangre' });
    fireEvent.change(screen.getByLabelText(t('component')), { target: { value: 'Componente DEMO' } });
    fireEvent.click(
      within(screen.getByRole('dialog', { name: t('collectionTitle') })).getByRole('button', { name: 'Cerrar' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Seguir editando' }));
    expect(screen.getByLabelText(t('component'))).toHaveValue('Componente DEMO');
    fireEvent.click(
      within(screen.getByRole('dialog', { name: t('collectionTitle') })).getByRole('button', { name: 'Cerrar' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Salir' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(await screen.findByRole('button', { name: 'Continuar extracción' }));
    await screen.findByRole('option', { name: 'UPSS Banco de Sangre' });
    expect(screen.getByLabelText(t('component'))).toHaveValue('Componente DEMO');
  });
  it('shows autologous fields only for an autologous applicant', async () => {
    const record = newCollection(applicationsMock()[2]);
    record.application.admission.donationType = 'autologous';
    render(<CollectionWorkflow initial={record} api={api().collection} onClose={vi.fn()} onSaved={vi.fn()} t={t} />);
    await screen.findByRole('option', { name: 'UPSS Banco de Sangre' });
    expect(screen.getByLabelText(t('recipientName'))).toBeInTheDocument();
    expect(screen.getByLabelText(t('recipientDocument'))).toBeInTheDocument();
  });

  it.each([
    'collection',
    'screening',
  ])('discards only unsaved %s changes and preserves the last saved draft', async (section) => {
    const processing = api();
    const save =
      section === 'collection'
        ? vi.spyOn(processing.collection, 'saveCollection')
        : vi.spyOn(processing.screening, 'saveScreening');
    render(
      section === 'collection' ? (
        <CollectionPage api={processing.collection} />
      ) : (
        <ScreeningPage api={processing.screening} />
      ),
    );
    const action = section === 'collection' ? /^(Extraer sangre|Continuar extracción)$/ : /^Registrar tamizaje$/;
    fireEvent.click(await screen.findByRole('button', { name: action }));
    const field = t(section === 'collection' ? 'component' : 'receivedOn');
    const savedValue = section === 'collection' ? 'Valor guardado DEMO' : '2025-01-02T13:30';
    const unsavedValue = section === 'collection' ? 'Cambio no guardado DEMO' : '2025-01-02T13:40';
    fireEvent.change(screen.getByLabelText(field), { target: { value: savedValue } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar avance' }));
    await waitFor(() => expect(showSnackbar).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText(field), { target: { value: unsavedValue } });
    fireEvent.click(
      within(
        screen.getByRole('dialog', { name: t(section === 'collection' ? 'collectionTitle' : 'screeningTitle') }),
      ).getByRole('button', { name: 'Cerrar' }),
    );
    expect(screen.getByLabelText(t('saveBeforeExit'))).toBeChecked();
    fireEvent.click(screen.getByLabelText(t('saveBeforeExit')));
    fireEvent.click(screen.getByRole('button', { name: /Salir$/ }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(save).toHaveBeenCalledOnce();
    fireEvent.click(await screen.findByRole('button', { name: action }));
    if (section === 'collection') await screen.findByRole('option', { name: 'UPSS Banco de Sangre' });
    expect(screen.getByLabelText(field)).toHaveValue(savedValue);
  });

  it.each([
    'collection',
    'screening',
  ])('keeps the %s workflow and input open when saving on exit fails', async (section) => {
    const processing = api();
    if (section === 'collection')
      processing.collection.saveCollection = vi.fn().mockRejectedValue(new Error('PRIVATE_SAVE_ERROR'));
    else processing.screening.saveScreening = vi.fn().mockRejectedValue(new Error('PRIVATE_SAVE_ERROR'));
    render(
      section === 'collection' ? (
        <CollectionPage api={processing.collection} />
      ) : (
        <ScreeningPage api={processing.screening} />
      ),
    );
    fireEvent.click(
      await screen.findByRole('button', { name: section === 'collection' ? 'Extraer sangre' : 'Registrar tamizaje' }),
    );
    const title = t(section === 'collection' ? 'collectionTitle' : 'screeningTitle');
    const field = t(section === 'collection' ? 'component' : 'receivedOn');
    const pendingValue = section === 'collection' ? 'Avance pendiente DEMO' : '2025-01-02T13:30';
    fireEvent.change(screen.getByLabelText(field), { target: { value: pendingValue } });
    fireEvent.click(within(screen.getByRole('dialog', { name: title })).getByRole('button', { name: 'Cerrar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salir' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: t('exitTitle') })).not.toBeInTheDocument());
    expect(screen.getByRole('dialog', { name: title }).closest('.cds--modal')).toHaveClass('is-visible');
    expect(screen.getByLabelText(field)).toHaveValue(pendingValue);
    expect(
      screen.getByText(t(section === 'collection' ? 'collectionSaveFailed' : 'screeningSaveFailed')),
    ).toBeInTheDocument();
    expect(screen.queryByText('PRIVATE_SAVE_ERROR')).not.toBeInTheDocument();
    expect(showSnackbar).not.toHaveBeenCalled();
  });

  it.each([
    'collection',
    'screening',
  ])('announces a persisted %s draft through the timed shell notification, not inside its modal', async (section) => {
    const processing = api();
    render(
      section === 'collection' ? (
        <CollectionPage api={processing.collection} />
      ) : (
        <ScreeningPage api={processing.screening} />
      ),
    );
    fireEvent.click(
      await screen.findByRole('button', { name: section === 'collection' ? 'Extraer sangre' : 'Registrar tamizaje' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Guardar avance' }));
    await waitFor(() =>
      expect(showSnackbar).toHaveBeenCalledWith({
        title: t(section === 'collection' ? 'collectionDraftCreated' : 'screeningDraftUpdated'),
        kind: 'success',
        isLowContrast: true,
        autoClose: true,
        timeoutInMs: 5000,
      }),
    );
    expect(
      screen.queryByText(t(section === 'collection' ? 'collectionDraftCreated' : 'screeningDraftUpdated')),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('dialog', { name: t(section === 'collection' ? 'collectionTitle' : 'screeningTitle') }),
    ).toBeInTheDocument();
  });

  it('keeps a failed save visible in the workflow and never emits success', async () => {
    const processing = api();
    processing.collection.saveCollection = vi.fn().mockRejectedValue(new Error('PRIVATE_SAVE_ERROR'));
    render(<CollectionPage api={processing.collection} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Extraer sangre' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar avance' }));
    expect(await screen.findByText(t('collectionSaveFailed'))).toBeInTheDocument();
    expect(showSnackbar).not.toHaveBeenCalled();
    expect(screen.queryByText('PRIVATE_SAVE_ERROR')).not.toBeInTheDocument();
  });
  it('shows an accessible lot counter, preserves an oversized paste and blocks draft/exit until corrected', async () => {
    const record = newCollection(applicationsMock()[2]);
    record.completedSteps = ['label', 'volume'];
    const processing = api();
    const write = vi.spyOn(processing.collection, 'saveCollection');
    const closed = vi.fn();
    const finalized = vi.fn();
    render(
      <CollectionWorkflow initial={record} api={processing.collection} onClose={closed} onSaved={finalized} t={t} />,
    );
    const input = screen.getByLabelText(t('bagLot'));
    expect(input).not.toHaveAttribute('maxlength');
    expect(input).toHaveAccessibleDescription(expect.stringContaining('0 / 50'));
    const overlong = `${'X'.repeat(49)}😀`;
    fireEvent.change(input, { target: { value: overlong } });
    expect(input).toHaveValue(overlong);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription(expect.stringContaining('51 / 50'));
    expect(input).toHaveAccessibleDescription(expect.stringContaining(t('bagLotTooLong')));
    fireEvent.click(screen.getByRole('button', { name: t('saveDraft') }));
    expect(write).not.toHaveBeenCalled();
    fireEvent.click(
      within(screen.getByRole('dialog', { name: t('collectionTitle') })).getByRole('button', { name: t('close') }),
    );
    fireEvent.click(screen.getByRole('button', { name: t('leave') }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: t('exitTitle') })).not.toBeInTheDocument());
    expect(input).toHaveValue(overlong);
    expect(closed).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    expect(showSnackbar).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: 'X'.repeat(50) } });
    fireEvent.click(screen.getByRole('button', { name: t('saveDraft') }));
    await waitFor(() => expect(write).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(showSnackbar).toHaveBeenCalledWith(expect.objectContaining({ title: t('collectionDraftCreated') })),
    );
    expect(input).toHaveValue('X'.repeat(50));
    expect(finalized).not.toHaveBeenCalled();
  });
  it('uses an update message for an existing collection draft', async () => {
    const processing = api();
    const record = (await processing.collection.listCollections()).find((item) => item.status === 'pending');
    if (!record) throw new Error('SYNTHETIC_COLLECTION_MISSING');
    const initial = await processing.collection.saveCollection(record);
    render(
      <CollectionWorkflow initial={initial} api={processing.collection} onClose={vi.fn()} onSaved={vi.fn()} t={t} />,
    );
    fireEvent.change(screen.getByLabelText(t('component')), { target: { value: 'Componente actualizado DEMO' } });
    fireEvent.click(screen.getByRole('button', { name: t('saveDraft') }));
    await waitFor(() =>
      expect(showSnackbar).toHaveBeenCalledWith(expect.objectContaining({ title: t('collectionDraftUpdated') })),
    );
  });
  it.each([
    'collection',
    'screening',
  ])('closes an unchanged saved %s draft without another write or notification', async (section) => {
    const processing = api();
    render(
      section === 'collection' ? (
        <CollectionPage api={processing.collection} />
      ) : (
        <ScreeningPage api={processing.screening} />
      ),
    );
    fireEvent.click(
      await screen.findByRole('button', { name: section === 'collection' ? 'Extraer sangre' : 'Registrar tamizaje' }),
    );
    fireEvent.click(screen.getByRole('button', { name: t('saveDraft') }));
    await waitFor(() => expect(showSnackbar).toHaveBeenCalled());
    vi.mocked(showSnackbar).mockClear();
    const write =
      section === 'collection'
        ? vi.spyOn(processing.collection, 'saveCollection')
        : vi.spyOn(processing.screening, 'saveScreening');
    const dialog = screen.getByRole('dialog', {
      name: t(section === 'collection' ? 'collectionTitle' : 'screeningTitle'),
    });
    fireEvent.click(within(dialog).getByRole('button', { name: t('close') }));
    fireEvent.click(screen.getByRole('button', { name: t('leave') }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(write).not.toHaveBeenCalled();
    expect(showSnackbar).not.toHaveBeenCalled();
  });
  it('shows a safe error and retry on a failed laboratory load', async () => {
    const screening = api().screening;
    screening.listScreenings = async () => {
      throw new Error('SECRET_STACK');
    };
    render(<ScreeningPage api={screening} />);
    expect(await screen.findByText(t('loadFailed'))).toBeInTheDocument();
    expect(screen.queryByText('SECRET_STACK')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
  it('announces the label stage without claiming collection completion', async () => {
    const processing = api();
    const record = (await processing.collection.listCollections()).find((item) => item.status === 'pending');
    if (!record) throw new Error('SYNTHETIC_COLLECTION_MISSING');
    record.label = {
      ...record.label,
      component: 'Sangre DEMO',
      anticoagulant: 'CPDA DEMO',
      anticoagulantConceptUuid: 'mock-collection-cpda1',
      service: 'Banco DEMO',
      serviceConceptUuid: 'mock-collection-blood-bank',
      collectedBy: 'Profesional DEMO',
      sampleType: 'Sangre DEMO',
      sampleContainer: 'Tubo DEMO',
    };
    const finalized = vi.fn();
    render(
      <CollectionWorkflow initial={record} api={processing.collection} onClose={vi.fn()} onSaved={finalized} t={t} />,
    );
    await screen.findByRole('option', { name: 'UPSS Banco de Sangre' });
    fireEvent.click(screen.getByRole('button', { name: t('next') }));
    await screen.findByLabelText(t('extractedVolume'));
    expect(showSnackbar).toHaveBeenCalledWith(expect.objectContaining({ title: t('collectionLabelSaved') }));
    expect(finalized).not.toHaveBeenCalled();
    expect((await processing.screening.listScreenings()).some((item) => item.collectionId === record.id)).toBe(true);
  });
  it('saves the registry with the current operator and shows the saved data in read-only fields', async () => {
    const processing = api();
    let record = (await processing.collection.listCollections()).find((item) => item.status === 'pending');
    if (!record) throw new Error('SYNTHETIC_COLLECTION_MISSING');
    record.label = {
      ...record.label,
      component: 'Sangre DEMO',
      anticoagulant: 'CPDA DEMO',
      anticoagulantConceptUuid: 'mock-collection-cpda1',
      plannedVolume: '450',
      service: 'Banco DEMO',
      serviceConceptUuid: 'mock-collection-blood-bank',
      collectedBy: 'Profesional DEMO',
      sampleType: 'Sangre DEMO',
      sampleContainer: 'Tubo DEMO',
    };
    record.extractedVolume = '420';
    record.certificate.emailConsent = 'no';
    for (const stage of ['label', 'volume'] as const)
      record = await processing.collection.saveCollection(record, stage);
    render(<CollectionPage api={processing.collection} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Continuar extracción' }));
    const date = screen.getByLabelText(t('collectionDate'));
    const attendedBy = screen.getByLabelText(t('attendedBy'));
    expect(attendedBy).toHaveValue(sessionPerson.display);
    expect(attendedBy).toHaveAttribute('readonly');
    expect(date).toHaveValue(today());
    expect(date).toHaveAttribute('max', today());
    expect(screen.queryByLabelText(t('observations'))).not.toBeInTheDocument();
    const outcome = within(screen.getByRole('group', { name: t('extractionStatus') }));
    expect(outcome.getAllByRole('radio')).toHaveLength(2);
    expect(outcome.getByRole('radio', { name: t('complete') })).not.toBeChecked();
    fireEvent.click(outcome.getByRole('radio', { name: t('incomplete') }));
    fireEvent.click(
      within(screen.getByRole('group', { name: t('complications') })).getByRole('radio', { name: t('no') }),
    );
    fireEvent.change(screen.getByLabelText(t('bagLot')), { target: { value: 'LOTE DEMO' } });
    fireEvent.change(date, { target: { value: calculateReturnDate(today(), '1', 'days') } });
    fireEvent.click(screen.getByRole('button', { name: t('next') }));
    expect(showSnackbar).not.toHaveBeenCalled();
    fireEvent.change(date, { target: { value: today() } });
    fireEvent.click(screen.getByRole('button', { name: t('next') }));
    await screen.findByRole('button', { name: t('certificateSave') });
    sessionPerson.display = 'Otra persona';
    fireEvent.click(screen.getByRole('button', { name: t('previous') }));
    expect(screen.getByLabelText(t('attendedBy'))).toHaveValue('Rosa Torres García');
    const savedOutcome = screen.getByLabelText(t('extractionStatus'));
    expect(savedOutcome).toHaveValue(t('incomplete'));
    expect(savedOutcome).toHaveAttribute('readonly');
    expect(savedOutcome).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: t('next') }));
    fireEvent.click(screen.getByRole('button', { name: t('printCertificate') }));
    const documentFrame = document.querySelector('iframe');
    expect(documentFrame?.srcdoc).toContain('@bottom-left { content: ""; }');
    expect(documentFrame?.srcdoc).toContain(t('certificateDonorSignature'));
    documentFrame?.remove();
    fireEvent.click(screen.getByRole('button', { name: t('certificateSave') }));
    await waitFor(() =>
      expect(showSnackbar).toHaveBeenCalledWith(expect.objectContaining({ title: t('collectionFinished') })),
    );
    expect((await processing.collection.listCollections()).find((item) => item.id === record.id)?.status).toBe(
      'completed',
    );
  });
  it('uses the session operator, prints compact labels and advances with a preservative only', async () => {
    const processing = api();
    render(<CollectionPage api={processing.collection} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Extraer sangre' }));
    const modal = screen.getByRole('dialog', { name: 'Extracción' });
    const fields = within(modal);
    expect(fields.queryByLabelText(t('sampleType'))).not.toBeInTheDocument();
    expect(fields.queryByLabelText(t('sampleContainer'))).not.toBeInTheDocument();
    expect(fields.queryByLabelText(/Volumen aproximado/)).not.toBeInTheDocument();
    expect(fields.getByLabelText('Sangre o componente propuesto')).toBeInTheDocument();
    const operator = fields.getByLabelText(t('collectedBy'));
    expect(operator).toHaveAttribute('readonly');
    expect(operator).toHaveValue('Rosa Torres García');
    const campaign = await fields.findByRole('option', { name: 'Campaña de donación' });
    const service = fields.getByRole('combobox', { name: t('service') });
    expect(within(service).getByRole('option', { name: 'UPSS Banco de Sangre' })).toBeInTheDocument();
    fireEvent.change(service, { target: { value: (campaign as HTMLOptionElement).value } });
    expect(
      within(fields.getByRole('combobox', { name: t('anticoagulant') })).getByRole('option', { name: 'CPDA-1' }),
    ).toBeInTheDocument();
    fireEvent.change(fields.getByLabelText(t('component')), { target: { value: 'Sangre DEMO' } });
    fireEvent.click(fields.getByRole('button', { name: t('next') }));
    expect(fields.getByRole('alert', { name: t('requiredFields') })).toHaveTextContent(
      t('anticoagulantOrPreservative'),
    );
    fireEvent.change(fields.getByLabelText(t('preservative')), { target: { value: 'Solución DEMO' } });
    const labelMarkup = (key: 'printUnit' | 'printSample') => {
      fireEvent.click(fields.getByRole('button', { name: t(key) }));
      const frame = document.querySelector('iframe');
      if (!frame) throw new Error('TEST_PRINT_FRAME_MISSING');
      const parsed = new DOMParser().parseFromString(frame.srcdoc, 'text/html');
      frame.remove();
      expect(parsed.body.textContent).not.toContain(t(key));
      expect(parsed.body.textContent).not.toContain(t('printPrototype'));
      return parsed;
    };
    const unitLabel = labelMarkup('printUnit');
    expect(unitLabel.querySelector('[data-label="unit"] h2')?.textContent).toMatch(/^BB-/);
    expect(unitLabel.querySelector('[data-manual-volume]')?.textContent).toBe('');
    expect(unitLabel.body.textContent).toContain(t('labelVolume'));
    const tubeLabel = labelMarkup('printSample');
    expect(tubeLabel.querySelector('[data-label="tube"] h2')?.textContent).toMatch(/^M-/);
    expect(tubeLabel.querySelector('style')?.textContent).toContain('width: 65mm');
    expect(tubeLabel.body.textContent).not.toContain(t('sampleType'));
    expect(tubeLabel.body.textContent).not.toContain(t('sampleContainer'));

    fireEvent.click(fields.getByRole('button', { name: t('next') }));
    await fields.findByLabelText(t('extractedVolume'));
    expect(fields.queryByRole('button', { name: t('printUnit') })).not.toBeInTheDocument();
    expect(fields.queryByRole('button', { name: t('printSample') })).not.toBeInTheDocument();
    expect(fields.getByText(t('volumeHelp')).closest('.cds--inline-notification')).toHaveClass(
      'cds--inline-notification--warning',
    );
    expect(fields.queryByText(t('locked'))).not.toBeInTheDocument();
    const saved = (await processing.collection.listCollections()).find((item) => item.status === 'inProgress');
    expect(saved?.label).toMatchObject({
      service: 'Campaña de donación',
      serviceConceptUuid: 'mock-collection-campaign',
      collectedBy: 'Rosa Torres García',
      preservative: 'Solución DEMO',
      anticoagulant: '',
      sedimentingAgent: '',
    });
    expect(saved?.label).not.toHaveProperty('plannedVolume');
    sessionPerson.display = 'Marco Ruiz Soto';
    fireEvent.click(fields.getByRole('button', { name: t('previous') }));
    expect(fields.getByLabelText(t('service'))).toHaveAttribute('readonly');
    expect(fields.getByLabelText(t('collectedBy'))).toHaveValue('Rosa Torres García');
    expect(fields.queryByText(t('locked'))).not.toBeInTheDocument();
  });
  it('requires a session person name before completing or printing a new label', async () => {
    sessionPerson.display = '';
    const processing = api();
    const record = newCollection(applicationsMock()[2]);
    Object.assign(record.label, {
      component: 'Sangre DEMO',
      collectedBy: 'Nombre histórico DEMO',
      preservative: 'Solución DEMO',
      service: 'UPSS Banco de Sangre',
      serviceConceptUuid: 'mock-collection-blood-bank',
    });
    const save = vi.spyOn(processing.collection, 'saveCollection');
    render(
      <CollectionWorkflow initial={record} api={processing.collection} onClose={vi.fn()} onSaved={vi.fn()} t={t} />,
    );
    await screen.findByRole('option', { name: 'UPSS Banco de Sangre' });
    expect(screen.getByLabelText(t('collectedBy'))).toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: t('printUnit') }));
    expect(document.querySelector('iframe')).toBeNull();
    expect(screen.getByText(t('collectionOperatorUnavailable'))).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: t('next') }));
    expect(save).not.toHaveBeenCalled();
  });
  it('offers a safe retry when a label catalog fails to load', async () => {
    const processing = api();
    const load = processing.collection.listLabelConcepts;
    vi.spyOn(processing.collection, 'listLabelConcepts').mockImplementation(async (field) => {
      if (field === 'service') throw new Error('INTERNAL_CONCEPT_ERROR');
      return load(field);
    });
    render(<CollectionPage api={processing.collection} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Extraer sangre' }));
    expect(await screen.findByText(t('collectionConceptsFailed'))).toBeInTheDocument();
    expect(screen.queryByText('INTERNAL_CONCEPT_ERROR')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: t('service') })).toBeDisabled();
    vi.mocked(processing.collection.listLabelConcepts).mockImplementation(load);
    fireEvent.click(screen.getByRole('button', { name: t('retry') }));
    expect(await screen.findByRole('option', { name: 'Campaña de donación' })).toBeInTheDocument();
  });
  it('announces screening completion only after validation and never says the unit is released', async () => {
    const processing = api();
    let record = (await processing.screening.listScreenings())[0];
    record.identityVerified = true;
    record.receivedOn = localDateTime();
    record.receivedBy = 'Recepción DEMO';
    record.performedOn = localDateTime();
    record.performedBy = 'Laboratorio DEMO';
    record.validatedBy = 'Validador DEMO';
    for (const test of screeningTests)
      record.tests[test] = { result: 'nonReactive', reagent: 'Reactivo DEMO', brand: 'Marca DEMO', lot: 'Lote DEMO' };
    record = await processing.screening.saveScreening(record, 'reception');
    record = await processing.screening.saveScreening(record, 'results');
    render(<ScreeningPage api={processing.screening} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Registrar tamizaje' }));
    expect(showSnackbar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: t('validateResults') }));
    await waitFor(() =>
      expect(showSnackbar).toHaveBeenCalledWith(expect.objectContaining({ title: t('screeningFinished') })),
    );
    expect((await processing.screening.listScreenings()).find((item) => item.id === record.id)?.status).toBe(
      'validated',
    );
    expect(
      (await processing.collection.listCollections()).find((item) => item.id === record.collectionId)?.unitStatus,
    ).toBe('quarantine');
  });
  it('records the signed-in receiver and keeps screening results editable when expanding the panel', async () => {
    const processing = api();
    render(<ScreeningPage api={processing.screening} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Registrar tamizaje' }));
    const modal = within(screen.getByRole('dialog', { name: t('screeningTitle') }));
    expect(screen.getByText(t('applicantNumber'), { selector: 'dt' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: t('reception') })).not.toBeInTheDocument();
    expect(modal.queryByText(t('sampleType'))).not.toBeInTheDocument();
    expect(modal.queryByText(t('sampleContainer'))).not.toBeInTheDocument();
    expect(modal.queryByText(/Ante una discrepancia/)).not.toBeInTheDocument();
    expect(modal.getByText(/^\d{2}-\d{2}-\d{4} \d{2}:\d{2}$/)).toBeInTheDocument();
    expect(modal.getByLabelText(t('receivedBy'))).toHaveValue('Rosa Torres García');
    expect(modal.getByLabelText(t('receivedBy'))).toHaveAttribute('readonly');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y continuar' }));
    expect(screen.getByRole('alert', { name: t('requiredFields') })).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Tamizaje' })).getByRole('button', { name: 'Cerrar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salir' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    sessionPerson.display = 'Mario Pérez Salas';
    fireEvent.click(await screen.findByRole('button', { name: 'Registrar tamizaje' }));
    expect(screen.getByLabelText(t('receivedBy'))).toHaveValue('Mario Pérez Salas');
    fireEvent.click(screen.getByRole('checkbox', { name: t('identityVerified') }));
    fireEvent.click(screen.getByRole('button', { name: t('next') }));
    const performedBy = await screen.findByLabelText(t('performedBy'));
    expect(screen.queryByText(t('sampleType'), { selector: 'dt' })).not.toBeInTheDocument();
    expect(screen.queryByText(t('sampleContainer'), { selector: 'dt' })).not.toBeInTheDocument();
    const results = screen.getByRole('button', { name: t('results') });
    expect(results).toHaveAttribute('aria-expanded', 'true');
    fireEvent.change(performedBy, { target: { value: 'Tecnólogo de prueba' } });
    fireEvent.click(results);
    expect(results).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(screen.getByRole('button', { name: t('next') }));
    expect(results).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText(t('performedBy'))).toHaveValue('Tecnólogo de prueba');
    sessionPerson.display = 'Otra persona';
    fireEvent.click(screen.getByRole('button', { name: t('previous') }));
    expect(screen.getByLabelText(t('receivedBy'))).toHaveValue('Mario Pérez Salas');
    const confirmation = screen.getByRole('textbox', { name: t('identityVerified') });
    expect(confirmation).toHaveValue(t('yes'));
    expect(confirmation).toBeEnabled();
    expect(confirmation).toHaveAttribute('readonly');
  });
  it('escapes names in printed documents and includes the completed replacement donation details', () => {
    const record = newCollection(applicationsMock()[2]);
    record.application.personal.givenName = '<script>unsafe</script>';
    record.application.personal.sex = 'F';
    record.application.admission.donationType = 'replacement';
    record.application.admission.beneficiaryName = 'Paciente de prueba';
    record.registry.date = '2026-11-11';
    record.certificate.resultsAvailableOn = '2026-11-21';
    record.label.component = 'Paquete globular';
    const label = renderToStaticMarkup(<CollectionLabelDocument record={record} sample t={t} />);
    expect(label).not.toContain('<script>unsafe');
    expect(label).toContain('&lt;script&gt;');
    expect(label).toContain(record.sampleCode);
    expect(label).toContain(record.application.admission.documentNumber);
    const certificate = renderToStaticMarkup(<DonationCertificateDocument record={record} t={t} />);
    expect(certificate).toContain('NO ACREDITA');
    expect(certificate).not.toContain(t('printPrototype'));
    expect(certificate).toContain('la Sra. &lt;script&gt;unsafe&lt;/script&gt;');
    expect(certificate).toContain('donó una unidad de Paquete globular');
    expect(certificate).toContain('☒ Donación por reposición');
    expect(certificate).toContain('Paciente de prueba');
    expect(certificate).toContain('11/11/2026');
    expect(certificate).toContain('21/11/2026');
    expect(certificate).toContain('Iquitos, 11 de noviembre del 2026');
    expect(certificate).toContain('Firma del donante');
  });
});
