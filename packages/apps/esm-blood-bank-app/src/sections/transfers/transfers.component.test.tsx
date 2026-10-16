import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import english from '../../../translations/en.json';
import spanish from '../../../translations/es.json';
import { createMockInventoryApi } from '../../api/mock-inventory.api';
import { createMockTransfersApi } from '../../api/mock-transfers.api';
import { openmrsTransfersApi } from '../../api/transfers.api';
import { printDocument } from '../../shared/print-document';
import { sealOperation } from '../inventory/inventory-test-fixtures';
import { TransferRequestDocument } from './transfers-documents.component';
import { TransfersHistory } from './transfers-history.component';
import { TransfersPage } from './transfers-page.component';
import { newTransferRequest, transferDirection } from './transfers-rules';
import { TransfersWorkflow } from './transfers-workflow.component';

vi.mock('@openmrs/esm-framework', () => ({
  useSession: () => ({ sessionLocation: { display: 'Hospital DEMO' } }),
  formatDatetime: () => '14 oct 2026, 12:00',
  showSnackbar: vi.fn(),
  PageHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  PageHeaderContent: ({ title }: { title: string }) => <div>{title}</div>,
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }) }));
vi.mock('../../shared/print-document', () => ({ printDocument: vi.fn() }));
const t = (key: string) =>
  (spanish.transfer as Record<string, string>)[key] ?? (spanish.processing as Record<string, string>)[key] ?? key;

async function ready() {
  const inventory = createMockInventoryApi();
  const units = (await inventory.list()).units.filter((unit) =>
    ['BB-SELLO-DEMO-001', 'BB-SELLO-DEMO-003'].includes(unit.id),
  );
  await inventory.confirmSeal(await inventory.requestSealPrint(await inventory.prepareSeal(sealOperation(units))));
  const api = createMockTransfersApi();
  const workspace = await api.list();
  return { api, request: workspace.requests[0], units: workspace.units };
}
async function reserved() {
  const { api, request } = await ready();
  const saved = await api.savePreparation(request.id, request.revision, {
    unitIds: ['BB-SELLO-DEMO-001', 'BB-SELLO-DEMO-003'],
    certificateOffice: 'CONSTANCIA-MANUAL-DEMO',
    responsible: 'Responsable DEMO',
    evaluationVerified: true,
  });
  const prepared = await api.reserve(saved.id, saved.revision);
  return { api, request: prepared, units: (await api.list()).units };
}
function fillPickup() {
  fireEvent.change(screen.getByLabelText(t('transferCollectorName')), { target: { value: 'Transportista DEMO' } });
  fireEvent.change(screen.getByLabelText(t('transferCollectorDocument')), { target: { value: '90000999' } });
  fireEvent.change(screen.getByLabelText(t('transferDeliveredBy')), { target: { value: 'Profesional DEMO' } });
  fireEvent.click(screen.getByRole('checkbox', { name: t('transferTransportCheck') }));
}
describe('transfer workflow UI and documents', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });
  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('loads the inbox and filters requests without changing them', async () => {
    render(<TransfersPage api={createMockTransfersApi()} />);
    expect(await screen.findAllByRole('button', { name: t('transferAttend') })).toHaveLength(3);
    expect(screen.getByRole('button', { name: t('transferHistory') }).querySelector('svg')).toBeTruthy();
    fireEvent.change(screen.getByRole('searchbox', { name: t('transferSearchInbox') }), {
      target: { value: 'OFICIO-DEMO-2' },
    });
    expect(screen.getAllByRole('button', { name: t('transferAttend') })).toHaveLength(1);
    expect(screen.queryByText('OFICIO-DEMO-1')).not.toBeInTheDocument();
    expect((await createMockTransfersApi().list()).requests).toHaveLength(3);
  });
  it('renders a safe loading failure with retry when the live adapter is unavailable', async () => {
    render(<TransfersPage api={openmrsTransfersApi} />);
    expect(await screen.findByText(t('loadFailed'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('retry') })).toBeEnabled();
    expect(screen.queryByText('TRANSFER_BACKEND_NOT_IMPLEMENTED')).not.toBeInTheDocument();
  });
  it('separates received and requested queues, retaining independent filters and shorter toolbar labels', async () => {
    const api = createMockTransfersApi();
    const incoming = (await api.list()).requests[0];
    await api.saveRequest(
      {
        ...newTransferRequest('outgoing'),
        data: { ...incoming.data, office: 'SALIDA-UI-DEMO', destinationInstitution: 'Banco destino DEMO' },
      },
      true,
    );
    render(<TransfersPage api={api} />);
    expect(await screen.findAllByRole('button', { name: t('transferAttend') })).toHaveLength(3);
    expect(screen.getByRole('tab', { name: t('transferIncomingTab') })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'Historial de solicitudes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrar solicitud' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox', { name: t('transferSearchInbox') }), {
      target: { value: 'OFICIO-DEMO-2' },
    });
    fireEvent.click(screen.getByRole('tab', { name: t('transferOutgoingTab') }));
    expect(screen.getByRole('searchbox', { name: t('transferSearchInbox') })).toHaveValue('');
    expect(screen.queryByRole('button', { name: t('transferAttend') })).not.toBeInTheDocument();
    expect(screen.getByText('SALIDA-UI-DEMO')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: t('transferDestinationInstitution') })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: t('transferIncomingTab') }));
    expect(screen.getByRole('searchbox', { name: t('transferSearchInbox') })).toHaveValue('OFICIO-DEMO-2');
    expect(screen.getAllByRole('button', { name: t('transferAttend') })).toHaveLength(1);
    expect(screen.queryByText('SALIDA-UI-DEMO')).not.toBeInTheDocument();
  });
  it('resumes and generates an outgoing request through review without delivering local units', async () => {
    const api = createMockTransfersApi();
    const incoming = (await api.list()).requests[0];
    await api.saveRequest(
      { ...newTransferRequest('outgoing'), data: { ...incoming.data, office: 'SALIDA-FORM-DEMO' } },
      false,
    );
    render(<TransfersPage api={api} />);
    await screen.findAllByRole('button', { name: t('transferAttend') });
    fireEvent.click(screen.getByRole('tab', { name: t('transferOutgoingTab') }));
    fireEvent.click(screen.getByRole('button', { name: t('transferResume') }));
    expect(screen.getByText(t('transferOutgoingHelp'))).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: t('next') }));
    fireEvent.click(await screen.findByRole('button', { name: t('transferPrintRequest') }));
    expect(printDocument).toHaveBeenCalledOnce();
    expect((await api.list()).requests.find((item) => transferDirection(item) === 'outgoing')?.status).toBe('draft');
    fireEvent.click(screen.getByRole('button', { name: t('transferGenerateRequest') }));
    expect(await screen.findByRole('button', { name: t('transferViewRequest') })).toBeEnabled();
    const workspace = await api.list();
    expect(workspace.requests.find((item) => transferDirection(item) === 'outgoing')?.status).toBe('issued');
    expect(workspace.bookEntries).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: t('transferViewRequest') }));
    expect(screen.getByRole('button', { name: t('transferPrintRequest') })).toBeEnabled();
    expect(screen.queryByRole('tab', { name: t('transferBook') })).not.toBeInTheDocument();
  });
  it('scopes outgoing history to generated requests and drafts without exposing incoming requests or the book', async () => {
    const api = createMockTransfersApi();
    const incoming = (await api.list()).requests[0];
    await api.saveRequest(
      { ...newTransferRequest('outgoing'), data: { ...incoming.data, office: 'SALIDA-HIST-DEMO' } },
      true,
    );
    const workspace = await api.list();
    render(
      <TransfersHistory direction="outgoing" requests={workspace.requests} entries={[]} onClose={vi.fn()} t={t} />,
    );
    expect(screen.getByText('SALIDA-HIST-DEMO')).toBeInTheDocument();
    expect(screen.queryByText(incoming.data.office)).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: t('transferBook') })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: t('transferReceived') })).not.toBeInTheDocument();
  });
  it('requires the entire selection before reserving and then shows the certificate with its manual number', async () => {
    const { api, request, units } = await ready();
    const onClose = vi.fn();
    render(
      <TransfersWorkflow
        initial={request}
        mode="attend"
        units={units}
        api={api}
        onSaved={vi.fn()}
        onClose={onClose}
        t={t}
      />,
    );
    expect(screen.getByRole('button', { name: t('next') })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(t('transferCertificateOffice')), { target: { value: 'OFICIO-MANUAL-111' } });
    fireEvent.change(screen.getByLabelText(t('transferResponsible')), { target: { value: 'Responsable DEMO' } });
    fireEvent.click(screen.getByRole('checkbox', { name: t('transferEvaluationCheck') }));
    fireEvent.click(screen.getByRole('checkbox', { name: `${t('transferSelect')} BB-SELLO-DEMO-001` }));
    expect(screen.getByRole('button', { name: t('next') })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: `${t('transferSelect')} BB-SELLO-DEMO-003` }));
    fireEvent.click(screen.getByRole('button', { name: t('next') }));
    expect(screen.getByText(t('transferReserveWarning'))).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: t('transferConfirm') }));
    expect(await screen.findByRole('button', { name: t('transferPrintCertificate') })).toBeEnabled();
    expect(screen.getByText('OFICIO-MANUAL-111')).toBeInTheDocument();
    const prepared = (await api.list()).requests[0];
    expect(prepared.status).toBe('prepared');
    fireEvent.click(screen.getAllByRole('button', { name: t('close') })[0]);
    expect(onClose).toHaveBeenCalledOnce();
    expect((await api.list()).requests[0].status).toBe('prepared');
  });
  it('allows rejection without selecting units and records its reason', async () => {
    const api = createMockTransfersApi();
    const workspace = await api.list();
    const closed = vi.fn();
    render(
      <TransfersWorkflow
        initial={workspace.requests[2]}
        mode="attend"
        units={workspace.units}
        api={api}
        onSaved={vi.fn()}
        onClose={closed}
        t={t}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`${t('transferReject')}$`) }));
    expect(screen.getByRole('button', { name: new RegExp(`${t('transferConfirm')}$`) })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(t('transferRejectionReason')), { target: { value: 'Sin stock DEMO' } });
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`${t('transferConfirm')}$`) }));
    await waitFor(() => expect(closed).toHaveBeenCalledOnce());
    expect((await api.list()).requests[2].rejectionReason).toBe('Sin stock DEMO');
  });
  it('prints the pickup review without confirming handover, then records the final handover after explicit acceptance', async () => {
    const { api, request, units } = await reserved();
    const closed = vi.fn();
    render(
      <TransfersWorkflow
        initial={request}
        mode="deliver"
        units={units}
        api={api}
        onSaved={vi.fn()}
        onClose={closed}
        t={t}
      />,
    );
    fillPickup();
    fireEvent.click(screen.getByRole('button', { name: t('next') }));
    fireEvent.click(await screen.findByRole('button', { name: t('transferPrintCertificate') }));
    expect(printDocument).toHaveBeenCalledOnce();
    expect((await api.list()).bookEntries).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: t('transferDeliverUnits') }));
    expect(screen.getByText(t('transferDeliverWarning'))).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: t('transferConfirm') }));
    await waitFor(() => expect(closed).toHaveBeenCalledOnce());
    expect((await api.list()).requests[0].status).toBe('delivered');
    expect((await api.list()).bookEntries).toHaveLength(2);
  });
  it('keeps pickup edits in place after a failed save and does not show raw error details', async () => {
    const { api, request, units } = await reserved();
    const failing = { ...api, saveDelivery: vi.fn().mockRejectedValue(new Error('private technical error')) };
    render(
      <TransfersWorkflow
        initial={request}
        mode="deliver"
        units={units}
        api={failing}
        onSaved={vi.fn()}
        onClose={vi.fn()}
        t={t}
      />,
    );
    fillPickup();
    fireEvent.click(screen.getByRole('button', { name: t('next') }));
    expect(await screen.findByText(t('transferSaveFailed'))).toBeInTheDocument();
    expect(screen.getByLabelText(t('transferCollectorName'))).toHaveValue('Transportista DEMO');
    expect(screen.queryByText('private technical error')).not.toBeInTheDocument();
    expect((await api.list()).bookEntries).toHaveLength(0);
  });
  it('uses the shared two-action exit dialog and discards only unconfirmed pickup edits', async () => {
    const { api, request, units } = await reserved();
    const closed = vi.fn();
    render(
      <TransfersWorkflow
        initial={request}
        mode="deliver"
        units={units}
        api={api}
        onSaved={vi.fn()}
        onClose={closed}
        t={t}
      />,
    );
    fireEvent.change(screen.getByLabelText(t('transferCollectorName')), { target: { value: 'Edición no guardada' } });
    fireEvent.click(screen.getByRole('button', { name: t('close') }));
    const exit = screen.getByRole('dialog', { name: t('exitTitle') });
    expect(within(exit).getByRole('button', { name: t('keepEditing') })).toBeEnabled();
    fireEvent.click(within(exit).getByRole('checkbox', { name: t('saveBeforeExit') }));
    fireEvent.click(within(exit).getByRole('button', { name: new RegExp(`${t('leave')}$`) }));
    expect(closed).toHaveBeenCalledOnce();
    expect((await api.list()).requests[0].delivery.collectorName).toBe('');
    expect((await api.list()).requests[0].status).toBe('prepared');
  });
  it('shows FR10 fields and independent transfer entries in history with only the top close action', async () => {
    const { api, request } = await reserved();
    const pickup = await api.saveDelivery(request.id, request.revision, {
      collectorName: 'Recojo DEMO',
      collectorDocument: '90000999',
      deliveredBy: 'Atendido DEMO',
      transportVerified: true,
    });
    await api.deliver(pickup.id, pickup.revision);
    const workspace = await api.list();
    render(<TransfersHistory requests={workspace.requests} entries={workspace.bookEntries} onClose={vi.fn()} t={t} />);
    fireEvent.click(screen.getByRole('tab', { name: t('transferBook') }));
    const table = screen.getByRole('table', { name: t('transferBook') });
    expect(within(table).getAllByText(t('transferNotRecorded'))).toHaveLength(4);
    expect(within(table).getByRole('columnheader', { name: t('transferDischargeDate') })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: t('transferDoctor') })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: t('close') })).toHaveLength(1);
    fireEvent.change(screen.getByRole('searchbox', { name: t('transferSearchHistory') }), {
      target: { value: 'BB-SELLO-DEMO-003' },
    });
    expect(within(table).getAllByRole('button', { name: t('transferViewDetail') })).toHaveLength(1);
  });
  it('keeps original document text inert and maintains English/Spanish parity', async () => {
    const request = (await createMockTransfersApi().list()).requests[0];
    request.data.patientName = '<script>throw new Error("unsafe")</script>';
    const view = render(<TransferRequestDocument request={request} t={t} print />);
    expect(view.container.querySelector('script')).toBeNull();
    expect(view.container.textContent).toContain(request.data.patientName);
    expect(view.container.querySelector('[data-demo]')).toBeTruthy();
    expect(Object.keys(spanish.transfer).sort()).toEqual(Object.keys(english.transfer).sort());
  });
});
