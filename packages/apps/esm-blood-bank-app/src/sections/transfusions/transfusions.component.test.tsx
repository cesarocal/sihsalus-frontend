import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { IbmDevopsTest } from '@carbon/react/icons';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import english from '../../../translations/en.json';
import spanish from '../../../translations/es.json';
import { createMockTransfusionsApi } from '../../api/mock-transfusions.api';
import { openmrsTransfusionsApi } from '../../api/transfusions.api';
import { printDocument } from '../../shared/print-document';
import { BloodBankPageIllustration } from '../../shared/blood-bank-page-illustration.component';
import { WarningConfirmation } from '../../shared/warning-confirmation.component';
import { CompatibilityPage } from '../laboratory/compatibility/compatibility-page.component';
import { CompatibilityWorkflow } from '../laboratory/compatibility/compatibility-workflow.component';
import { localDateTime } from '../laboratory/screening/screening-rules';
import { TransfusionHistory } from './transfusion-history.component';
import { TransfusionLabels } from './transfusion-print.component';
import { TransfusionUnitPicker } from './transfusion-unit-picker.component';
import { TransfusionWorkflow } from './transfusion-workflow.component';
import { TransfusionsPage } from './transfusions-page.component';

vi.mock('@openmrs/esm-framework', () => ({
  useSession: () => ({ sessionLocation: { display: 'Hospital DEMO' } }),
  formatDatetime: () => '16 oct 2026, 12:00',
  showSnackbar: vi.fn(),
  PageHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  PageHeaderContent: ({ title }: { title: string }) => <div>{title}</div>,
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }) }));
vi.mock('../../shared/print-document', () => ({ printDocument: vi.fn() }));
const t = (key: string) =>
  (spanish.transfusion as Record<string, string>)[key] ?? (spanish.processing as Record<string, string>)[key] ?? key;
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
  const request = await api.saveSample(reviewed.id, reviewed.revision, {
    ...reviewed.draft.sample,
    collectedAt: localDateTime(),
    collectedBy: 'Extracción DEMO',
    identityVerified: true,
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
  });
  it('sorts urgency then date, filters and leaves urgent actions unavailable', async () => {
    render(<TransfusionsPage api={createMockTransfusionsApi()} />);
    expect(await screen.findAllByRole('button', { name: t('txAttend') })).toHaveLength(3);
    const rows = within(screen.getByRole('table', { name: t('txInbox') })).getAllByRole('row');
    expect(rows[1]).toHaveTextContent('TX-DEMO-0004');
    expect(screen.getByRole('button', { name: t('txUrgentPending') })).toBeDisabled();
    fireEvent.change(screen.getByRole('searchbox', { name: t('txSearch') }), { target: { value: 'TX-DEMO-0001' } });
    expect(screen.getAllByRole('button', { name: t('txAttend') })).toHaveLength(1);
    expect(screen.getByRole('button', { name: t('txHistory') }).querySelector('svg')).toBeTruthy();
  });
  it('reviews the received order and history, prints without registering, then registers the sample on Continue', async () => {
    const api = createMockTransfusionsApi();
    const request = (await api.list()).requests[0];
    render(<TransfusionWorkflow initial={request} api={api} units={[]} onSaved={vi.fn()} onClose={vi.fn()} t={t} />);
    expect(
      screen.getByRole('dialog', { name: `${t('txRequestTitle')} · ${request.order.number}` }),
    ).toBeInTheDocument();
    expect(screen.getByText('UNIDAD-PASADA-DEMO')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(t('txReviewer')), { target: { value: 'Responsable DEMO' } });
    fireEvent.click(screen.getByRole('checkbox', { name: t('txReviewCheck') }));
    fireEvent.click(screen.getByRole('checkbox', { name: t('txConsentCheck') }));
    fireEvent.click(screen.getByRole('button', { name: t('txContinue') }));
    fireEvent.click(await screen.findByRole('button', { name: t('txPrintSample') }));
    expect(printDocument).toHaveBeenCalledOnce();
    expect((await api.list()).requests[0].sample).toBeNull();
    expect(screen.getByLabelText(t('sampleCode'))).toHaveAttribute('readonly');
    fireEvent.change(screen.getByLabelText(t('txCollectedBy')), { target: { value: 'Extracción DEMO' } });
    fireEvent.click(screen.getByRole('checkbox', { name: t('txSampleIdentity') }));
    fireEvent.click(screen.getByRole('button', { name: t('txContinue') }));
    expect(await screen.findByRole('table', { name: t('txCandidates') })).toBeInTheDocument();
    expect((await api.list()).requests[0].sample?.collectedBy).toBe('Extracción DEMO');
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
    fireEvent.click(within(left).getByRole('checkbox', { name: `${t('txSelect')} ${code(1)}` }));
    fireEvent.click(screen.getByRole('button', { name: t('txAddUnits') }));
    const right = screen.getByRole('table', { name: t('txAssigned') });
    expect(within(right).getByText(code(1))).toBeInTheDocument();
    fireEvent.click(within(right).getByRole('checkbox', { name: `${t('txSelect')} ${code(1)}` }));
    fireEvent.click(screen.getByRole('button', { name: t('txReturnUnits') }));
    expect(within(right).queryByText(code(1))).not.toBeInTheDocument();
    expect(within(left).getByText(code(1))).toBeInTheDocument();
  });
  it('renders every candidate without pagination and uses accessible icon-only move buttons', async () => {
    const { request, units } = await prepared();
    const source = units.find((unit) => unit.id === code(1));
    if (!source) throw new Error('MISSING_FIXTURE');
    const additional = Array.from({ length: 12 }, (_, index) => ({ ...source, id: `BB-UI-DEMO-${index}` }));
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
    expect(within(table).getAllByRole('checkbox')).toHaveLength(17);
    expect(within(table).getByText('BB-UI-DEMO-11')).toBeInTheDocument();
    expect(screen.queryByText(t('itemsPerPage'))).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    for (const key of ['txAddUnits', 'txReturnUnits']) {
      const button = screen.getByRole('button', { name: t(key) });
      expect(button).toHaveClass('cds--btn--icon-only');
      expect(button.querySelector('svg')).toBeTruthy();
      expect(button.textContent?.trim()).toBe('');
    }
    expect(screen.getByText(t('txCandidateHelp'))).not.toHaveTextContent(/prototipo|prototype/i);
  });
  it('shows one recipient–unit pair per pending red-cell sample and requires all results before confirmation', async () => {
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
      name: `${t('txCompatibilityWorkflowTitle')} · ${request.order.number}`,
    });
    expect(workflow.querySelectorAll('svg[data-sample-icon="test-tube"]')).toHaveLength(4);
    fireEvent.change(screen.getByLabelText(t('txTestedBy')), { target: { value: 'Laboratorio DEMO' } });
    fireEvent.click(screen.getByRole('checkbox', { name: t('txLabIdentity') }));
    fireEvent.click(screen.getByRole('checkbox', { name: t('txPretransfusionCheck') }));
    fireEvent.click(
      within(screen.getByRole('group', { name: `${t('txResult')} ${code(1)}` })).getByRole('radio', {
        name: t('txCompatible'),
      }),
    );
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
    expect((await api.list()).requests[0].status).toBe('incompatible');
  });
  it('prints results before handover and commits stock and book only after pickup confirmation', async () => {
    const { api, request, units } = await compatible();
    const closed = vi.fn();
    render(<TransfusionWorkflow initial={request} units={units} api={api} onSaved={vi.fn()} onClose={closed} t={t} />);
    fireEvent.click(screen.getByRole('button', { name: t('txPrintResults') }));
    expect(printDocument).toHaveBeenCalledOnce();
    expect((await api.list()).bookEntries).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: t('txContinue') }));
    fireEvent.change(screen.getByLabelText(t('txCollector')), { target: { value: 'Recepción DEMO' } });
    fireEvent.change(screen.getByLabelText(t('txCollectorDocument')), { target: { value: '90000999' } });
    fireEvent.change(screen.getByLabelText(t('txDeliveredBy')), { target: { value: 'Entrega DEMO' } });
    fireEvent.click(screen.getByRole('checkbox', { name: t('txReleaseCheck') }));
    fireEvent.click(screen.getByRole('button', { name: t('txDeliver') }));
    expect(screen.getByText(t('txDeliveryWarning'))).toBeInTheDocument();
    const confirmation = screen.getByRole('dialog', { name: t('txConfirmDelivery') });
    expect(within(confirmation).getByText(t('txDeliveryBookEffect'))).toBeInTheDocument();
    expect(within(confirmation).getByText(t('txDeliveryRequestEffect'))).toBeInTheDocument();
    expect(confirmation.querySelector('svg[data-warning-icon]')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: t('txConfirm') }));
    await waitFor(() => expect(closed).toHaveBeenCalledOnce());
    expect((await api.list()).bookEntries).toHaveLength(3);
  });
  it('uses the shared exit dialog to save a draft without creating a sample', async () => {
    const api = createMockTransfusionsApi();
    const request = (await api.list()).requests[0];
    const closed = vi.fn();
    render(<TransfusionWorkflow initial={request} units={[]} api={api} onSaved={vi.fn()} onClose={closed} t={t} />);
    fireEvent.change(screen.getByLabelText(t('txReviewer')), { target: { value: 'Borrador DEMO' } });
    fireEvent.click(screen.getByRole('button', { name: t('close') }));
    const exit = screen.getByRole('dialog', { name: t('exitTitle') });
    expect(within(exit).getByRole('button', { name: t('keepEditing') })).toBeEnabled();
    fireEvent.click(within(exit).getByRole('button', { name: new RegExp(`${t('leave')}$`) }));
    await waitFor(() => expect(closed).toHaveBeenCalledOnce());
    expect((await api.list()).requests[0].sample).toBeNull();
    expect((await api.list()).requests[0].draft.reviewer).toBe('Borrador DEMO');
  });
  it('renders secure failure and retry in both entry points when backend capability is missing', async () => {
    const page = render(<TransfusionsPage api={openmrsTransfusionsApi} />);
    expect(await screen.findByText(t('loadFailed'))).toBeInTheDocument();
    expect(screen.queryByText('TRANSFUSION_BACKEND_NOT_IMPLEMENTED')).not.toBeInTheDocument();
    page.unmount();
    render(<CompatibilityPage api={openmrsTransfusionsApi} />);
    expect(await screen.findByRole('button', { name: t('retry') })).toBeEnabled();
  });
  it('keeps request history and issue records distinct from previous administered transfusions', async () => {
    const { api, request } = await compatible();
    const completed = await api.deliver(request.id, request.revision, {
      ...request.draft,
      collectorName: 'Recepción DEMO',
      collectorDocument: '90000999',
      deliveredBy: 'Entrega DEMO',
      releaseVerified: true,
    });
    const data = await api.list();
    render(<TransfusionHistory requests={data.requests} entries={data.bookEntries} onClose={vi.fn()} t={t} />);
    expect(screen.getAllByRole('button', { name: t('close') })).toHaveLength(1);
    fireEvent.click(screen.getByRole('tab', { name: t('txBook') }));
    expect(within(screen.getByRole('table', { name: t('txBook') })).getAllByRole('row')).toHaveLength(4);
    expect(completed.order.history).toHaveLength(1);
  });
  it('escapes label text, preserves two recipient identifiers and keeps English/Spanish parity', async () => {
    const request = (await createMockTransfusionsApi().list()).requests[0];
    request.order.patientName = '<script>unsafe()</script>';
    const view = render(<TransfusionLabels request={request} sample={request.draft.sample} t={t} />);
    expect(view.container.querySelector('script')).toBeNull();
    expect(view.container.textContent).toContain(request.order.patientName);
    expect(view.container.textContent).toContain(request.order.historyNumber);
    expect(view.container.querySelector('[data-demo]')).toBeTruthy();
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
    const request = await api.saveSample(reviewed.id, reviewed.revision, {
      ...reviewed.draft.sample,
      collectedBy: 'Extracción DEMO',
      identityVerified: true,
    });
    request.draft.selectedUnitIds = [code(13)];
    request.draft.selectionVerified = true;
    render(
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
    expect(within(warning).queryByText(t('txAssignTestsEffect'))).not.toBeInTheDocument();
    expect((await api.list()).units.find((unit) => unit.id === code(13))?.status).toBe('APTO');
    expect((await api.list()).requests[2].status).toBe('sampleReady');
    fireEvent.click(within(warning).getByRole('button', { name: t('txConfirm') }));
    await waitFor(async () => expect((await api.list()).requests[2].status).toBe('compatible'));
  });
});
