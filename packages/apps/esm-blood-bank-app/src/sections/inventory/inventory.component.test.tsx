import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { showSnackbar } from '@openmrs/esm-framework';
import spanish from '../../../translations/es.json';
import english from '../../../translations/en.json';
import { mockBloodBankApi } from '../../api/mock-blood-bank.api';
import { createMockInventoryApi } from '../../api/mock-inventory.api';
import { printDocument } from '../../shared/print-document';
import { InventoryPage } from './inventory-page.component';
import { InventoryWorkflow } from './inventory-workflow.component';
import { QualitySeals, DisposalAct } from './inventory-documents.component';
import { newInventoryOperation } from './inventory-rules';
import { disposalOperation, sealOperation, seedInventoryReadyUnits } from './inventory-test-fixtures';
import { disposalCauses } from './disposal-causes';

vi.mock('@openmrs/esm-framework', () => ({
  useSession: () => ({ sessionLocation: { display: 'Hospital DEMO' } }),
  formatDatetime: () => '06 oct 2026, 12:00',
  showSnackbar: vi.fn(),
  StockManagementPictogram: () => <svg />,
  PageHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  PageHeaderContent: ({ title }: { title: string }) => <div>{title}</div>,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));
vi.mock('../../shared/print-document', () => ({ printDocument: vi.fn() }));
const t = (key: string) => (spanish.processing as Record<string, string>)[key] ?? key;
const instance = () => ({
  ...mockBloodBankApi,
  inventory: createMockInventoryApi(),
});

describe('inventory selection, seals and disposal UI', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
    vi.mocked(printDocument).mockReset();
  });
  it('combines search, component/group/status filters, multi-selection and deselection', async () => {
    render(<InventoryPage api={instance()} />);
    const first = await screen.findByRole('checkbox', {
      name: 'Seleccionar PFC-2026-002',
    });
    expect(screen.queryByRole('button', { name: t('inventorySelectFiltered') })).not.toBeInTheDocument();
    fireEvent.click(first);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar PFC-2026-003' }));
    expect(screen.getByText('Unidades seleccionadas: 2')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(t('search')), {
      target: { value: 'PFC' },
    });
    fireEvent.change(screen.getByLabelText(t('bloodGroup')), {
      target: { value: 'A−' },
    });
    fireEvent.change(screen.getByLabelText(t('status')), {
      target: { value: 'Cuarentena' },
    });
    expect(first).toBeInTheDocument();
    expect(screen.queryByText('PFC-2026-003')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(t('fractionationComponent')), {
      target: { value: 'Glóbulos rojos' },
    });
    expect(screen.queryByText('PFC-2026-002')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: t('inventoryDeselect') }));
    expect(screen.getByText('Unidades seleccionadas: 0')).toBeInTheDocument();
  });
  it.each([
    'qualitySeal',
    'disposal',
  ] as const)('opens %s with row selections or an empty searchable selector', async (kind) => {
    seedInventoryReadyUnits();
    const { unmount } = render(<InventoryPage api={instance()} />);
    fireEvent.click(
      await screen.findByRole('checkbox', {
        name: 'Seleccionar PFC-2026-002',
      }),
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: t(kind === 'qualitySeal' ? 'inventoryQualitySeal' : 'inventoryDispose'),
      }),
    );
    const modal = screen.getByRole('dialog');
    expect(within(modal).getByRole('button', { name: t('inventorySelectFiltered') })).toBeInTheDocument();
    expect(within(modal).queryByRole('columnheader', { name: t('inventorySealReadiness') })).not.toBeInTheDocument();
    expect(
      within(modal).getByRole('checkbox', {
        name: 'Seleccionar PFC-2026-002',
      }),
    ).toBeChecked();
    expect(within(modal).getByLabelText(t('search'))).toBeEnabled();
    unmount();
    render(<InventoryPage api={instance()} />);
    await screen.findByText('PFC-2026-002');
    fireEvent.click(
      screen.getByRole('button', {
        name: t(kind === 'qualitySeal' ? 'inventoryQualitySeal' : 'inventoryDispose'),
      }),
    );
    expect(within(screen.getByRole('dialog')).getByText('Unidades seleccionadas: 0')).toBeInTheDocument();
  });
  it('shows only non-reactive units when opening a seal without preselection, excluding pending and reactive rows', async () => {
    render(<InventoryPage api={instance()} />);
    await screen.findByRole('checkbox', { name: 'Seleccionar BB-SELLO-DEMO-001' });
    fireEvent.click(screen.getByRole('button', { name: t('inventoryQualitySeal') }));
    const modal = screen.getByRole('dialog');
    for (const number of ['001', '002', '003'])
      expect(within(modal).getByRole('checkbox', { name: `Seleccionar BB-SELLO-DEMO-${number}` })).toBeEnabled();
    for (const id of ['BB-SELLO-DEMO-004', 'BB-SELLO-DEMO-005', 'PFC-2026-002', 'BB-DEMO-001'])
      expect(within(modal).queryByRole('checkbox', { name: `Seleccionar ${id}` })).not.toBeInTheDocument();
    expect(within(modal).queryByRole('columnheader', { name: t('inventorySealReadiness') })).not.toBeInTheDocument();
    fireEvent.click(within(modal).getByRole('button', { name: t('inventorySelectFiltered') }));
    expect(within(modal).getByText('Unidades seleccionadas: 3')).toBeInTheDocument();
    fireEvent.click(within(modal).getByRole('button', { name: t('inventoryDeselect') }));
    fireEvent.click(within(modal).getByRole('button', { name: t('next') }));
    expect(screen.getByRole('alert', { name: t('requiredFields') })).toHaveTextContent(t('inventorySelectionRequired'));
  });
  it('retains only non-reactive preselection for seals, while disposal still accepts reactive rows', async () => {
    const { unmount } = render(<InventoryPage api={instance()} />);
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Seleccionar BB-SELLO-DEMO-001' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar BB-SELLO-DEMO-004' }));
    fireEvent.click(screen.getByRole('button', { name: t('inventoryQualitySeal') }));
    const modal = screen.getByRole('dialog');
    expect(within(modal).getByRole('checkbox', { name: 'Seleccionar BB-SELLO-DEMO-001' })).toBeChecked();
    expect(within(modal).getByText('Unidades seleccionadas: 1')).toBeInTheDocument();
    expect(within(modal).getByText(t('inventorySealSelectionHelp'))).toBeInTheDocument();
    unmount();
    render(<InventoryPage api={instance()} />);
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Seleccionar BB-SELLO-DEMO-004' }));
    fireEvent.click(screen.getByRole('button', { name: t('inventoryDispose') }));
    expect(
      within(screen.getByRole('dialog')).getByRole('checkbox', { name: 'Seleccionar BB-SELLO-DEMO-004' }),
    ).toBeChecked();
  });
  it('requests one print for multiple units and never marks APTO before explicit confirmation', async () => {
    seedInventoryReadyUnits();
    const api = createMockInventoryApi();
    const units = (await api.list()).units.filter((unit) => unit.id.startsWith('PFC-'));
    const close = vi.fn();
    render(
      <InventoryWorkflow
        initial={sealOperation(units)}
        units={units}
        api={api}
        onClose={close}
        onSaved={vi.fn()}
        t={t}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: t('next') }));
    const print = await screen.findByRole('button', {
      name: t('inventoryPrintSeals'),
    });
    expect(print).toHaveClass('cds--btn--ghost');
    expect(print.closest('.cds--modal-footer')?.firstElementChild).toContainElement(print);
    expect(screen.getByRole('button', { name: t('previous') })).toBeDisabled();
    expect(screen.getByRole('button', { name: t('inventoryConfirmPrinting') })).toBeDisabled();
    fireEvent.click(print);
    fireEvent.click(print);
    await waitFor(() => expect(printDocument).toHaveBeenCalledOnce());
    expect(print).toBeDisabled();
    expect((await api.list()).units.filter((unit) => unit.status === 'APTO')).toHaveLength(0);
    fireEvent.click(screen.getByLabelText(t('inventoryPrintConfirmed')));
    fireEvent.click(screen.getByRole('button', { name: t('inventoryConfirmPrinting') }));
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect((await api.list()).units.filter((unit) => unit.status === 'APTO')).toHaveLength(2);
    expect(showSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        title: t('inventorySealsCompleted'),
        timeoutInMs: 5000,
      }),
    );
  });
  it('resumes a print request without offering reprint, including after print errors/cancellation', async () => {
    seedInventoryReadyUnits();
    const api = createMockInventoryApi();
    const units = (await api.list()).units.filter((unit) => unit.id.startsWith('PFC-'));
    const prepared = await api.prepareSeal(sealOperation(units));
    vi.mocked(printDocument).mockImplementationOnce(() => {
      throw new Error('private printer trace');
    });
    const { unmount } = render(
      <InventoryWorkflow initial={prepared} units={units} api={api} onClose={vi.fn()} onSaved={vi.fn()} t={t} />,
    );
    fireEvent.click(screen.getByRole('button', { name: t('inventoryPrintSeals') }));
    await screen.findByText(t('printFailed'));
    expect(screen.queryByText('private printer trace')).not.toBeInTheDocument();
    expect((await api.list()).units.every((unit) => unit.status !== 'APTO')).toBe(true);
    const requested = (await api.list()).operations[0];
    unmount();
    render(<InventoryWorkflow initial={requested} units={units} api={api} onClose={vi.fn()} onSaved={vi.fn()} t={t} />);
    expect(screen.getByRole('button', { name: t('inventoryPrintSeals') })).toBeDisabled();
    expect(screen.getByRole('button', { name: t('inventoryConfirmPrinting') })).toBeDisabled();
    expect(screen.getByText(t('inventoryPrintConfirmationHelp'))).toBeInTheDocument();
  });
  it('saves a partial draft through the two-action X dialog and resumes through history', async () => {
    render(<InventoryPage api={instance()} />);
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Seleccionar PFC-2026-002' }));
    fireEvent.click(screen.getByRole('button', { name: t('inventoryDispose') }));
    let modal = screen.getByRole('dialog');
    fireEvent.click(within(modal).getByRole('button', { name: t('next') }));
    await screen.findByLabelText(t('inventoryServiceResponsible'));
    fireEvent.change(within(modal).getByLabelText(t('inventoryServiceResponsible')), {
      target: { value: 'Edición DEMO' },
    });
    fireEvent.click(within(modal).getByRole('button', { name: t('close') }));
    const exit = screen.getByRole('dialog', { name: t('exitTitle') });
    expect(within(exit.querySelector('.cds--modal-footer') as HTMLElement).getAllByRole('button')).toHaveLength(2);
    fireEvent.click(within(exit).getByRole('button', { name: t('leave') }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: t('inventoryHistory') }));
    fireEvent.click(screen.getByRole('button', { name: t('inventoryResume') }));
    modal = screen.getByRole('dialog');
    expect(within(modal).getByRole('checkbox', { name: 'Seleccionar PFC-2026-002' })).toBeChecked();
    fireEvent.click(within(modal).getByRole('button', { name: t('next') }));
    expect(await screen.findByLabelText(t('inventoryServiceResponsible'))).toHaveValue('Edición DEMO');
  });
  it('keeps units until final disposal confirmation; retains the printable act after stock exit', async () => {
    const api = createMockInventoryApi();
    const unit = (await api.list()).units.find((item) => item.id === 'PFC-2026-002');
    if (!unit) throw new Error('TEST_FIXTURE_MISSING');
    const draft = await api.saveDraft(disposalOperation([unit]));
    render(<InventoryPage api={{ ...mockBloodBankApi, inventory: api }} />);
    await screen.findByText(unit.id);
    fireEvent.click(screen.getByRole('button', { name: t('inventoryHistory') }));
    fireEvent.click(screen.getByRole('button', { name: t('inventoryResume') }));
    fireEvent.click(screen.getByRole('button', { name: t('next') }));
    await screen.findByLabelText(t('inventoryServiceResponsible'));
    fireEvent.click(screen.getByRole('button', { name: t('next') }));
    await screen.findByRole('button', { name: t('inventoryRegisterAct') });
    const reviewPrint = screen.getByRole('button', { name: t('inventoryPrintAct') });
    expect(reviewPrint).toHaveClass('cds--btn--ghost');
    expect(reviewPrint.closest('.cds--modal-footer')?.firstElementChild).toContainElement(reviewPrint);
    expect(reviewPrint.closest('.cds--modal-content')).toBeNull();
    expect(screen.getByText(t('inventoryDraftAct'))).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: t('inventoryPrintAct') }));
    expect(printDocument).toHaveBeenCalledOnce();
    expect((await api.list()).operations[0].stage).toBe('draft');
    expect((await api.list()).units.some((item) => item.id === unit.id)).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: t('inventoryRegisterAct') }));
    let warning = screen.getByRole('dialog', {
      name: t('inventoryConfirmDisposal'),
    });
    fireEvent.click(within(warning).getByRole('button', { name: t('keepEditing') }));
    expect((await api.list()).units.some((item) => item.id === unit.id)).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: t('inventoryRegisterAct') }));
    warning = screen.getByRole('dialog', {
      name: t('inventoryConfirmDisposal'),
    });
    fireEvent.click(within(warning).getByRole('button', { name: t('inventoryRegisterAct') }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.queryByText(unit.id)).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: t('inventoryHistory') }));
    fireEvent.change(within(screen.getByRole('dialog')).getByLabelText(t('search')), { target: { value: draft.id } });
    fireEvent.click(screen.getByRole('button', { name: t('inventoryView') }));
    expect(screen.getByText(t('inventoryActIntroduction'))).toBeInTheDocument();
    expect(screen.getAllByText(t('inventoryEliminated')).length).toBeGreaterThan(0);
    expect(screen.queryByText(t('inventoryDraftAct'))).not.toBeInTheDocument();
    const print = screen.getByRole('button', { name: t('inventoryPrintAct') });
    expect(print).toHaveClass('cds--btn--ghost');
    expect(print.closest('.cds--modal-footer')?.firstElementChild).toContainElement(print);
    expect(print.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    fireEvent.click(print);
    expect(printDocument).toHaveBeenCalledTimes(2);
    expect(
      within(screen.getByRole('dialog')).getAllByRole('button', {
        name: t('close'),
      }),
    ).toHaveLength(1);
  });
  it('saves selected units before details and requires one BPMN dropdown cause per unit before review', async () => {
    const api = createMockInventoryApi();
    const units = (await api.list()).units.slice(0, 2);
    render(
      <InventoryWorkflow
        initial={newInventoryOperation('disposal', units)}
        units={units}
        api={api}
        onClose={vi.fn()}
        onSaved={vi.fn()}
        t={t}
      />,
    );
    expect(screen.queryByLabelText(t('inventoryServiceResponsible'))).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: t('next') }));
    await screen.findByLabelText(t('inventoryServiceResponsible'));
    const savedSelection = (await api.list()).operations[0];
    expect(savedSelection.units.map((unit) => unit.id)).toEqual(units.map((unit) => unit.id));
    expect(savedSelection.causes).toEqual(Object.fromEntries(units.map((unit) => [unit.id, ''])));
    expect(savedSelection.stage).toBe('draft');
    for (const [field, value] of [
      ['inventoryServiceResponsible', 'Responsable DEMO'],
      ['inventoryEpidemiologyResponsible', 'Epidemiología DEMO'],
      ['inventoryWitnesses', 'Testigo DEMO'],
    ])
      fireEvent.change(screen.getByLabelText(t(field)), { target: { value } });
    for (const unit of units) {
      const dropdown = screen.getByLabelText(`${t('inventoryDisposalCause')} — ${unit.id}`);
      expect(
        within(dropdown)
          .getAllByRole('option')
          .map((option) => (option as HTMLOptionElement).value),
      ).toEqual(['', ...disposalCauses]);
    }
    fireEvent.change(screen.getByLabelText(`${t('inventoryDisposalCause')} — ${units[0].id}`), {
      target: { value: 'hemolysis' },
    });
    fireEvent.click(screen.getByRole('button', { name: t('next') }));
    expect(screen.getByRole('alert', { name: t('requiredFields') })).toHaveTextContent(t('inventoryCausesRequired'));
    expect(screen.queryByRole('button', { name: t('inventoryPrintAct') })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(`${t('inventoryDisposalCause')} — ${units[1].id}`), {
      target: { value: 'coldChainBreak' },
    });
    fireEvent.click(screen.getByRole('button', { name: t('next') }));
    await screen.findByRole('button', { name: t('inventoryPrintAct') });
    expect((await api.list()).operations[0].causes).toEqual({
      [units[0].id]: 'hemolysis',
      [units[1].id]: 'coldChainBreak',
    });
    fireEvent.click(screen.getByRole('button', { name: t('previous') }));
    expect(screen.getByLabelText(`${t('inventoryDisposalCause')} — ${units[1].id}`)).toHaveValue('coldChainBreak');
  });
  it('handles review print failures safely without registering an act or removing units', async () => {
    const api = createMockInventoryApi();
    const units = (await api.list()).units.slice(0, 1);
    render(
      <InventoryWorkflow
        initial={disposalOperation(units)}
        units={units}
        api={api}
        onClose={vi.fn()}
        onSaved={vi.fn()}
        t={t}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: t('next') }));
    await screen.findByLabelText(t('inventoryServiceResponsible'));
    fireEvent.click(screen.getByRole('button', { name: t('next') }));
    const print = await screen.findByRole('button', { name: t('inventoryPrintAct') });
    vi.mocked(printDocument).mockImplementationOnce((_content, _title, onError) => onError?.());
    fireEvent.click(print);
    await screen.findByText(t('printFailed'));
    expect((await api.list()).operations[0].stage).toBe('draft');
    expect((await api.list()).units.some((unit) => unit.id === units[0].id)).toBe(true);
    vi.mocked(printDocument).mockImplementationOnce(() => {
      throw new Error('private printer trace');
    });
    fireEvent.click(print);
    expect(screen.getByText(t('printFailed'))).toBeInTheDocument();
    expect(screen.queryByText('private printer trace')).not.toBeInTheDocument();
  });
  it('preserves a historical free-text cause but requires a catalog choice when resuming a legacy draft', async () => {
    const api = createMockInventoryApi();
    const units = (await api.list()).units.slice(0, 1);
    const operation = { ...disposalOperation(units), causes: { [units[0].id]: 'Causa anterior DEMO' } };
    const { unmount } = render(<DisposalAct operation={{ ...operation, stage: 'completed' }} print t={t} />);
    expect(screen.getByText('Causa anterior DEMO')).toBeInTheDocument();
    expect(document.querySelectorAll('[data-act-blank]')).toHaveLength(19);
    expect(document.querySelectorAll('[data-signature]')).toHaveLength(2);
    unmount();
    render(<InventoryWorkflow initial={operation} units={units} api={api} onClose={vi.fn()} onSaved={vi.fn()} t={t} />);
    fireEvent.click(screen.getByRole('button', { name: t('next') }));
    await screen.findByLabelText(t('inventoryServiceResponsible'));
    expect(screen.getByRole('option', { name: `${t('inventoryPreviousCause')}: Causa anterior DEMO` })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: t('next') }));
    expect(screen.getByRole('alert', { name: t('requiredFields') })).toHaveTextContent(t('inventoryCausesRequired'));
    fireEvent.change(screen.getByLabelText(`${t('inventoryDisposalCause')} — ${units[0].id}`), {
      target: { value: 'expired' },
    });
    fireEvent.click(screen.getByRole('button', { name: t('next') }));
    await screen.findByRole('button', { name: t('inventoryPrintAct') });
    expect(screen.getByText(t('inventoryCause_expired'))).toBeInTheDocument();
  });
  it('disables actions while loading or failed and allows a safe retry', async () => {
    const api = instance();
    const list = vi.spyOn(api.inventory, 'list').mockRejectedValueOnce(new Error('private backend trace'));
    render(<InventoryPage api={api} />);
    expect(screen.getByRole('button', { name: t('inventoryDispose') })).toBeDisabled();
    await screen.findByText(t('loadFailed'));
    expect(screen.queryByText('private backend trace')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: t('retry') }));
    await screen.findByText('PFC-2026-002');
    expect(screen.getByRole('button', { name: t('inventoryDispose') })).toBeEnabled();
    expect(list).toHaveBeenCalledTimes(2);
  });
  it('does not report save success or close on storage failure', async () => {
    const api = createMockInventoryApi();
    const units = (await api.list()).units;
    vi.spyOn(api, 'saveDraft').mockRejectedValue(new Error('secret stack'));
    const close = vi.fn();
    render(
      <InventoryWorkflow
        initial={newInventoryOperation('disposal', [units[0]])}
        units={units}
        api={api}
        onClose={close}
        onSaved={vi.fn()}
        t={t}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: t('close') }));
    fireEvent.click(screen.getByRole('button', { name: t('leave') }));
    await screen.findByText(t('inventorySaveFailed'));
    expect(close).not.toHaveBeenCalled();
    expect(showSnackbar).not.toHaveBeenCalled();
    expect(screen.queryByText('secret stack')).not.toBeInTheDocument();
  });
  it('renders exactly one seal per unit and escapes user text in the retained act', async () => {
    const units = (await createMockInventoryApi().list()).units;
    const { container, unmount } = render(<QualitySeals operation={sealOperation(units.slice(0, 2))} print t={t} />);
    expect(container.querySelectorAll('[data-quality-seal]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-demo]')).toHaveLength(2);
    unmount();
    render(
      <DisposalAct
        operation={{
          ...disposalOperation([units[0]]),
          witnesses: '<script>synthetic</script>',
        }}
        print
        t={t}
      />,
    );
    expect(screen.getByText('<script>synthetic</script>')).toBeInTheDocument();
    expect(document.querySelector('[data-disposal-act] script')).not.toBeInTheDocument();
  });
  it('provides both English and Spanish for every new inventory string', () => {
    for (const key of Object.keys(spanish.processing).filter((key) => key.startsWith('inventory'))) {
      expect((english.processing as Record<string, string>)[key], key).toBeTruthy();
      expect(t(key)).not.toBe(key);
    }
  });
  it('keeps page-counter CSS in the print document only and escapes act data', async () => {
    const units = (await createMockInventoryApi().list()).units.slice(0, 1);
    const operation = { ...disposalOperation(units), witnesses: '<script>synthetic</script>' };
    const { container, rerender } = render(<DisposalAct operation={operation} print t={t} />);
    expect(container.querySelector('style')?.textContent).toContain('content: counter(page) " / " counter(pages)');
    expect(container.innerHTML).toContain('&lt;script&gt;synthetic&lt;/script&gt;');
    expect(container.querySelector('script')).toBeNull();
    rerender(<DisposalAct operation={operation} t={t} />);
    expect(container.querySelector('style')).toBeNull();
  });
});
