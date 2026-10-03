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
    expect(screen.getByText(t('saveFailed'))).toBeInTheDocument();
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
        title: t('saved'),
        kind: 'success',
        isLowContrast: true,
        autoClose: true,
        timeoutInMs: 5000,
      }),
    );
    expect(screen.queryByText(t('saved'))).not.toBeInTheDocument();
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
    expect(await screen.findByText(t('saveFailed'))).toBeInTheDocument();
    expect(showSnackbar).not.toHaveBeenCalled();
    expect(screen.queryByText('PRIVATE_SAVE_ERROR')).not.toBeInTheDocument();
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
