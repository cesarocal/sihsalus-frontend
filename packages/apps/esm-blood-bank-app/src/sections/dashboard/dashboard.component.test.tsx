import spanish from '../../../translations/es.json';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { bloodBankPrivileges as p } from '../../access/blood-bank-privileges';
import { mockBloodBankApi } from '../../api/mock-blood-bank.api';
import { BloodBankApp } from '../../blood-bank-app.component';
import { DashboardPage } from './dashboard-page.component';
import { dashboardLink, expiresSoon, readDashboardShortcut } from './dashboard-shortcuts';
import { InventorySelector } from '../inventory/inventory-selector.component';
import { eligibleSource } from '../laboratory/fractionation/fractionation-rules';
import { screeningCategory, localDateTime } from '../laboratory/screening/screening-rules';

async function prepareCompatibilityRound() {
  const api = mockBloodBankApi.transfusions;
  const request = (await api.list()).requests[0];
  const reviewed = await api.review(request.id, request.revision, {
    ...request.draft,
    reviewer: 'Responsable DEMO',
    reviewVerified: true,
    consentVerified: true,
  });
  const sampled = await api.saveSample(reviewed.id, reviewed.revision, {
    ...reviewed.draft.sample,
    collectedAt: localDateTime(),
    collectedBy: 'Extracción DEMO',
    identityVerified: true,
  });
  return api.assign(sampled.id, sampled.revision, ['BB-TX-DEMO-001', 'BB-TX-DEMO-002', 'BB-TX-DEMO-011'], true);
}

const allowed = vi.hoisted(() => new Set<string>());
vi.mock('@sihsalus/esm-rbac', () => ({
  RequirePrivilege: ({
    privilege,
    children,
    fallback,
    hideUnauthorized,
  }: {
    privilege: string;
    children: ReactNode;
    fallback?: ReactNode;
    hideUnauthorized?: boolean;
  }) => (allowed.has(privilege) ? children : hideUnauthorized ? null : (fallback ?? <p>Sin acceso</p>)),
}));
vi.mock('@openmrs/esm-framework', () => ({
  useSession: () => ({ sessionLocation: { display: 'Hospital DEMO' } }),
  formatDatetime: () => '31 oct 2026, 12:00',
  showSnackbar: vi.fn(),
  PageHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  PageHeaderContent: ({ title }: { title: string }) => <div>{title}</div>,
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }) }));
const grant = (...privileges: string[]) =>
  privileges.forEach((privilege) => {
    allowed.add(privilege);
  });
const show = () =>
  render(
    <MemoryRouter>
      <DashboardPage api={mockBloodBankApi} />
    </MemoryRouter>,
  );

describe('personalized home and actionable shortcuts', () => {
  beforeEach(() => {
    allowed.clear();
    sessionStorage.clear();
  });
  it('does not consult unauthorized sources even with module access', () => {
    grant(p.module);
    const inventory = vi.fn(mockBloodBankApi.inventory.list);
    const selection = vi.fn(mockBloodBankApi.selection.listApplications);
    render(
      <MemoryRouter>
        <DashboardPage
          api={{
            ...mockBloodBankApi,
            inventory: { ...mockBloodBankApi.inventory, list: inventory },
            selection: { ...mockBloodBankApi.selection, listApplications: selection },
          }}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText(/No tienes una vista de Inicio/)).toBeInTheDocument();
    expect(inventory).not.toHaveBeenCalled();
    expect(selection).not.toHaveBeenCalled();
  });
  it('shows selection and collection tasks only for their view and destination privileges', async () => {
    grant(p.homeSelection, p.applicantSelection, p.collection);
    show();
    expect(await screen.findByRole('link', { name: /^Entrevistas pendientes:/ })).toHaveAttribute(
      'href',
      '/applicant-selection?status=awaitingInterview',
    );
    expect(await screen.findByRole('link', { name: /^En cola de extracción:/ })).toHaveAttribute('href', '/collection');
    expect(screen.queryByRole('link', { name: /^Unidades aptas:/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Laboratorio' })).not.toBeInTheDocument();
  });
  it('combines profiles without duplicating inventory and keeps the supervisor permission separate from section access', async () => {
    grant(p.homeLaboratory, p.homeInventory, p.homeSupervisor, p.inventory, p.screening);
    const collection = vi.fn(mockBloodBankApi.collection.listCollections);
    render(
      <MemoryRouter>
        <DashboardPage
          api={{ ...mockBloodBankApi, collection: { ...mockBloodBankApi.collection, listCollections: collection } }}
        />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('link', { name: /^Unidades aptas:/ })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: 'Inventario' })).toHaveLength(1);
    expect(await screen.findByRole('link', { name: /^Muestras de seguimiento por tamizar:/ })).toBeInTheDocument();
    expect(collection).not.toHaveBeenCalled();
    expect(screen.queryByRole('link', { name: /^Solicitudes transfusionales pendientes:/ })).not.toBeInTheDocument();
  });
  it('does not grant a dashboard view just because inventory itself is authorized', () => {
    grant(p.inventory);
    show();
    expect(screen.queryByRole('link', { name: /^Unidades aptas:/ })).not.toBeInTheDocument();
  });
  it.each([
    {
      name: 'selection',
      privileges: [p.homeSelection, p.applicantSelection, p.collection],
      mode: 'focused',
      areas: ['selectionGroup'],
      task: /^Entrevistas pendientes:/,
    },
    {
      name: 'laboratory',
      privileges: [p.homeLaboratory, p.screening, p.compatibility, p.fractionation],
      mode: 'focused',
      areas: ['laboratoryGroup'],
      task: /^Muestras de donantes por tamizar:/,
    },
    {
      name: 'inventory',
      privileges: [p.homeInventory, p.inventory],
      mode: 'focused',
      areas: ['inventoryGroup'],
      task: /^Unidades aptas:/,
    },
    {
      name: 'laboratory and inventory',
      privileges: [p.homeLaboratory, p.homeInventory, p.screening, p.inventory],
      mode: 'mosaic',
      areas: ['laboratoryGroup', 'inventoryGroup'],
      task: /^Unidades aptas:/,
    },
    {
      name: 'operational profiles',
      privileges: [p.homeSelection, p.homeLaboratory, p.homeInventory, p.applicantSelection, p.screening, p.inventory],
      mode: 'mosaic',
      areas: ['selectionGroup', 'laboratoryGroup', 'inventoryGroup'],
      task: /^Unidades aptas:/,
    },
    {
      name: 'supervisor with only inventory access',
      privileges: [p.homeSupervisor, p.inventory],
      mode: 'mosaic',
      areas: ['inventoryGroup'],
      task: /^Unidades aptas:/,
    },
    {
      name: 'supervisor plus inventory',
      privileges: [p.homeSupervisor, p.homeInventory, p.inventory],
      mode: 'mosaic',
      areas: ['inventoryGroup'],
      task: /^Unidades aptas:/,
    },
    {
      name: 'two Home views with one operational destination',
      privileges: [p.homeSelection, p.homeLaboratory, p.screening],
      mode: 'mosaic',
      areas: ['laboratoryGroup'],
      task: /^Muestras de donantes por tamizar:/,
    },
    {
      name: 'a repeated Home privilege',
      privileges: [p.homeInventory, p.homeInventory, p.inventory],
      mode: 'focused',
      areas: ['inventoryGroup'],
      task: /^Unidades aptas:/,
    },
  ])('chooses the layout for $name while retaining only authorized areas', async ({
    privileges,
    mode,
    areas,
    task,
  }) => {
    grant(...privileges);
    const { container } = show();
    await screen.findByRole('link', { name: task });
    expect(container.querySelector('[data-home-layout]')).toHaveAttribute('data-home-layout', mode);
    for (const key of ['selectionGroup', 'laboratoryGroup', 'inventoryGroup', 'supervisorGroup'] as const) {
      expect(screen.queryAllByRole('region', { name: spanish.dashboard[key] })).toHaveLength(
        areas.includes(key) ? 1 : 0,
      );
    }
  });
  it('places expiry shortcuts after all authorized areas and shares one inventory read on each refresh', async () => {
    grant(p.homeSupervisor, p.homeInventory, p.inventory, p.transfers);
    const list = vi.fn(mockBloodBankApi.inventory.list);
    render(
      <MemoryRouter>
        <DashboardPage api={{ ...mockBloodBankApi, inventory: { ...mockBloodBankApi.inventory, list } }} />
      </MemoryRouter>,
    );
    const inventory = await screen.findByRole('region', { name: spanish.dashboard.inventoryGroup });
    const coordination = screen.getByRole('region', { name: spanish.dashboard.supervisorGroup });
    const alerts = await screen.findByRole('region', { name: spanish.dashboard.expiryAlerts });
    expect(within(inventory).getAllByRole('link')).toHaveLength(3);
    expect(inventory).not.toContainElement(alerts);
    expect(coordination.compareDocumentPosition(alerts) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      within(alerts)
        .getAllByRole('link')
        .some((link) => link.getAttribute('href')?.includes('?unit=')),
    ).toBe(true);
    expect(list).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: spanish.dashboard.refresh }));
    await screen.findByRole('link', { name: /^Unidades aptas:/ });
    expect(list).toHaveBeenCalledTimes(2);
  });
  it.each([
    { privileges: [p.homeInventory] },
    { privileges: [p.inventory] },
    { privileges: [p.homeSupervisor, p.screening] },
  ])('does not fetch inventory or show expiry alerts with incomplete inventory permissions: $privileges', async ({
    privileges,
  }) => {
    grant(...privileges);
    const list = vi.fn(mockBloodBankApi.inventory.list);
    render(
      <MemoryRouter>
        <DashboardPage api={{ ...mockBloodBankApi, inventory: { ...mockBloodBankApi.inventory, list } }} />
      </MemoryRouter>,
    );
    if (privileges.some((privilege) => privilege === p.screening)) {
      await screen.findByRole('link', { name: /^Muestras de donantes por tamizar:/ });
    }
    expect(list).not.toHaveBeenCalled();
    expect(screen.queryByRole('region', { name: spanish.dashboard.expiryAlerts })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Unidades aptas:/ })).not.toBeInTheDocument();
  });
  it('keeps laboratory usable after a shared inventory failure and restores summaries and alerts on retry', async () => {
    grant(p.homeInventory, p.inventory, p.homeLaboratory, p.screening);
    const list = vi.fn(mockBloodBankApi.inventory.list).mockRejectedValueOnce(new Error('private inventory details'));
    render(
      <MemoryRouter>
        <DashboardPage api={{ ...mockBloodBankApi, inventory: { ...mockBloodBankApi.inventory, list } }} />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('link', { name: /^Muestras de donantes por tamizar:/ })).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent(spanish.dashboard.loadFailed);
    expect(screen.queryByRole('region', { name: spanish.dashboard.expiryAlerts })).not.toBeInTheDocument();
    expect(screen.queryByText('private inventory details')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: spanish.dashboard.retry }));
    expect(await screen.findByRole('link', { name: /^Unidades aptas:/ })).toBeInTheDocument();
    expect(await screen.findByRole('region', { name: spanish.dashboard.expiryAlerts })).toBeInTheDocument();
    expect(list).toHaveBeenCalledTimes(2);
    expect(screen.getAllByRole('heading', { name: spanish.dashboard.laboratoryGroup })).toHaveLength(1);
  });
  it('opens inventory filtered to the exact alerted unit, supports direct reload and clearing the shortcut', async () => {
    grant(p.homeInventory, p.inventory);
    const view = render(<BloodBankApp api={mockBloodBankApi} />);
    const alertLink = (await screen.findAllByRole('link')).find((link) =>
      link.getAttribute('href')?.includes('?unit='),
    );
    expect(alertLink).toBeTruthy();
    const href = alertLink?.getAttribute('href') ?? '';
    const unit = new URLSearchParams(href.split('?')[1]).get('unit');
    if (!alertLink || !unit) throw new Error('MOCK_ALERT_MISSING');
    fireEvent.click(alertLink);
    const table = await screen.findByRole('table', { name: spanish.processing.inventoryUnits });
    expect(within(table).getAllByRole('row')).toHaveLength(2);
    expect(within(table).getByText(unit)).toBeInTheDocument();
    view.unmount();
    render(<BloodBankApp api={mockBloodBankApi} initialPath={href} />);
    await screen.findByRole('table', { name: spanish.processing.inventoryUnits });
    expect(screen.getByRole('searchbox')).toHaveValue(unit);
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(within(screen.getByRole('table')).getAllByRole('row').length).toBeGreaterThan(2);
  });
  it('handles stale unit links safely and denies inventory without its destination privilege', async () => {
    const list = vi.fn(mockBloodBankApi.inventory.list);
    const api = { ...mockBloodBankApi, inventory: { ...mockBloodBankApi.inventory, list } };
    grant(p.homeInventory);
    const view = render(<BloodBankApp api={api} initialPath="/inventory?unit=UNKNOWN-DEMO" />);
    expect(screen.getByText('Sin acceso')).toBeInTheDocument();
    expect(list).not.toHaveBeenCalled();
    view.unmount();
    grant(p.inventory);
    render(<BloodBankApp api={api} initialPath="/inventory?unit=UNKNOWN-DEMO" />);
    expect(await screen.findByText(/La unidad ya no figura/)).toBeInTheDocument();
  });
  it('uses an icon-only broom after Status and clears visible filters plus the Home seal filter', async () => {
    const { units } = await mockBloodBankApi.inventory.list();
    const t = (key: string) => (spanish.processing as Record<string, string>)[key] ?? key;
    render(
      <InventorySelector
        units={units}
        selected={[]}
        onChange={vi.fn()}
        busy={false}
        prefix="clear-filter-test"
        t={t}
        shortcut={readDashboardShortcut('?category=seal')}
      />,
    );
    expect(screen.queryByText(spanish.processing.homeSealFilter)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: spanish.processing.homeClearFilters })).not.toBeInTheDocument();
    const clear = screen.getByRole('button', { name: spanish.processing.inventoryClearFilters });
    expect(clear.querySelector('svg')).toBeTruthy();
    fireEvent.change(screen.getByLabelText(spanish.processing.fractionationComponent), {
      target: { value: units[0].component },
    });
    fireEvent.change(screen.getByLabelText(spanish.processing.bloodGroup), { target: { value: units[0].bloodGroup } });
    fireEvent.change(screen.getByLabelText(spanish.processing.status), { target: { value: units[0].status } });
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: units[0].id } });
    fireEvent.click(clear);
    expect(screen.getByRole('searchbox')).toHaveValue('');
    expect(screen.getByLabelText(spanish.processing.fractionationComponent)).toHaveValue('');
    expect(screen.getByLabelText(spanish.processing.bloodGroup)).toHaveValue('');
    expect(screen.getByLabelText(spanish.processing.status)).toHaveValue('');
    expect(within(screen.getByRole('table')).getAllByRole('row').length).toBeGreaterThan(4);
    expect(clear).toBeDisabled();
  });
  it('updates an existing inventory view when the URL shortcut changes and clears the old exact match', async () => {
    const { units } = await mockBloodBankApi.inventory.list();
    const first = units[0].id;
    const next = units[1].id;
    const t = (key: string) => (spanish.processing as Record<string, string>)[key] ?? key;
    const props = { units, selected: [], onChange: vi.fn(), busy: false, prefix: 'home-shortcut-test', t };
    const view = render(
      <InventorySelector {...props} shortcut={readDashboardShortcut(`?unit=${encodeURIComponent(first)}`)} />,
    );
    expect(screen.getByRole('searchbox')).toHaveValue(first);
    view.rerender(
      <InventorySelector {...props} shortcut={readDashboardShortcut(`?unit=${encodeURIComponent(next)}`)} />,
    );
    expect(screen.getByRole('searchbox')).toHaveValue(next);
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2);
    expect(within(screen.getByRole('table')).getByText(next)).toBeInTheDocument();
    view.rerender(<InventorySelector {...props} shortcut={readDashboardShortcut('')} />);
    expect(screen.getByRole('searchbox')).toHaveValue('');
    expect(within(screen.getByRole('table')).getAllByRole('row').length).toBeGreaterThan(2);
  });
  it('opens the follow-up screening tab rather than the donor tab', async () => {
    grant(p.homeLaboratory, p.screening);
    render(<BloodBankApp api={mockBloodBankApi} />);
    fireEvent.click(await screen.findByRole('link', { name: /^Muestras de seguimiento por tamizar:/ }));
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'Seguimientos' })).toHaveAttribute('aria-selected', 'true'),
    );
  });
  it('opens a new application without saving or admitting a person', async () => {
    grant(p.homeSelection, p.applicantSelection);
    const save = vi.fn(mockBloodBankApi.selection.saveDraft);
    const api = { ...mockBloodBankApi, selection: { ...mockBloodBankApi.selection, saveDraft: save } };
    render(<BloodBankApp api={api} />);
    fireEvent.click(await screen.findByRole('link', { name: /Nueva postulación/ }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
  });
  it('uses one read per summary source and builds pending rows from the current operational records', async () => {
    grant(p.homeSelection, p.applicantSelection, p.collection);
    const applications = await mockBloodBankApi.selection.listApplications();
    const collections = await mockBloodBankApi.collection.listCollections();
    const listApplications = vi.fn(async () => structuredClone(applications));
    const listCollections = vi.fn(async () => structuredClone(collections));
    const api = {
      ...mockBloodBankApi,
      selection: { ...mockBloodBankApi.selection, listApplications },
      collection: { ...mockBloodBankApi.collection, listCollections },
    };
    render(
      <MemoryRouter>
        <DashboardPage api={api} />
      </MemoryRouter>,
    );
    const table = await screen.findByRole('table', { name: spanish.dashboard.selectionPendingTitle });
    const interviews = applications.filter((a) => a.status === 'awaitingInterview');
    const queue = collections.filter((c) => c.status !== 'completed');
    await waitFor(() =>
      expect(within(table).getAllByRole('row')).toHaveLength(1 + Math.min(6, interviews.length + queue.length)),
    );
    expect(screen.getByRole('link', { name: `Entrevistas pendientes: ${interviews.length}` })).toBeInTheDocument();
    for (const a of interviews)
      expect(within(table).getByRole('link', { name: spanish.dashboard.interviewAction })).toHaveAttribute(
        'href',
        dashboardLink('/applicant-selection', { application: a.id }),
      );
    for (const c of queue)
      expect(within(table).getByRole('link', { name: spanish.dashboard.continueCollectionAction })).toHaveAttribute(
        'href',
        dashboardLink('/collection', { collection: c.id }),
      );
    expect(listApplications).toHaveBeenCalledTimes(1);
    expect(listCollections).toHaveBeenCalledTimes(1);
  });
  it.each([
    { privilege: p.applicantSelection, expected: 'interview' },
    { privilege: p.collection, expected: 'collection' },
  ])('queries and displays pending tasks only for $privilege', async ({ privilege, expected }) => {
    const applications = await mockBloodBankApi.selection.listApplications();
    const collections = await mockBloodBankApi.collection.listCollections();
    const listApplications = vi.fn(async () => structuredClone(applications));
    const listCollections = vi.fn(async () => structuredClone(collections));
    grant(p.homeSelection, privilege);
    render(
      <MemoryRouter>
        <DashboardPage
          api={{
            ...mockBloodBankApi,
            selection: { ...mockBloodBankApi.selection, listApplications },
            collection: { ...mockBloodBankApi.collection, listCollections },
          }}
        />
      </MemoryRouter>,
    );
    const action =
      expected === 'interview' ? spanish.dashboard.interviewAction : spanish.dashboard.continueCollectionAction;
    expect(await screen.findByRole('link', { name: action })).toBeInTheDocument();
    expect(listApplications).toHaveBeenCalledTimes(expected === 'interview' ? 1 : 0);
    expect(listCollections).toHaveBeenCalledTimes(expected === 'collection' ? 1 : 0);
    expect(
      screen.queryByRole('link', {
        name: expected === 'interview' ? spanish.dashboard.continueCollectionAction : spanish.dashboard.interviewAction,
      }),
    ).not.toBeInTheDocument();
  });
  it('opens the exact interview from Home with locked admission fields and does not reopen it after leaving', async () => {
    grant(p.homeSelection, p.applicantSelection);
    const pending = (await mockBloodBankApi.selection.listApplications()).find((a) => a.status === 'awaitingInterview');
    if (!pending) throw new Error('MISSING_SYNTHETIC_INTERVIEW');
    const saveDraft = vi.fn(mockBloodBankApi.selection.saveDraft);
    render(<BloodBankApp api={{ ...mockBloodBankApi, selection: { ...mockBloodBankApi.selection, saveDraft } }} />);
    fireEvent.click(await screen.findByRole('link', { name: spanish.dashboard.interviewAction }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Número de documento')).toHaveValue(pending.admission.documentNumber);
    expect(within(dialog).getByLabelText('Número de documento')).toHaveAttribute('readonly');
    expect(saveDraft).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: spanish.selection.closeProcess }));
    const leave = await screen.findByRole('dialog', { name: spanish.selection.leaveTitle });
    fireEvent.click(within(leave).getByRole('checkbox', { name: spanish.selection.saveBeforeExit }));
    fireEvent.click(within(leave).getByRole('button', { name: /Salir$/ }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(saveDraft).not.toHaveBeenCalled();
  });
  it('opens a pending collection from Home without saving and consumes the shortcut across queue refresh', async () => {
    grant(p.homeSelection, p.collection);
    const listCollections = vi.fn(mockBloodBankApi.collection.listCollections);
    const saveCollection = vi.fn(mockBloodBankApi.collection.saveCollection);
    render(
      <BloodBankApp
        api={{ ...mockBloodBankApi, collection: { ...mockBloodBankApi.collection, listCollections, saveCollection } }}
      />,
    );
    fireEvent.click(await screen.findByRole('link', { name: spanish.dashboard.continueCollectionAction }));
    const dialog = await screen.findByRole('dialog');
    expect(saveCollection).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: spanish.processing.close }));
    const leave = await screen.findByRole('dialog', { name: spanish.processing.exitTitle });
    fireEvent.click(within(leave).getByRole('checkbox', { name: spanish.processing.saveBeforeExit }));
    fireEvent.click(within(leave).getByRole('button', { name: /Salir$/ }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(listCollections.mock.calls.length).toBeGreaterThanOrEqual(3));
    await screen.findByRole('table', { name: spanish.processing.queue });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(saveCollection).not.toHaveBeenCalled();
  });
  it('rejects missing or no-longer-pending interview and collection links without opening workflows', async () => {
    grant(p.applicantSelection, p.collection);
    const selected = (await mockBloodBankApi.selection.listApplications()).find((a) => a.status === 'selected');
    if (!selected) throw new Error('MISSING_SYNTHETIC_SELECTED');
    const view = render(
      <BloodBankApp
        api={mockBloodBankApi}
        initialPath={dashboardLink('/applicant-selection', { application: selected.id })}
      />,
    );
    expect(await screen.findByText(spanish.selection.homeApplicationUnavailable)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    view.unmount();
    render(<BloodBankApp api={mockBloodBankApi} initialPath="/collection?collection=UNKNOWN-DEMO" />);
    expect(await screen.findByText(spanish.processing.homeCollectionUnavailable)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('denies direct pending-task links without the destination permission and performs no source read', () => {
    grant(p.homeSelection);
    const listApplications = vi.fn(mockBloodBankApi.selection.listApplications);
    const listCollections = vi.fn(mockBloodBankApi.collection.listCollections);
    const api = {
      ...mockBloodBankApi,
      selection: { ...mockBloodBankApi.selection, listApplications },
      collection: { ...mockBloodBankApi.collection, listCollections },
    };
    const view = render(<BloodBankApp api={api} initialPath="/applicant-selection?application=DEMO" />);
    expect(screen.getByText('Sin acceso')).toBeInTheDocument();
    expect(listApplications).not.toHaveBeenCalled();
    view.unmount();
    render(<BloodBankApp api={api} initialPath="/collection?collection=DEMO" />);
    expect(screen.getByText('Sin acceso')).toBeInTheDocument();
    expect(listCollections).not.toHaveBeenCalled();
  });
  it('keeps failures local to the affected source and exposes no technical messages', async () => {
    grant(p.homeSelection, p.applicantSelection, p.collection);
    const api = {
      ...mockBloodBankApi,
      collection: {
        ...mockBloodBankApi.collection,
        listCollections: () => Promise.reject(new Error('private endpoint')),
      },
    };
    render(
      <MemoryRouter>
        <DashboardPage api={api} />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron consultar estos pendientes.');
    expect(await screen.findByRole('link', { name: /^Entrevistas pendientes:/ })).toBeInTheDocument();
    expect(screen.queryByText('private endpoint')).not.toBeInTheDocument();
  });
});
describe('laboratory summary and exact pending shortcuts', () => {
  beforeEach(() => {
    allowed.clear();
    sessionStorage.clear();
  });
  it('shares authorized reads between full counters and the filtered preview without refetching', async () => {
    grant(p.homeLaboratory, p.screening, p.compatibility, p.fractionation);
    const request = await prepareCompatibilityRound();
    const eligibleCount = (await mockBloodBankApi.fractionation.list()).units.filter(eligibleSource).length;
    const listScreenings = vi.fn(mockBloodBankApi.screening.listScreenings);
    const compatibility = vi.fn(mockBloodBankApi.transfusions.list);
    const fractionation = vi.fn(mockBloodBankApi.fractionation.list);
    render(
      <MemoryRouter>
        <DashboardPage
          api={{
            ...mockBloodBankApi,
            screening: { ...mockBloodBankApi.screening, listScreenings },
            transfusions: { ...mockBloodBankApi.transfusions, list: compatibility },
            fractionation: { ...mockBloodBankApi.fractionation, list: fractionation },
          }}
        />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('link', { name: `${spanish.dashboard.compatibility}: 1` })).toBeInTheDocument();
    expect(
      await screen.findByRole('link', { name: `${spanish.dashboard.fractionation}: ${eligibleCount}` }),
    ).toBeInTheDocument();
    const table = screen.getByRole('table', { name: spanish.dashboard.laboratoryPendingTitle });
    expect(within(table).getByRole('link', { name: spanish.dashboard.compatibilityAction })).toHaveAttribute(
      'href',
      dashboardLink('/laboratory/compatibility', { round: request.rounds[0].id }),
    );
    fireEvent.click(screen.getByRole('button', { name: spanish.dashboard.screeningProcess }));
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(within(table).queryByRole('link', { name: spanish.dashboard.fractionationAction })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: spanish.dashboard.compatibilityProcess }));
    expect(within(table).getAllByRole('row')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: spanish.dashboard.fractionationProcess }));
    expect(within(table).getAllByRole('row')).toHaveLength(Math.min(eligibleCount, 6) + 1);
    expect(listScreenings).toHaveBeenCalledTimes(1);
    expect(compatibility).toHaveBeenCalledTimes(1);
    expect(fractionation).toHaveBeenCalledTimes(1);
  });
  it.each([
    p.screening,
    p.compatibility,
    p.fractionation,
  ])('reads only the authorized destination %s', async (privilege) => {
    grant(p.homeLaboratory, privilege);
    const listScreenings = vi.fn(mockBloodBankApi.screening.listScreenings);
    const compatibility = vi.fn(mockBloodBankApi.transfusions.list);
    const fractionation = vi.fn(mockBloodBankApi.fractionation.list);
    render(
      <MemoryRouter>
        <DashboardPage
          api={{
            ...mockBloodBankApi,
            screening: { ...mockBloodBankApi.screening, listScreenings },
            transfusions: { ...mockBloodBankApi.transfusions, list: compatibility },
            fractionation: { ...mockBloodBankApi.fractionation, list: fractionation },
          }}
        />
      </MemoryRouter>,
    );
    const key =
      privilege === p.screening ? 'donorSamples' : privilege === p.compatibility ? 'compatibility' : 'fractionation';
    await screen.findByRole('link', { name: new RegExp(`^${spanish.dashboard[key]}:`) });
    expect(listScreenings).toHaveBeenCalledTimes(privilege === p.screening ? 1 : 0);
    expect(compatibility).toHaveBeenCalledTimes(privilege === p.compatibility ? 1 : 0);
    expect(fractionation).toHaveBeenCalledTimes(privilege === p.fractionation ? 1 : 0);
    for (const [permission, label] of [
      [p.screening, 'screeningProcess'],
      [p.compatibility, 'compatibilityProcess'],
      [p.fractionation, 'fractionationProcess'],
    ] as const) {
      expect(screen.queryByRole('button', { name: spanish.dashboard[label] }) !== null).toBe(permission === privilege);
    }
  });
  it('excludes validated or unclassified samples, counts all pending rows and limits only the preview', async () => {
    grant(p.homeLaboratory, p.screening);
    const seed = (await mockBloodBankApi.screening.listScreenings())[0];
    const samples = Array.from({ length: 8 }, (_, i) => ({
      ...seed,
      id: `DEMO-${i}`,
      sampleCode: `M-${i}`,
      status: 'pending' as const,
    }));
    render(
      <MemoryRouter>
        <DashboardPage
          api={{
            ...mockBloodBankApi,
            screening: {
              ...mockBloodBankApi.screening,
              listScreenings: async () => [
                ...samples,
                { ...seed, id: 'VALIDATED', sampleCode: 'EXCLUDED', status: 'validated' },
                {
                  ...seed,
                  id: 'UNKNOWN',
                  sampleCode: 'UNCLASSIFIED',
                  origin: undefined,
                  unitCode: '',
                  collectionId: '',
                },
              ],
            },
          }}
        />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('link', { name: `${spanish.dashboard.donorSamples}: 8` })).toBeInTheDocument();
    const table = screen.getByRole('table', { name: spanish.dashboard.laboratoryPendingTitle });
    expect(within(table).getAllByRole('row')).toHaveLength(7);
    expect(screen.queryByText('EXCLUDED')).not.toBeInTheDocument();
    expect(screen.queryByText('UNCLASSIFIED')).not.toBeInTheDocument();
    expect(screen.getByText(spanish.dashboard.moreLaboratoryPending)).toBeInTheDocument();
  });
  it('keeps usable sources visible after a failure and retries without exposing errors or false zeros', async () => {
    grant(p.homeLaboratory, p.compatibility, p.fractionation);
    const list = vi.fn(mockBloodBankApi.transfusions.list).mockRejectedValueOnce(new Error('private endpoint'));
    render(
      <MemoryRouter>
        <DashboardPage api={{ ...mockBloodBankApi, transfusions: { ...mockBloodBankApi.transfusions, list } }} />
      </MemoryRouter>,
    );
    await screen.findByRole('alert');
    expect(await screen.findByRole('link', { name: `${spanish.dashboard.fractionation}: 3` })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: `${spanish.dashboard.compatibility}: 0` })).not.toBeInTheDocument();
    expect(screen.queryByText('private endpoint')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: spanish.dashboard.retry }));
    expect(await screen.findByRole('link', { name: `${spanish.dashboard.compatibility}: 0` })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: spanish.dashboard.compatibilityProcess }));
    expect(screen.getByText(spanish.dashboard.noLaboratoryPending)).toBeInTheDocument();
    expect(list).toHaveBeenCalledTimes(2);
  });
  it.each([
    'donors',
    'followUps',
  ] as const)('opens the exact %s sample without saving or reopening after exit', async (category) => {
    grant(p.homeLaboratory, p.screening);
    const record = (await mockBloodBankApi.screening.listScreenings()).find(
      (r) => screeningCategory(r) === category && r.status !== 'validated',
    );
    if (!record) throw new Error('MISSING_SYNTHETIC_SAMPLE');
    const saveScreening = vi.fn(mockBloodBankApi.screening.saveScreening);
    render(<BloodBankApp api={{ ...mockBloodBankApi, screening: { ...mockBloodBankApi.screening, saveScreening } }} />);
    const table = await screen.findByRole('table', { name: spanish.dashboard.laboratoryPendingTitle });
    const row = (await within(table).findByText(record.sampleCode)).closest('tr');
    if (!row) throw new Error('MISSING_SAMPLE_ROW');
    fireEvent.click(within(row).getByRole('link', { name: spanish.dashboard.screeningAction }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(record.sampleCode)).toBeInTheDocument();
    expect(saveScreening).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: spanish.processing.close }));
    const leave = await screen.findByRole('dialog', { name: spanish.processing.exitTitle });
    fireEvent.click(within(leave).getByRole('checkbox', { name: spanish.processing.saveBeforeExit }));
    fireEvent.click(within(leave).getByRole('button', { name: /Salir$/ }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(saveScreening).not.toHaveBeenCalled();
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent(
      category === 'donors' ? spanish.processing.donorSamples : spanish.processing.followUpSamples,
    );
  });
  it('opens a pending compatibility group without registering results, and consumes the reference', async () => {
    grant(p.homeLaboratory, p.compatibility);
    const request = await prepareCompatibilityRound();
    const saveCompatibility = vi.fn(mockBloodBankApi.transfusions.saveCompatibility);
    render(
      <BloodBankApp
        api={{ ...mockBloodBankApi, transfusions: { ...mockBloodBankApi.transfusions, saveCompatibility } }}
      />,
    );
    fireEvent.click(await screen.findByRole('link', { name: spanish.dashboard.compatibilityAction }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getAllByText(request.rounds[0].sample.code).length).toBeGreaterThan(0);
    fireEvent.click(within(dialog).getByRole('button', { name: spanish.processing.close }));
    const leave = await screen.findByRole('dialog', { name: spanish.processing.exitTitle });
    fireEvent.click(within(leave).getByRole('checkbox', { name: spanish.processing.saveBeforeExit }));
    fireEvent.click(within(leave).getByRole('button', { name: /Salir$/ }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(saveCompatibility).not.toHaveBeenCalled();
  });
  it('locates and preselects an exact fractionation unit without starting a batch or changing stock', async () => {
    grant(p.homeLaboratory, p.fractionation);
    const unit = (await mockBloodBankApi.fractionation.list()).units.find(eligibleSource);
    if (!unit) throw new Error('MISSING_SYNTHETIC_UNIT');
    const start = vi.fn(mockBloodBankApi.fractionation.start);
    render(<BloodBankApp api={{ ...mockBloodBankApi, fractionation: { ...mockBloodBankApi.fractionation, start } }} />);
    const table = await screen.findByRole('table', { name: spanish.dashboard.laboratoryPendingTitle });
    const row = (await within(table).findByText(unit.code)).closest('tr');
    if (!row) throw new Error('MISSING_UNIT_ROW');
    fireEvent.click(within(row).getByRole('link', { name: spanish.dashboard.fractionationAction }));
    expect(
      await screen.findByRole('checkbox', { name: `${spanish.processing.fractionationSelect} ${unit.code}` }),
    ).toBeChecked();
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
    expect(start).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('rejects stale exact laboratory references and does not open a different record', async () => {
    grant(p.screening, p.compatibility, p.fractionation);
    const sample = (await mockBloodBankApi.screening.listScreenings())[0];
    const api = {
      ...mockBloodBankApi,
      screening: {
        ...mockBloodBankApi.screening,
        listScreenings: async () => [{ ...sample, status: 'validated' as const }],
      },
    };
    const view = render(
      <BloodBankApp api={api} initialPath={dashboardLink('/laboratory/screening', { screening: sample.id })} />,
    );
    await screen.findByText(spanish.processing.homeScreeningUnavailable);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    view.unmount();
    const compatibility = render(
      <BloodBankApp api={mockBloodBankApi} initialPath="/laboratory/compatibility?round=UNKNOWN-DEMO" />,
    );
    await screen.findByText(spanish.transfusion.txHomeRoundUnavailable);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    compatibility.unmount();
    render(<BloodBankApp api={mockBloodBankApi} initialPath="/laboratory/fractionation?unit=F-DEMO" />);
    await screen.findByText(spanish.processing.homeFractionationUnavailable);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it.each([
    '/laboratory/screening?screening=DEMO',
    '/laboratory/compatibility?round=DEMO',
    '/laboratory/fractionation?unit=DEMO',
  ])('denies %s without the destination privilege', (initialPath) => {
    grant(p.homeLaboratory);
    const listScreenings = vi.fn(mockBloodBankApi.screening.listScreenings);
    const list = vi.fn(mockBloodBankApi.transfusions.list);
    const fractionation = vi.fn(mockBloodBankApi.fractionation.list);
    render(
      <BloodBankApp
        initialPath={initialPath}
        api={{
          ...mockBloodBankApi,
          screening: { ...mockBloodBankApi.screening, listScreenings },
          transfusions: { ...mockBloodBankApi.transfusions, list },
          fractionation: { ...mockBloodBankApi.fractionation, list: fractionation },
        }}
      />,
    );
    expect(screen.getByText('Sin acceso')).toBeInTheDocument();
    expect(listScreenings).not.toHaveBeenCalled();
    expect(list).not.toHaveBeenCalled();
    expect(fractionation).not.toHaveBeenCalled();
  });
});

describe('expiry and URL shortcut contracts', () => {
  it('includes today and the last reminder day, excluding expired, unknown and invalid dates', () => {
    expect(expiresSoon('2026-10-31', 7, '2026-10-31')).toBe(true);
    expect(expiresSoon('07/11/2026', 7, '2026-10-31')).toBe(true);
    expect(expiresSoon('2026-11-08', 7, '2026-10-31')).toBe(false);
    expect(expiresSoon('2026-10-30', 7, '2026-10-31')).toBe(false);
    expect(expiresSoon('', 7, '2026-10-31')).toBe(false);
  });
  it('encodes unit identifiers and bounds unsupported expiry windows without accepting arbitrary redirects', () => {
    const href = dashboardLink('/inventory', { unit: 'U-DEMO+1/&' });
    expect(readDashboardShortcut(href.slice(href.indexOf('?'))).unit).toBe('U-DEMO+1/&');
    expect(readDashboardShortcut('?expires=-1').expires).toBe(0);
    expect(readDashboardShortcut('?expires=9999&redirect=https://example.com').expires).toBe(0);
  });
});
