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

vi.mock('@openmrs/esm-framework', () => ({
  PageHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  PageHeaderContent: ({ title }: { title: string }) => <div>{title}</div>,
  useSession: () => ({ sessionLocation: { display: 'Hospital de prueba' } }),
  formatDatetime: () => '03 oct 2026, 13:47',
  showSnackbar: vi.fn(),
  BloodBankPictogram: () => null,
  LaboratoryPictogram: () => null,
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }) }));
const t = (key: string) => (spanish.processing as Record<string, string>)[key] ?? key;
const api = () => createMockProcessingApi(createMockApplicantSelectionApi());
describe('collection and screening screens', () => {
  beforeEach(() => sessionStorage.clear());
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
    expect(screen.getByLabelText(t('component'))).toHaveValue('Componente DEMO');
  });
  it('shows autologous fields only for an autologous applicant', () => {
    const record = newCollection(applicationsMock()[2]);
    record.application.admission.donationType = 'autologous';
    render(<CollectionWorkflow initial={record} api={api().collection} onClose={vi.fn()} onSaved={vi.fn()} t={t} />);
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
    const field = t(section === 'collection' ? 'component' : 'receivedBy');
    fireEvent.change(screen.getByLabelText(field), { target: { value: 'Valor guardado DEMO' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar avance' }));
    await waitFor(() => expect(showSnackbar).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText(field), { target: { value: 'Cambio no guardado DEMO' } });
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
    expect(screen.getByLabelText(field)).toHaveValue('Valor guardado DEMO');
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
    const field = t(section === 'collection' ? 'component' : 'receivedBy');
    fireEvent.change(screen.getByLabelText(field), { target: { value: 'Avance pendiente DEMO' } });
    fireEvent.click(within(screen.getByRole('dialog', { name: title })).getByRole('button', { name: 'Cerrar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salir' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: t('exitTitle') })).not.toBeInTheDocument());
    expect(screen.getByRole('dialog', { name: title }).closest('.cds--modal')).toHaveClass('is-visible');
    expect(screen.getByLabelText(field)).toHaveValue('Avance pendiente DEMO');
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
      plannedVolume: '450',
      service: 'Banco DEMO',
      collectedBy: 'Profesional DEMO',
      sampleType: 'Sangre DEMO',
      sampleContainer: 'Tubo DEMO',
    };
    const finalized = vi.fn();
    render(
      <CollectionWorkflow initial={record} api={processing.collection} onClose={vi.fn()} onSaved={finalized} t={t} />,
    );
    fireEvent.click(screen.getByRole('button', { name: t('next') }));
    await screen.findByLabelText(t('extractedVolume'));
    expect(showSnackbar).toHaveBeenCalledWith(expect.objectContaining({ title: t('collectionLabelSaved') }));
    expect(finalized).not.toHaveBeenCalled();
    expect((await processing.screening.listScreenings()).some((item) => item.collectionId === record.id)).toBe(true);
  });
  it('announces collection completion only after saving the certificate', async () => {
    const processing = api();
    let record = (await processing.collection.listCollections()).find((item) => item.status === 'pending');
    if (!record) throw new Error('SYNTHETIC_COLLECTION_MISSING');
    record.label = {
      ...record.label,
      component: 'Sangre DEMO',
      anticoagulant: 'CPDA DEMO',
      plannedVolume: '450',
      service: 'Banco DEMO',
      collectedBy: 'Profesional DEMO',
      sampleType: 'Sangre DEMO',
      sampleContainer: 'Tubo DEMO',
    };
    record.extractedVolume = '420';
    record.registry = {
      ...record.registry,
      bagLot: 'LOTE DEMO',
      complications: 'no',
      extractionStatus: 'complete',
      attendedBy: 'Profesional DEMO',
    };
    record.certificate.emailConsent = 'no';
    for (const stage of ['label', 'volume', 'registry'] as const)
      record = await processing.collection.saveCollection(record, stage);
    render(<CollectionPage api={processing.collection} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Continuar extracción' }));
    expect(showSnackbar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: t('certificateSave') }));
    await waitFor(() =>
      expect(showSnackbar).toHaveBeenCalledWith(expect.objectContaining({ title: t('collectionFinished') })),
    );
    expect((await processing.collection.listCollections()).find((item) => item.id === record.id)?.status).toBe(
      'completed',
    );
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
  it('opens laboratory reception, requires identity confirmation and saves only a draft on exit', async () => {
    render(<ScreeningPage api={api().screening} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Registrar tamizaje' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y continuar' }));
    expect(screen.getByRole('alert', { name: t('requiredFields') })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(t('receivedBy')), { target: { value: 'Recepción DEMO' } });
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Tamizaje' })).getByRole('button', { name: 'Cerrar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salir' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(await screen.findByRole('button', { name: 'Registrar tamizaje' }));
    expect(screen.getByLabelText(t('receivedBy'))).toHaveValue('Recepción DEMO');
  });
  it('escapes printable synthetic names and shows both independent sample identifiers and the certificate disclaimer', () => {
    const record = newCollection(applicationsMock()[2]);
    record.application.personal.givenName = '<script>unsafe</script>';
    const label = renderToStaticMarkup(<CollectionLabelDocument record={record} sample t={t} />);
    expect(label).not.toContain('<script>unsafe');
    expect(label).toContain('&lt;script&gt;');
    expect(label).toContain(record.sampleCode);
    expect(label).toContain(record.application.admission.documentNumber);
    const certificate = renderToStaticMarkup(<DonationCertificateDocument record={record} t={t} />);
    expect(certificate).toContain('NO acredita');
    expect(certificate).toContain(t('printPrototype'));
  });
});
