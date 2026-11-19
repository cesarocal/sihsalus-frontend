import { IbmDevopsTest } from '@carbon/react/icons';
import { type FetchResponse, openmrsFetch } from '@openmrs/esm-framework';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import english from '../../../translations/en.json';
import spanish from '../../../translations/es.json';
import { createMockTransfusionsApi } from '../../api/mock-transfusions.api';
import { openmrsTransfusionsApi } from '../../api/transfusions.api';
import { BloodBankPageIllustration } from '../../shared/blood-bank-page-illustration.component';
import { formatListDate } from '../../shared/format-list-date';
import { printDocument } from '../../shared/print-document';
import { WarningConfirmation } from '../../shared/warning-confirmation.component';
import { CompatibilityPage } from '../laboratory/compatibility/compatibility-page.component';
import { CompatibilityWorkflow } from '../laboratory/compatibility/compatibility-workflow.component';
import { localDateTime } from '../laboratory/screening/screening-rules';
import { Fr08Document } from './fr08-document.component';
import { TransfusionHistory } from './transfusion-history.component';
import {
  compatibilityLabelPrintCss,
  compatibilityReportPrintCss,
  TransfusionLabels,
} from './transfusion-print.component';
import { TransfusionUnitPicker } from './transfusion-unit-picker.component';
import { TransfusionWorkflow } from './transfusion-workflow.component';
import { TransfusionsPage } from './transfusions-page.component';

vi.mock('@openmrs/esm-framework', () => ({
  openmrsFetch: vi.fn(),
  restBaseUrl: '/ws/rest/v1',
  userHasAccess: () => true,
  useSession: () => ({
    authenticated: true,
    user: { person: { preferredName: { givenName: 'Rosa', familyName: 'Calderón' } } },
    sessionLocation: { display: 'Hospital DEMO' },
  }),
  formatDatetime: () => '16 oct 2026, 12:00',
  showSnackbar: vi.fn(),
  PageHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  PageHeaderContent: ({ title }: { title: string }) => <div>{title}</div>,
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }) }));
vi.mock(import('../../shared/print-document'), async (original) => ({
  ...(await original()),
  printDocument: vi.fn(),
}));
const t = (key: string, values?: Record<string, string>) =>
  (
    (spanish.transfusion as Record<string, string>)[key] ??
    (spanish.processing as Record<string, string>)[key] ??
    key
  ).replace(/\{\{(\w+)\}\}/g, (match, name: string) => values?.[name] ?? match);
const code = (number: number) => `BB-TX-DEMO-${String(number).padStart(3, '0')}`;
async function prepared() {
  const api = createMockTransfusionsApi();
  const initial = (await api.list()).requests[0];
  const reviewed = await api.review(initial.id, initial.revision, {
    ...initial.draft,
    reviewVerified: true,
    consentVerified: true,
    reviewer: 'Atención DEMO',
  });
  const collectedAt = localDateTime();
  const request = await api.saveSample(reviewed.id, reviewed.revision, {
    ...reviewed.draft.sample,
    collectedAt,
    collectedBy: 'Extracción DEMO',
    printRequestedAt: collectedAt,
  });
  return { api, request, units: (await api.list()).units };
}
async function assigned() {
  const setup = await prepared();
  return {
    ...setup,
    request: await setup.api.assign(setup.request.id, setup.request.revision, [code(1), code(2), code(11)], true),
  };
}
async function compatible() {
  const setup = await assigned();
  const round = setup.request.rounds[0];
  return {
    ...setup,
    request: await setup.api.saveCompatibility(
      setup.request.id,
      setup.request.revision,
      {
        ...round,
        operator: 'Laboratorio DEMO',
        identityVerified: true,
        pretransfusionVerified: true,
        results: Object.fromEntries(Object.keys(round.results).map((id) => [id, 'compatible'])),
      },
      true,
    ),
  };
}

describe('transfusion attention, sample pairing and dispatch UI', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
    vi.mocked(openmrsFetch).mockReset();
  });
  it('formats list dates with abbreviated months and only includes a stored time', () => {
    expect(formatListDate('2026-11-12T15:35')).toBe('12 nov 2026, 15:35');
    expect(formatListDate('12/11/2026')).toBe('12 nov 2026');
    expect(formatListDate('2026-02-30')).toBe('—');
  });
  it('prints catalogued components outside the seven FR08 lines under Other with their quantities', async () => {
    const { order } = (await createMockTransfusionsApi().list()).requests[0];
    render(
      <Fr08Document
        order={{
          ...order,
          items: [
            { component: 'redCells', quantity: 1 },
            { component: 'plasma24', quantity: 2 },
          ],
        }}
        t={t}
      />,
    );
    const regular = screen.getByText(t('fr08PackedCells')).closest('li');
    expect(regular).toHaveTextContent(/1$/);
    const other = screen.getByText(`${t('fr08OtherComponent')}: ${t('componentPlasma24')}`).closest('li');
    expect(other).toHaveTextContent(/2$/);
  });
  it('sorts urgency then date and opens every priority from the same inbox', async () => {
    render(<TransfusionsPage api={createMockTransfusionsApi()} />);
    expect(await screen.findAllByRole('button', { name: t('txAttend') })).toHaveLength(10);
    const rows = within(screen.getByRole('table', { name: t('txInbox') })).getAllByRole('row');
    expect(rows[1]).toHaveTextContent('TX-DEMO-0010');
    expect(rows[3]).toHaveTextContent('TX-DEMO-0008');
    expect(rows.find((row) => row.textContent?.includes('TX-DEMO-0003'))).toHaveTextContent('AB POSITIVO (+)');
    expect(within(rows[1]).getByRole('button', { name: t('txAttend') })).toBeEnabled();
    fireEvent.click(within(rows[3]).getByRole('button', { name: t('txAttend') }));
    expect(screen.queryByText(t('txUrgentAuthorizationCheck'))).not.toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: t('close') }));
    fireEvent.change(screen.getByRole('searchbox', { name: t('txSearch') }), { target: { value: 'TX-DEMO-0001' } });
    expect(screen.getAllByRole('button', { name: t('txAttend') })).toHaveLength(1);
    expect(screen.getByRole('button', { name: t('txHistory') }).querySelector('svg')).toBeTruthy();
  });
  it('toggles one inbox status card at a time and keeps the status and priority filters in sync', async () => {
    const api = createMockTransfusionsApi();
    const workspace = await api.list();
    const statuses = ['testing', 'compatible', 'reviewed', 'pending'] as const;
    const requests = statuses.map((status, index) => ({ ...workspace.requests[index], status }));
    render(<TransfusionsPage api={{ ...api, list: async () => ({ ...workspace, requests }) }} />);

    const inbox = within(await screen.findByRole('table', { name: t('txInbox') }));
    const pending = screen.getByRole('button', { name: new RegExp(`${t('txPendingCount')}.*2$`) });
    const testing = screen.getByRole('button', { name: new RegExp(`${t('txTesting')}.*1$`) });
    const ready = screen.getByRole('button', { name: new RegExp(`${t('txReadyCount')}.*1$`) });
    const status = screen.getByRole('combobox', { name: t('status') });
    const priority = screen.getByRole('combobox', { name: t('txPriority') });

    fireEvent.click(testing);
    expect(testing).toHaveAttribute('aria-pressed', 'true');
    expect(status).toHaveValue('txTesting');
    expect(inbox.getAllByRole('row')).toHaveLength(2);
    expect(inbox.getByText('TX-DEMO-0001')).toBeInTheDocument();

    fireEvent.click(ready);
    expect(testing).toHaveAttribute('aria-pressed', 'false');
    expect(ready).toHaveAttribute('aria-pressed', 'true');
    expect(inbox.queryByText('TX-DEMO-0001')).not.toBeInTheDocument();
    expect(inbox.getByText('TX-DEMO-0002')).toBeInTheDocument();
    fireEvent.click(ready);
    expect(ready).toHaveAttribute('aria-pressed', 'false');
    expect(status).toHaveValue('');
    expect(inbox.getAllByRole('row')).toHaveLength(5);

    fireEvent.click(pending);
    expect(inbox.getByText('TX-DEMO-0003')).toBeInTheDocument();
    expect(inbox.getByText('TX-DEMO-0004')).toBeInTheDocument();
    fireEvent.change(priority, { target: { value: 'urgent' } });
    expect(inbox.getAllByRole('row')).toHaveLength(2);
    expect(inbox.getByText('TX-DEMO-0004')).toBeInTheDocument();
    fireEvent.change(status, { target: { value: 'txPending' } });
    expect(pending).toHaveAttribute('aria-pressed', 'false');
    expect(inbox.getByText('TX-DEMO-0004')).toBeInTheDocument();
  });
  it('uses the existing screens to dispatch the very urgent demo and then process and communicate its results', async () => {
    const api = createMockTransfusionsApi();
    const number = 'TX-DEMO-0009';
    const inbox = render(<TransfusionsPage api={api} />);
    fireEvent.click(
      within(await screen.findByRole('row', { name: new RegExp(number) })).getByRole('button', {
        name: t('txAttend'),
      }),
    );
    fireEvent.click(screen.getByRole('checkbox', { name: t('txReviewCheck') }));
    fireEvent.click(screen.getByRole('checkbox', { name: t('txConsentCheck') }));
    fireEvent.click(screen.getByRole('button', { name: t('txContinue') }));
    expect(screen.getByText(t('txUrgentAuthorizationRequired'))).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: t('txUrgentAuthorizationCheck') }));
    fireEvent.click(screen.getByRole('button', { name: t('txContinue') }));
    const printSamples = await screen.findByRole('button', { name: t('txPrintUrgentSamples') });
    vi.mocked(printDocument).mockImplementationOnce((_content, _title, _onError, _css, onPrint) => onPrint?.());
    fireEvent.click(printSamples);
    const specimenLabels = render(vi.mocked(printDocument).mock.lastCall?.[0]);
    expect(specimenLabels.container.querySelectorAll('[data-label]')).toHaveLength(2);
    expect(specimenLabels.container).toHaveTextContent(`M-REC-${number}-S`);
    specimenLabels.unmount();
    expect(screen.getByRole('button', { name: t('txContinue') })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: t('txUrgentSamplesCheck') }));
    fireEvent.click(screen.getByRole('button', { name: t('txContinue') }));
    const candidates = within(await screen.findByRole('table', { name: t('txCandidates') }));
    expect(candidates.queryByText(code(11))).not.toBeInTheDocument();
    for (const unit of [1, 6, 13]) {
      const row = within(candidates.getByRole('row', { name: new RegExp(code(unit)) }));
      fireEvent.click(row.getByRole('button'));
    }
    fireEvent.click(screen.getByRole('checkbox', { name: t('txSelectionCheck') }));
    fireEvent.click(screen.getByRole('button', { name: t('txContinue') }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: t('txConfirmAssignment') })).getByRole('button', {
        name: t('txConfirm'),
      }),
    );
    fireEvent.change(screen.getByRole('searchbox', { name: t('txSearch') }), { target: { value: number } });
    const ready = await screen.findByRole('row', { name: new RegExp(t('txReadyUrgent')) });
    const beforeDispatch = render(<CompatibilityPage api={api} />);
    expect(await within(beforeDispatch.container).findByText(t('txNoPendingTests'))).toBeInTheDocument();
    beforeDispatch.unmount();

    fireEvent.click(within(ready).getByRole('button', { name: t('txDeliver') }));
    expect(screen.queryByRole('button', { name: t('txPrintResults') })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: t('txPrintUrgentReleaseLabels') }));
    const dispatchLabels = render(vi.mocked(printDocument).mock.lastCall?.[0]);
    expect(dispatchLabels.container.querySelectorAll('[data-label]')).toHaveLength(2);
    expect(dispatchLabels.container).toHaveTextContent(t('txUrgentReleaseLabel'));
    dispatchLabels.unmount();
    fireEvent.click(screen.getByRole('button', { name: t('txContinue') }));
    fireEvent.change(screen.getByLabelText(t('txCollector')), { target: { value: 'Recepción DEMO' } });
    fireEvent.change(screen.getByLabelText(t('txCollectorDocument')), { target: { value: '90000999' } });
    fireEvent.click(screen.getByRole('checkbox', { name: t('txUrgentReleaseCheck') }));
    fireEvent.click(screen.getByRole('checkbox', { name: t('txUrgentLabelsCheck') }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: t('txDeliver') }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: t('txConfirmDelivery') })).getByRole('button', {
        name: t('txConfirm'),
      }),
    );
    await waitFor(async () => expect((await api.list()).bookEntries).toHaveLength(3));
    inbox.unmount();

    render(<CompatibilityPage api={api} />);
    fireEvent.click(await screen.findByRole('button', { name: t('txProcessTests') }));
    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByText(`M-REC-${number}-S`)).toBeInTheDocument();
    vi.mocked(printDocument).mockImplementationOnce((_content, _title, _onError, _css, onPrint) => onPrint?.());
    fireEvent.click(dialog.getByRole('button', { name: t('txPrintLabels') }));
    fireEvent.click(dialog.getByRole('checkbox', { name: t('txLabIdentity') }));
    fireEvent.click(dialog.getByRole('checkbox', { name: t('txPretransfusionCheck') }));
    fireEvent.click(
      within(dialog.getByRole('group', { name: `${t('txResult')} ${code(1)}` })).getByRole('radio', {
        name: t('txCompatible'),
      }),
    );
    fireEvent.click(
      within(dialog.getByRole('group', { name: `${t('txResult')} ${code(6)}` })).getByRole('radio', {
        name: t('txIncompatible'),
      }),
    );
    fireEvent.click(dialog.getByRole('button', { name: t('txRegisterResults') }));
    const results = within(screen.getByRole('dialog', { name: t('txConfirmResults') }));
    expect(results.getByText(t('txPostDispatchIncompatible'))).toBeInTheDocument();
    fireEvent.click(results.getByRole('button', { name: t('txConfirm') }));
    fireEvent.click(await screen.findByRole('button', { name: t('txRegisterCommunication') }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: t('txConfirm') }));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: t('txRegisterCommunication') })).not.toBeInTheDocument(),
    );
  });
  it('uses the existing inbox and workflow for an issued order without duplicating its row', async () => {
    const api = createMockTransfusionsApi();
    const { order } = (await api.list()).requests[0];
    const config = {
      orderTypeUuid: 'fr08-type',
      conceptUuid: 'fr08-concept',
      encounterTypeUuid: 'fr08-encounter-type',
      careSettingUuid: 'care-setting',
      historyIdentifierTypeUuid: 'history-type',
      documentIdentifierTypeUuids: [],
    };
    const issued = {
      uuid: 'fr08-order',
      orderNumber: 'ORD-42',
      dateActivated: order.requestedAt,
      fulfillerStatus: null,
      concept: { uuid: config.conceptUuid },
      orderType: { uuid: config.orderTypeUuid },
      patient: { uuid: order.patientId },
      encounter: { uuid: order.encounterId },
      orderer: { display: order.orderer },
      instructions: JSON.stringify({ format: 'EG05-FR08/v1', request: order }),
    };
    let registered = false;
    vi.mocked(openmrsFetch).mockImplementation(async (url, options) => {
      if (options?.method === 'POST') registered = true;
      const backendOrder = { ...issued, fulfillerStatus: registered ? 'RECEIVED' : null };
      return {
        data: String(url).includes('/order?') ? { results: [backendOrder] } : backendOrder,
      } as FetchResponse<unknown>;
    });
    render(<TransfusionsPage api={api} orderConfig={config} />);

    const row = await screen.findByRole('row', { name: /ORD-42/ });
    expect(screen.getAllByRole('table')).toHaveLength(1);
    fireEvent.change(screen.getByRole('combobox', { name: 'Registros por página' }), { target: { value: '20' } });
    expect(screen.getByRole('row', { name: /TX-DEMO-0001/ })).toBeInTheDocument();
    const inbox = screen.getByRole('table', { name: t('txInbox') });
    const pending = screen.getByRole('button', { name: new RegExp(`${t('txPendingCount')}.*11$`) });
    fireEvent.click(pending);
    expect(within(inbox).getByText('ORD-42')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox', { name: t('txSearch') }), { target: { value: 'ORD-42' } });
    expect(within(inbox).getAllByRole('row')).toHaveLength(2);

    expect(within(row).queryByRole('button', { name: t('fr08Open') })).not.toBeInTheDocument();
    fireEvent.click(within(row).getByRole('button', { name: t('txAttend') }));
    expect(await screen.findByRole('dialog', { name: /ORD-42/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('fr08Receive') })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: t('fr08PrintForm') }));
    expect(printDocument).toHaveBeenCalled();
    expect(registered).toBe(false);
    fireEvent.click(screen.getByRole('checkbox', { name: t('txReviewCheck') }));
    fireEvent.click(screen.getByRole('checkbox', { name: t('txConsentCheck') }));
    expect(screen.getByRole('button', { name: t('txContinue') })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: t('fr08Receive') }));
    expect(await screen.findByText(t('fr08ReceiptRegistered'))).toBeInTheDocument();
    expect(openmrsFetch).toHaveBeenCalledWith(
      '/ws/rest/v1/order/fr08-order/fulfillerdetails/',
      expect.objectContaining({ method: 'POST', body: { fulfillerStatus: 'RECEIVED' } }),
    );
    fireEvent.click(screen.getByRole('button', { name: t('txContinue') }));
    expect(await screen.findByRole('button', { name: t('txPrintSample') })).toBeInTheDocument();
    expect((await api.list()).requests.find((request) => request.id === issued.uuid)?.receivedAt).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('row', { name: /ORD-42/ })).toHaveTextContent(t('txReviewed')));
    expect(within(screen.getByRole('table', { name: t('txInbox') })).getAllByRole('row')).toHaveLength(2);
  });
  it('reviews the received order and history, prints without registering, then registers the sample on Continue', async () => {
    const api = createMockTransfusionsApi();
    const request = (await api.list()).requests[0];
    render(<TransfusionWorkflow initial={request} api={api} units={[]} onSaved={vi.fn()} onClose={vi.fn()} t={t} />);
    expect(
      screen.getByRole('dialog', { name: `${t('txRequestTitle')} · ${request.order.number}` }),
    ).toBeInTheDocument();
    expect(screen.getByText('UNIDAD-PASADA-DEMO')).toBeInTheDocument();
    const requested = screen.getByRole('region', { name: t('txRequirement') });
    expect(within(requested).getAllByRole('listitem')).toHaveLength(2);
    expect(within(requested).getByText('×2')).toBeInTheDocument();
    expect(within(requested).getAllByText('O POSITIVO (+)')).toHaveLength(2);
    expect(requested).not.toHaveTextContent('ABO/Rh');
    expect(screen.getByLabelText(t('txReviewer'))).toHaveValue('Rosa Calderón');
    expect(screen.getByLabelText(t('txReviewer'))).toHaveAttribute('readonly');
    fireEvent.click(screen.getByRole('checkbox', { name: t('txReviewCheck') }));
    fireEvent.click(screen.getByRole('checkbox', { name: t('txConsentCheck') }));
    fireEvent.click(screen.getByRole('button', { name: t('txContinue') }));
    const print = await screen.findByRole('button', { name: t('txPrintSample') });
    expect(screen.getByRole('button', { name: t('txContinue') })).toBeDisabled();
    expect(screen.getByLabelText(t('txRecipientName'))).toHaveValue(request.order.patientName);
    expect(screen.getByLabelText(t('txCollectedBy'))).toHaveValue('Rosa Calderón');
    vi.mocked(printDocument).mockImplementationOnce((_content, _title, onError) => onError?.());
    fireEvent.click(print);
    expect(screen.getByRole('button', { name: t('txContinue') })).toBeDisabled();
    vi.mocked(printDocument).mockImplementationOnce((_content, _title, _onError, _css, onPrint) => onPrint?.());
    fireEvent.click(print);
    expect(printDocument).toHaveBeenCalledTimes(2);
    expect((await api.list()).requests[0].sample).toBeNull();
    expect(screen.getByLabelText(t('sampleCode'))).toHaveAttribute('readonly');
    fireEvent.click(screen.getByRole('button', { name: t('txContinue') }));
    expect(await screen.findByRole('table', { name: t('txCandidates') })).toBeInTheDocument();
    const saved = (await api.list()).requests[0];
    expect(saved.sample?.collectedBy).toBe('Rosa Calderón');
    expect(saved.sample?.printRequestedAt).toBe(saved.sample?.collectedAt);
    expect(saved.draft.reviewer).toBe('Rosa Calderón');
  });
  it('moves candidate units in both directions before committing a selection', async () => {
    const { request, units } = await prepared();
    function Picker() {
      const [value, setValue] = useState(request);
      return (
        <TransfusionUnitPicker
          request={value}
          units={units}
          busy={false}
          onChange={(ids) => setValue({ ...value, draft: { ...value.draft, selectedUnitIds: ids } })}
          t={t}
        />
      );
    }
    render(<Picker />);
    const left = screen.getByRole('table', { name: t('txCandidates') });
    fireEvent.click(within(left).getByRole('button', { name: t('txAddUnit', { unit: code(1) }) }));
    const right = screen.getByRole('table', { name: t('txAssigned') });
    expect(within(right).getAllByRole('columnheader')[0]).toHaveTextContent('Acción');
    expect(within(right).getByText(code(1))).toBeInTheDocument();
    const cards = screen.getByRole('region', { name: t('txRequirement') });
    const redCells = within(cards).getAllByRole('listitem')[0];
    expect(redCells).toHaveTextContent('×1');
    fireEvent.click(within(left).getByRole('button', { name: t('txAddUnit', { unit: code(2) }) }));
    expect(redCells).toHaveAttribute('data-complete', 'true');
    fireEvent.click(within(right).getByRole('button', { name: t('txReturnUnit', { unit: code(1) }) }));
    expect(redCells).not.toHaveAttribute('data-complete');
    expect(within(right).queryByText(code(1))).not.toBeInTheDocument();
    expect(within(left).getByText(code(1))).toBeInTheDocument();
    const [redCellFilter, plasmaFilter] = within(cards).getAllByRole('radio');
    fireEvent.click(redCellFilter);
    expect(redCellFilter).toBeChecked();
    expect(within(left).queryByText(code(11))).not.toBeInTheDocument();
    expect(within(right).getByText(code(2))).toBeInTheDocument();
    fireEvent.click(plasmaFilter);
    expect(plasmaFilter).toBeChecked();
    expect(redCellFilter).not.toBeChecked();
    expect(within(left).getByText(code(11))).toBeInTheDocument();
    expect(within(left).queryByText(code(1))).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox', { name: t('txSearchUnits') }), { target: { value: 'AB+' } });
    expect(within(left).queryByText(code(11))).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: t('clearFilters') }));
    expect(plasmaFilter).not.toBeChecked();
    expect(screen.getByRole('searchbox', { name: t('txSearchUnits') })).toHaveValue('');
    expect(within(left).getByText(code(1))).toBeInTheDocument();
    expect(within(left).getByText(code(11))).toBeInTheDocument();
    expect(within(right).getByText(code(2))).toBeInTheDocument();
  });
  it('renders every candidate without pagination and uses accessible icon-only move buttons', async () => {
    const { request, units } = await prepared();
    const source = units.find((unit) => unit.id === code(1));
    if (!source) throw new Error('MISSING_FIXTURE');
    const additional = Array.from({ length: 12 }, (_, index) => ({
      ...source,
      id: `BB-UI-DEMO-${index}`,
    }));
    render(
      <TransfusionUnitPicker
        request={request}
        units={[...units, ...additional]}
        busy={false}
        onChange={vi.fn()}
        t={t}
      />,
    );
    const table = screen.getByRole('table', { name: t('txCandidates') });
    expect(within(table).getAllByRole('button')).toHaveLength(21);
    expect(within(table).queryByRole('checkbox')).not.toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'ABO/Rh' })).toBeInTheDocument();
    expect(within(table).getAllByText('O POSITIVO (+)')).toHaveLength(17);
    expect(within(table).getByText('O NEGATIVO (-)')).toBeInTheDocument();
    expect(within(table).getByText('BB-UI-DEMO-11')).toBeInTheDocument();
    expect(screen.queryByText(t('itemsPerPage'))).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    const button = within(table).getByRole('button', { name: t('txAddUnit', { unit: code(1) }) });
    expect(button).toHaveClass('cds--btn--icon-only');
    expect(button.querySelector('svg')).toBeTruthy();
    expect(button.textContent?.trim()).toBe('');
    expect(screen.getByText(t('txCandidateHelp'))).not.toHaveTextContent(/prototipo|prototype/i);
  });
  it('links one recipient to the unit samples and registers the selected results under the session operator', async () => {
    const { api, request } = await assigned();
    const closed = vi.fn();
    const round = request.rounds[0];
    render(
      <CompatibilityWorkflow
        initial={request}
        initialRound={round}
        api={api}
        onClose={closed}
        onSaved={vi.fn()}
        t={t}
      />,
    );
    expect(screen.getByRole('button', { name: t('txRegisterResults') })).toBeDisabled();
    expect(screen.getAllByRole('group')).toHaveLength(2);
    const workflow = screen.getByRole('dialog', {
      name: `${t('txCompatibilityWorkflowTitle')}: ${round.id}`,
    });
    const modal = within(workflow);
    expect(modal.getAllByText(t('txCompatibilityPairs'), { exact: true })).toHaveLength(1);
    expect(workflow.querySelectorAll('svg[data-sample-icon="test-tube"]')).toHaveLength(3);
    const operator = modal.getByLabelText(t('txTestedBy'));
    expect(operator).toHaveValue('Rosa Calderón');
    expect(operator).toHaveAttribute('readonly');
    const recipientCard = within(modal.getByRole('region', { name: t('txRecipientSample') }));
    expect(recipientCard.getByText(t('sampleCode')).nextElementSibling).toHaveTextContent(round.sample.code);
    expect(recipientCard.getByText(t('txSampleHistoryNumber')).nextElementSibling).toHaveTextContent(
      round.sample.historyNumber,
    );
    const unitCard = within(modal.getAllByRole('region', { name: t('txUnitSample') })[0]);
    expect(unitCard.getByText(t('unitCode')).nextElementSibling).toHaveTextContent(code(1));
    expect(unitCard.getByText(t('txReportBloodGroup')).nextElementSibling).toHaveTextContent('O POSITIVO (+)');
    const printLabels = modal.getByRole('button', { name: t('txPrintLabels') });
    const radios = modal.getAllByRole('radio');
    for (const radio of radios) expect(radio).toBeDisabled();
    vi.mocked(printDocument).mockImplementationOnce((_content, _title, onError) => onError?.());
    fireEvent.click(printLabels);
    for (const radio of radios) expect(radio).toBeDisabled();
    vi.mocked(printDocument).mockImplementationOnce((_content, _title, _onError, _css, onPrint) => onPrint?.());
    fireEvent.click(printLabels);
    for (const radio of radios) expect(radio).toBeEnabled();
    const [content, , , css] = vi.mocked(printDocument).mock.calls[1];
    expect(css).toBe(compatibilityLabelPrintCss);
    const labels = render(content);
    expect(labels.container.querySelectorAll('[data-label]')).toHaveLength(2);
    expect(labels.container).not.toHaveTextContent(round.sample.code);
    for (const item of request.assignments.filter((assignment) => assignment.roundId === round.id)) {
      expect(labels.container).toHaveTextContent(item.unitSampleCode ?? '');
    }
    labels.unmount();
    fireEvent.click(screen.getByRole('checkbox', { name: t('txLabIdentity') }));
    fireEvent.click(screen.getByRole('checkbox', { name: t('txPretransfusionCheck') }));
    const firstResult = within(unitCard.getByRole('group', { name: `${t('txResult')} ${code(1)}` }));
    const compatibleOption = firstResult.getByRole('radio', { name: t('txCompatible') });
    const incompatibleOption = firstResult.getByRole('radio', { name: t('txIncompatible') });
    fireEvent.click(incompatibleOption);
    expect(incompatibleOption).toBeChecked();
    fireEvent.click(compatibleOption);
    expect(compatibleOption).toBeChecked();
    expect(incompatibleOption).not.toBeChecked();
    expect(screen.getByRole('button', { name: t('txRegisterResults') })).toBeDisabled();
    fireEvent.click(
      within(screen.getByRole('group', { name: `${t('txResult')} ${code(2)}` })).getByRole('radio', {
        name: t('txIncompatible'),
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: t('txRegisterResults') }));
    const confirmation = screen.getByRole('dialog', { name: t('txConfirmResults') });
    expect(within(confirmation).getByText(t('txResultsWarningIncompatible'))).toBeInTheDocument();
    expect(within(confirmation).getAllByRole('listitem')).toHaveLength(2);
    expect(confirmation.querySelector('svg[data-warning-icon]')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: t('txConfirm') }));
    await waitFor(() => expect(closed).toHaveBeenCalledOnce());
    const saved = (await api.list()).requests[0];
    expect(saved.status).toBe('incompatible');
    expect(saved.rounds[0].operator).toBe('Rosa Calderón');
    expect(saved.rounds[0].labelsPrintRequestedAt).toBeTruthy();
    expect(saved.assignments[0]).toMatchObject({ result: 'compatible', testedBy: 'Rosa Calderón' });
  });
  it('prints results before handover and commits stock and book only after pickup confirmation', async () => {
    const { api, request, units } = await compatible();
    const closed = vi.fn();
    render(<TransfusionWorkflow initial={request} units={units} api={api} onSaved={vi.fn()} onClose={closed} t={t} />);
    const cards = screen.getByRole('region', { name: t('txRequirement') });
    expect(cards.previousElementSibling).toHaveTextContent(t('txRequestDetails'));
    expect(cards.nextElementSibling).toHaveTextContent(t('txPatientHistory'));
    expect(within(cards).getByText('×2')).toBeInTheDocument();
    expect(screen.getByText(t('txAttendedBy')).nextElementSibling).toHaveTextContent('Atención DEMO');
    fireEvent.click(screen.getByRole('button', { name: t('txPrintResults') }));
    expect(printDocument).toHaveBeenCalledOnce();
    const [content, title, , css] = vi.mocked(printDocument).mock.calls[0];
    expect(title).toBe(t('txCompatibilityReport'));
    expect(css).toBe(compatibilityReportPrintCss);
    expect(css).toContain('@top-left { content: ""; }');
    expect(css).toContain('@top-right { content: ""; }');
    expect(css).toContain('@bottom-left { content: ""; }');
    expect(css).toContain('@bottom-right { content: ""; }');
    const printed = render(content);
    const report = within(printed.container);
    expect(report.getByRole('img', { name: t('certificateHospital') })).toBeInTheDocument();
    expect(report.getByText(t('txReportRequestNumber')).nextElementSibling).toHaveTextContent(request.order.number);
    expect(report.getByText(t('txReportBloodGroup')).nextElementSibling).toHaveTextContent('O POSITIVO (+)');
    expect(report.getByText(t('txSamplePatientName')).nextElementSibling).toHaveTextContent(request.order.patientName);
    expect(report.getByText(t('txSampleHistoryNumber')).nextElementSibling).toHaveTextContent(
      request.order.historyNumber,
    );
    expect(printed.container.querySelector('[data-demo]')).toBeNull();
    const results = within(report.getByRole('table', { name: t('txCompatibilityReport') }));
    const unit = request.assignments[0];
    const cells = within(results.getByRole('row', { name: new RegExp(unit.unit.id) })).getAllByRole('cell');
    expect(cells[0].textContent).toBe(unit.unit.id);
    expect(cells[3].textContent).toBe(unit.unitSampleCode);
    expect(results.getByText(t('txNotRequired'))).toBeInTheDocument();
    expect(report.getByRole('table', { name: t('txReportTraceability') })).toBeInTheDocument();
    expect(report.queryByText(t('txAttendedBy'))).not.toBeInTheDocument();
    expect(report.queryByText(t('txDeliveredBy'))).not.toBeInTheDocument();
    printed.unmount();
    expect((await api.list()).bookEntries).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: t('txContinue') }));
    fireEvent.change(screen.getByLabelText(t('txCollector')), { target: { value: 'Recepción DEMO' } });
    const document = screen.getByLabelText(t('txCollectorDocument'));
    fireEvent.change(document, { target: { value: 'a9000b0999cc2' } });
    expect(document).toHaveValue('90000999');
    expect(document).toHaveAttribute('inputmode', 'numeric');
    expect(document).toHaveAttribute('maxlength', '8');
    const deliveredBy = screen.getByLabelText(t('txDeliveredBy'));
    expect(deliveredBy).toHaveValue('Rosa Calderón');
    expect(deliveredBy).toHaveAttribute('readonly');
    fireEvent.click(screen.getByRole('checkbox', { name: t('txReleaseCheck') }));
    fireEvent.click(screen.getByRole('button', { name: t('txDeliver') }));
    expect(screen.getByText(t('txDeliveryWarning'))).toBeInTheDocument();
    const confirmation = screen.getByRole('dialog', { name: t('txConfirmDelivery') });
    expect(within(confirmation).getByText(t('txDeliveryBookEffect'))).toBeInTheDocument();
    expect(within(confirmation).getByText(t('txDeliveryRequestEffect'))).toBeInTheDocument();
    expect(confirmation.querySelector('svg[data-warning-icon]')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: t('txConfirm') }));
    await waitFor(() => expect(closed).toHaveBeenCalledOnce());
    const delivered = await api.list();
    expect(delivered.bookEntries).toHaveLength(3);
    expect(delivered.bookEntries.every((entry) => entry.attendedBy === 'Rosa Calderón')).toBe(true);
    expect(delivered.requests[0].draft.deliveredBy).toBe('Rosa Calderón');
  });
  it('shows cards and report results when reviewing tests and blocks printing while rounds are pending', async () => {
    const { api, request, units } = await assigned();
    const round = {
      ...request.rounds[0],
      operator: 'Laboratorio DEMO',
      identityVerified: true,
      pretransfusionVerified: true,
      results: { [code(1)]: 'compatible', [code(2)]: 'incompatible' } as const,
    };
    const draft = await api.saveCompatibility(request.id, request.revision, round, false);
    const view = render(
      <TransfusionWorkflow initial={draft} units={units} api={api} onSaved={vi.fn()} onClose={vi.fn()} t={t} />,
    );
    const cards = screen.getByRole('region', { name: t('txRequirement') });
    expect(cards.previousElementSibling).toHaveTextContent(t('txRequestDetails'));
    expect(cards.nextElementSibling).toHaveTextContent(t('txPatientHistory'));
    expect(screen.getByText(t('txReportPendingPrint'))).toBeInTheDocument();
    const printButton = screen.getByRole('button', { name: t('txPrintResults') });
    expect(printButton).toBeDisabled();
    fireEvent.click(printButton);
    expect(printDocument).not.toHaveBeenCalled();
    view.unmount();

    const rejected = await api.saveCompatibility(draft.id, draft.revision, round, true);
    const review = render(
      <TransfusionWorkflow initial={rejected} units={units} api={api} onSaved={vi.fn()} onClose={vi.fn()} t={t} />,
    );
    expect(screen.getByText(t('status'), { exact: true }).nextElementSibling).toHaveTextContent('Incompatible');
    const requested = screen.getByRole('region', { name: t('txRequirement') });
    expect(requested.previousElementSibling).toHaveTextContent(t('txRequestDetails'));
    expect(requested.nextElementSibling).toHaveTextContent(t('txPatientHistory'));
    expect(within(requested).getByText('×2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: t('txPrintResults') }));
    expect(printDocument).toHaveBeenCalledOnce();
    const printed = render(vi.mocked(printDocument).mock.calls[0][0]);
    const results = within(printed.container).getByRole('table', { name: t('txCompatibilityReport') });
    const unitResult = within(results).getByRole('row', { name: new RegExp(code(2)) });
    expect(within(unitResult).getByRole('cell', { name: /^Incompatible$/ })).toBeInTheDocument();
    expect(unitResult).not.toHaveTextContent('Retirada de la asignación');
    printed.unmount();
    review.unmount();
    vi.mocked(printDocument).mockClear();

    const replacement = await api.assign(rejected.id, rejected.revision, [code(3)], true);
    render(<TransfusionHistory requests={[replacement]} onClose={vi.fn()} t={t} compatibility />);
    fireEvent.click(screen.getByRole('button', { name: t('txViewDetail') }));
    const historyPrintButton = screen.getByRole('button', { name: t('txPrintResults') });
    expect(historyPrintButton).toBeDisabled();
    expect(screen.getByText(t('txReportPendingPrint'))).toBeInTheDocument();
    fireEvent.click(historyPrintButton);
    expect(printDocument).not.toHaveBeenCalled();
  });
  it('uses the shared exit dialog to save a draft without creating a sample', async () => {
    const api = createMockTransfusionsApi();
    const request = (await api.list()).requests[0];
    const closed = vi.fn();
    render(<TransfusionWorkflow initial={request} units={[]} api={api} onSaved={vi.fn()} onClose={closed} t={t} />);
    fireEvent.click(screen.getByRole('checkbox', { name: t('txReviewCheck') }));
    fireEvent.click(screen.getByRole('button', { name: t('close') }));
    const exit = screen.getByRole('dialog', { name: t('exitTitle') });
    expect(within(exit).getByRole('button', { name: t('keepEditing') })).toBeEnabled();
    fireEvent.click(within(exit).getByRole('button', { name: new RegExp(`${t('leave')}$`) }));
    await waitFor(() => expect(closed).toHaveBeenCalledOnce());
    expect((await api.list()).requests[0].sample).toBeNull();
    expect((await api.list()).requests[0].draft.reviewer).toBe('Rosa Calderón');
    expect((await api.list()).requests[0].draft.reviewVerified).toBe(true);
  });
  it('renders secure failure and retry in both entry points when backend capability is missing', async () => {
    const page = render(<TransfusionsPage api={openmrsTransfusionsApi} />);
    expect(await screen.findByText(t('loadFailed'))).toBeInTheDocument();
    expect(screen.queryByText('TRANSFUSION_BACKEND_NOT_IMPLEMENTED')).not.toBeInTheDocument();
    page.unmount();
    render(<CompatibilityPage api={openmrsTransfusionsApi} />);
    expect(await screen.findByRole('button', { name: t('retry') })).toBeEnabled();
  });
  it('opens the book independently, filters by component and delivery date, and prints history handover details', async () => {
    const { api, request } = await compatible();
    const queueView = render(<TransfusionsPage api={api} />);
    const inbox = within(await screen.findByRole('table', { name: t('txInbox') }));
    const ready = inbox.getByRole('row', { name: new RegExp(request.order.number) });
    expect(within(ready).getByRole('button', { name: t('txDeliver') })).toBeEnabled();
    queueView.unmount();
    const completed = await api.deliver(request.id, request.revision, {
      ...request.draft,
      collectorName: 'Recepción DEMO',
      collectorDocument: '90000999',
      deliveredBy: 'Entrega DEMO',
      releaseVerified: true,
    });
    const historyView = render(<TransfusionsPage api={api} />);
    await screen.findByRole('table', { name: t('txInbox') });
    fireEvent.click(screen.getByRole('button', { name: t('txBook') }));
    const book = within(screen.getByRole('dialog', { name: t('txBook') }));
    const table = within(book.getByRole('table', { name: t('txBook') }));
    expect(book.getAllByRole('button', { name: t('close') })).toHaveLength(1);
    expect(table.getAllByRole('row')).toHaveLength(4);
    expect(table.getByRole('columnheader', { name: t('fractionationComponent') })).toBeInTheDocument();
    fireEvent.change(book.getByRole('searchbox'), { target: { value: 'plasma' } });
    expect(table.getAllByRole('row')).toHaveLength(2);
    fireEvent.change(book.getByLabelText(t('txDateFrom')), { target: { value: '2099-01-01' } });
    expect(table.getAllByRole('row')).toHaveLength(1);
    fireEvent.click(book.getByRole('button', { name: t('close') }));
    fireEvent.click(screen.getByRole('button', { name: t('txHistory') }));
    fireEvent.click(screen.getByRole('button', { name: t('txViewDetail') }));
    expect(within(screen.getByRole('region', { name: t('txRequirement') })).getByText('×2')).toBeInTheDocument();
    expect(screen.getByText(t('txAttendedBy')).nextElementSibling).toHaveTextContent('Atención DEMO ·');
    expect(screen.getByText(t('txDeliveredBy')).nextElementSibling).toHaveTextContent('Entrega DEMO ·');
    fireEvent.click(screen.getByRole('button', { name: t('txPrintResults') }));
    const printedContent = vi.mocked(printDocument).mock.calls[0][0];
    historyView.unmount();
    render(printedContent);
    expect(screen.getByRole('region', { name: t('txRequirement') })).toBeInTheDocument();
    expect(screen.getByText(t('txAttendedBy')).nextElementSibling).toHaveTextContent('Atención DEMO ·');
    expect(screen.getByText(t('txDeliveredBy')).nextElementSibling).toHaveTextContent('Entrega DEMO ·');
    expect(completed.order.history).toHaveLength(1);
  });
  it('escapes label text, preserves two recipient identifiers and keeps English/Spanish parity', async () => {
    const request = (await createMockTransfusionsApi().list()).requests[0];
    request.order.patientName = '<script>unsafe()</script>';
    const view = render(<TransfusionLabels request={request} sample={request.draft.sample} t={t} />);
    expect(view.container.querySelector('script')).toBeNull();
    expect(view.container.textContent).toContain(request.order.patientName);
    expect(view.container.textContent).toContain(request.order.historyNumber);
    expect(view.container.querySelector('[data-demo]')).toBeNull();
    expect(screen.getByRole('img', { name: t('certificateHospital') })).toBeInTheDocument();
    expect(view.container).toHaveTextContent(`Nombre del paciente: ${request.order.patientName}`);
    expect(view.container).toHaveTextContent(`Número de historia clínica: ${request.order.historyNumber}`);
    expect(view.container).toHaveTextContent('ABO/Rh: O POSITIVO (+)');
    expect(Object.keys(spanish.transfusion).sort()).toEqual(Object.keys(english.transfusion).sort());
  });
  it('uses the sidebar compatibility symbol for its enlarged decorative page illustration', () => {
    const page = render(<BloodBankPageIllustration section="compatibility" />);
    const large = page.container.querySelector('svg');
    expect(large).toHaveAttribute('width', '64');
    expect(large?.parentElement).toHaveAttribute('aria-hidden', 'true');
    const sidebar = render(<IbmDevopsTest size={20} />);
    expect(large?.innerHTML).toBe(sidebar.container.querySelector('svg')?.innerHTML);
  });
  it('renders described warnings with a triangle, compact actions and current save-time closing guards', () => {
    const cancelled = vi.fn(),
      confirmed = vi.fn();
    const props = {
      title: t('txConfirmAssignment'),
      description: t('txAssignWarning'),
      items: [t('txAssignTestsEffect')],
      note: t('txNoAdministration'),
      cancelLabel: t('keepEditing'),
      confirmLabel: t('txConfirm'),
      closeLabel: t('close'),
      saving: false,
      onCancel: cancelled,
      onConfirm: confirmed,
    };
    const view = render(<WarningConfirmation {...props} />);
    const warning = screen.getByRole('dialog', { name: t('txConfirmAssignment') });
    expect(document.getElementById(warning.getAttribute('aria-describedby') ?? '')).toHaveTextContent(
      t('txAssignTestsEffect'),
    );
    expect(warning.querySelector('svg[data-warning-icon]')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('button', { name: t('keepEditing') })).toHaveAttribute('data-modal-primary-focus');
    const submit = screen.getByRole('button', { name: t('txConfirm') });
    expect(submit).toHaveClass('cds--btn--sm');
    fireEvent.click(submit);
    expect(confirmed).toHaveBeenCalledOnce();
    view.rerender(<WarningConfirmation {...props} saving />);
    expect(submit).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: t('close') }));
    expect(cancelled).not.toHaveBeenCalled();
    view.rerender(<WarningConfirmation {...props} />);
    fireEvent.click(screen.getByRole('button', { name: t('close') }));
    expect(cancelled).toHaveBeenCalledOnce();
  });
  it('shows only relevant assignment effects for plasma and does not reserve before confirmation', async () => {
    const api = createMockTransfusionsApi();
    const initial = (await api.list()).requests[2];
    const reviewed = await api.review(initial.id, initial.revision, {
      ...initial.draft,
      reviewer: 'Responsable DEMO',
      reviewVerified: true,
      consentVerified: true,
    });
    const collectedAt = localDateTime();
    const request = await api.saveSample(reviewed.id, reviewed.revision, {
      ...reviewed.draft.sample,
      collectedBy: 'Extracción DEMO',
      collectedAt,
      printRequestedAt: collectedAt,
    });
    request.draft.selectedUnitIds = [code(13)];
    request.draft.selectionVerified = true;
    const selection = render(
      <TransfusionWorkflow
        initial={request}
        units={(await api.list()).units}
        api={api}
        onSaved={vi.fn()}
        onClose={vi.fn()}
        t={t}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: t('txContinue') }));
    const warning = screen.getByRole('dialog', { name: t('txConfirmAssignment') });
    expect(within(warning).getByText(t('txAssignReserveEffect'))).toBeInTheDocument();
    expect(within(warning).getByText('Esta acción no representa una transfusión para el paciente')).toBeInTheDocument();
    expect(within(warning).queryByText(t('txAssignTestsEffect'))).not.toBeInTheDocument();
    expect((await api.list()).units.find((unit) => unit.id === code(13))?.status).toBe('APTO');
    expect((await api.list()).requests[2].status).toBe('sampleReady');
    fireEvent.click(within(warning).getByRole('button', { name: t('txConfirm') }));
    await waitFor(async () => expect((await api.list()).requests[2].status).toBe('compatible'));
    selection.unmount();
    const workspace = await api.list();
    render(
      <TransfusionWorkflow
        initial={workspace.requests[2]}
        units={workspace.units}
        api={api}
        onSaved={vi.fn()}
        onClose={vi.fn()}
        t={t}
      />,
    );
    expect(screen.getByRole('button', { name: t('txPrintResults') })).toBeDisabled();
    expect(screen.getByText(t('txNotRequired'))).toBeInTheDocument();
  });
});
