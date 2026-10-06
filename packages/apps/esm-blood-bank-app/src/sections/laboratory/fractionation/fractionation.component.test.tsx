import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { showSnackbar } from '@openmrs/esm-framework';
import spanish from '../../../../translations/es.json';
import english from '../../../../translations/en.json';
import { createMockFractionationApi } from '../../../api/mock-fractionation.api';
import { openmrsFractionationApi } from '../../../api/fractionation.api';
import { FractionationPage } from './fractionation-page.component';
import { FractionationWorkflow } from './fractionation-workflow.component';
import { FractionationLabels } from './fractionation-documents.component';
import { finalNodes } from './fractionation-rules';
import { reviewBatch } from './fractionation-test-fixtures';
import { printDocument } from '../../../shared/print-document';

vi.mock('@openmrs/esm-framework', () => ({
  useSession: () => ({ sessionLocation: { display: 'Hospital DEMO' } }),
  formatDatetime: () => '05 oct 2026, 13:47',
  showSnackbar: vi.fn(),
  PageHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  PageHeaderContent: ({ title }: { title: string }) => <div>{title}</div>,
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }) }));
vi.mock('../../../shared/print-document', () => ({ printDocument: vi.fn() }));
const t = (key: string) => (spanish.processing as Record<string, string>)[key] ?? key;

describe('fractionation UI', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });
  it('supports homogeneous row selection, disables other types, and exposes accessible history/action icons', async () => {
    render(<FractionationPage api={createMockFractionationApi()} />);
    const first = await screen.findByRole('checkbox', { name: 'Seleccionar PFC-2026-002' });
    expect(screen.getByRole('button', { name: t('fractionate') })).toBeDisabled();
    fireEvent.click(first);
    const second = screen.getByRole('checkbox', { name: 'Seleccionar PFC-2026-003' });
    expect(second).toBeEnabled();
    fireEvent.click(second);
    const whole = screen.getAllByRole('checkbox').find((checkbox) => !checkbox.getAttribute('id')?.includes('PFC'));
    expect(whole).toBeDisabled();
    expect(screen.getByRole('button', { name: t('fractionate') })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: t('fractionationDeselect') }));
    expect(first).not.toBeChecked();
    expect(second).not.toBeChecked();
    expect(whole).toBeEnabled();
    expect(screen.getByRole('button', { name: t('fractionate') })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Fraccionar — PFC-2026-002' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: /Limpiar filtros/ })).not.toBeInTheDocument();
    for (const key of ['fractionate', 'fractionationHistory'])
      expect(screen.getByRole('button', { name: t(key) }).querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    fireEvent.change(screen.getByLabelText(t('fractionationComponent')), { target: { value: 'wholeBlood' } });
    expect(screen.queryByRole('checkbox', { name: 'Seleccionar PFC-2026-002' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('fractionate') })).toBeDisabled();
  });
  it('starts only the row source even when a different component is selected for the batch', async () => {
    const api = createMockFractionationApi();
    const start = vi.spyOn(api, 'start');
    const source = (await api.list()).units.find((unit) => unit.component === 'wholeBlood');
    render(<FractionationPage api={api} />);
    fireEvent.click(await screen.findByRole('checkbox', { name: `Seleccionar ${source?.code}` }));
    expect(screen.getByRole('checkbox', { name: 'Seleccionar PFC-2026-002' })).toBeDisabled();
    const rowAction = screen.getByRole('button', { name: 'Fraccionar — PFC-2026-002' });
    expect(rowAction).toBeEnabled();
    expect(rowAction.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    fireEvent.click(rowAction);
    await screen.findByRole('dialog');
    expect(start).toHaveBeenCalledExactlyOnceWith(['PFC-2026-002']);
    const data = await api.list();
    expect(data.batches[0].sources).toHaveLength(1);
    expect(data.units.find((unit) => unit.id === source?.id)?.state).not.toBe('inLaboratory');
    expect(data.units.find((unit) => unit.id === 'PFC-2026-002')?.state).toBe('inLaboratory');
    expect(screen.queryByRole('button', { name: t('saveDraft') })).not.toBeInTheDocument();
  });
  it('locks all division options until undo clears the branch and then removes undo', async () => {
    const api = createMockFractionationApi();
    const source = (await api.list()).units.find((unit) => unit.component === 'wholeBlood');
    if (!source) throw new Error('Missing synthetic whole-blood fixture');
    const initial = await api.start([source.id]);
    render(<FractionationWorkflow initial={initial} api={api} onClose={vi.fn()} onSaved={vi.fn()} t={t} />);
    const root = screen.getByRole('button', { name: `Dividir — ${source.code}` });
    expect(screen.queryByRole('button', { name: t('fractionationClearBranch') })).not.toBeInTheDocument();
    fireEvent.click(root);
    expect(root).toBeDisabled();
    const plasma = screen.getByRole('button', { name: `${t('fractionationUsePFC')} — ${source.code}-PRP` });
    const alternative = screen.getByRole('button', { name: `${t('fractionationUsePlasma24')} — ${source.code}-PRP` });
    fireEvent.click(plasma);
    expect(plasma).toBeDisabled();
    expect(alternative).toBeDisabled();
    const plasmaNode = plasma.closest('li') as HTMLElement;
    fireEvent.click(within(plasmaNode).getByRole('button', { name: t('fractionationClearBranch') }));
    expect(plasma).toBeEnabled();
    expect(alternative).toBeEnabled();
    expect(within(plasmaNode).queryByRole('button', { name: t('fractionationClearBranch') })).not.toBeInTheDocument();
    expect(screen.queryByText(`${source.code}-PRP-PFC`)).not.toBeInTheDocument();
    fireEvent.click(alternative);
    expect(screen.getByText(`${source.code}-PRP-P24`)).toBeInTheDocument();
    expect(alternative).toBeDisabled();
    const rootNode = root.closest('li') as HTMLElement;
    fireEvent.click(within(rootNode).getAllByRole('button', { name: t('fractionationClearBranch') })[0]);
    expect(root).toBeEnabled();
    expect(screen.queryByText(`${source.code}-PRP-P24`)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t('fractionationClearBranch') })).not.toBeInTheDocument();
  });
  it('starts a process, saves a partial tree and resumes after the two-action exit confirmation', async () => {
    const api = createMockFractionationApi();
    render(<FractionationPage api={api} />);
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Seleccionar PFC-2026-002' }));
    fireEvent.click(screen.getByRole('button', { name: t('fractionate') }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByRole('button', { name: t('saveDraft') })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: t('next') })).toBeEnabled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Dividir — PFC-2026-002' }));
    fireEvent.change(screen.getByLabelText(t('fractionationOperator')), { target: { value: 'Operador DEMO' } });
    fireEvent.click(within(dialog).getByRole('button', { name: t('close') }));
    const exit = screen.getByRole('dialog', { name: t('exitTitle') });
    expect(exit).toBeDefined();
    const buttons = within(exit.querySelector('.cds--modal-footer') as HTMLElement).getAllByRole('button');
    expect(buttons).toHaveLength(2);
    fireEvent.click(within(exit as HTMLElement).getByRole('button', { name: t('leave') }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const saved = (await api.list()).batches[0];
    expect(saved.operator).toBe('Operador DEMO');
    expect(saved.nodes).toHaveLength(3);
    fireEvent.click(await screen.findByRole('button', { name: t('fractionationResume') }));
    expect(screen.getByLabelText(t('fractionationOperator'))).toHaveValue('Operador DEMO');
    expect(screen.getByText(t('componentCryo'))).toBeInTheDocument();
  });
  it('saves and advances to labels without forcing the PRP branch to be divided', async () => {
    const api = createMockFractionationApi();
    const source = (await api.list()).units.find((unit) => unit.component === 'wholeBlood');
    if (!source) throw new Error('Missing synthetic whole-blood fixture');
    const initial = await api.start([source.id]);
    render(<FractionationWorkflow initial={initial} api={api} onClose={vi.fn()} onSaved={vi.fn()} t={t} />);
    fireEvent.change(screen.getByLabelText(t('fractionationOperator')), { target: { value: 'Profesional DEMO' } });
    fireEvent.change(screen.getByLabelText(t('fractionationService')), { target: { value: 'Laboratorio DEMO' } });
    fireEvent.change(screen.getByLabelText(t('fractionationSystem')), { target: { value: 'closed' } });
    fireEvent.click(screen.getByRole('button', { name: `Dividir — ${source.code}` }));
    fireEvent.click(screen.getByRole('button', { name: t('next') }));
    expect(await screen.findAllByLabelText(t('fractionationVolumeEstimated'))).toHaveLength(2);
    expect(screen.getByRole('region', { name: `${source.code}-PRP` })).toHaveTextContent(t('componentPRP'));
    expect(screen.queryByText(t('fractionationFinishBranches'))).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('previous') })).toBeEnabled();
    const saved = (await api.list()).batches[0];
    expect(saved.completedSteps).toEqual(['fractionationPlan']);
    expect(finalNodes(saved).map((node) => node.component)).toEqual(['redCells', 'plateletRichPlasma']);
  });
  it('keeps the two-action X confirmation and can discard only unsaved edits', async () => {
    const api = createMockFractionationApi();
    const initial = await api.start(['PFC-2026-002']);
    const save = vi.spyOn(api, 'save');
    const close = vi.fn();
    render(<FractionationWorkflow initial={initial} api={api} onClose={close} onSaved={vi.fn()} t={t} />);
    fireEvent.change(screen.getByLabelText(t('fractionationOperator')), { target: { value: 'Edición DEMO' } });
    fireEvent.click(screen.getByRole('button', { name: t('close') }));
    let exit = screen.getByRole('dialog', { name: t('exitTitle') });
    fireEvent.click(within(exit).getByRole('button', { name: t('keepEditing') }));
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByLabelText(t('fractionationOperator'))).toHaveValue('Edición DEMO');
    fireEvent.click(screen.getByRole('button', { name: t('close') }));
    exit = screen.getByRole('dialog', { name: t('exitTitle') });
    fireEvent.click(within(exit).getByRole('checkbox', { name: t('saveBeforeExit') }));
    fireEvent.click(within(exit).getByRole('button', { name: new RegExp(`${t('leave')}$`) }));
    expect(close).toHaveBeenCalledOnce();
    expect(save).not.toHaveBeenCalled();
    expect((await api.list()).batches[0]).toEqual(initial);
  });
  it('does not finalize before confirmation; cancellation keeps origins in laboratory and acceptance quarantines results', async () => {
    const api = createMockFractionationApi();
    const ready = await reviewBatch(api, await api.start(['PFC-2026-002']));
    ready.finalChecks = false;
    const finalize = vi.spyOn(api, 'finalize');
    const close = vi.fn();
    render(<FractionationWorkflow initial={ready} api={api} onClose={close} onSaved={vi.fn()} t={t} />);
    fireEvent.click(screen.getByRole('button', { name: t('fractionationFinish') }));
    expect(finalize).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(t('fractionationFinalChecksRequired'));
    fireEvent.click(screen.getByLabelText(t('fractionationFinalChecked')));
    fireEvent.click(screen.getByRole('button', { name: t('fractionationFinish') }));
    const warning = screen.getByRole('dialog', { name: t('fractionationFinalWarning') });
    expect(within(warning).getByText(t('fractionationFinalWarningHelp'))).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: t('fractionationFinalWarning') })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: t('exitTitle') })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: t('fractionationFinish') }));
    const secondWarning = screen.getByRole('dialog', { name: t('fractionationFinalWarning') });
    fireEvent.click(within(secondWarning).getByRole('button', { name: t('fractionationKeepReviewing') }));
    expect(finalize).not.toHaveBeenCalled();
    expect((await api.list()).units.find((unit) => unit.id === 'PFC-2026-002')?.state).toBe('inLaboratory');
    fireEvent.click(screen.getByRole('button', { name: t('fractionationFinish') }));
    fireEvent.click(screen.getByRole('button', { name: t('fractionationConfirm') }));
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect((await api.list()).units.filter((unit) => unit.parentId).every((unit) => unit.state === 'quarantine')).toBe(
      true,
    );
    expect(showSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ title: t('fractionationFinalized'), timeoutInMs: 5000 }),
    );
  });
  it('keeps searchable history read-only, closes only with header X and prints final labels with an icon', async () => {
    const api = createMockFractionationApi();
    await api.finalize(await reviewBatch(api, await api.start(['PFC-2026-002'])));
    render(<FractionationPage api={api} />);
    await screen.findByText('PFC-2026-003');
    fireEvent.click(screen.getByRole('button', { name: t('fractionationHistory') }));
    const history = screen.getByRole('dialog');
    expect(history.querySelector('.cds--modal-footer')).not.toBeInTheDocument();
    fireEvent.change(within(history).getByLabelText(t('search')), { target: { value: 'missing' } });
    expect(within(history).queryByRole('button', { name: t('fractionationView') })).not.toBeInTheDocument();
    fireEvent.change(within(history).getByLabelText(t('search')), { target: { value: 'PFC-2026-002-CRIO' } });
    fireEvent.click(within(history).getByRole('button', { name: t('fractionationView') }));
    expect(within(history).queryByRole('button', { name: t('fractionate') })).not.toBeInTheDocument();
    expect(within(history).getAllByRole('button', { name: t('close') })).toHaveLength(1);
    const back = within(history).getByRole('button', { name: t('backToHistory') });
    expect(back.firstElementChild?.tagName.toLowerCase()).toBe('svg');
    expect(back.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    const print = within(history).getByRole('button', { name: t('fractionationPrint') });
    expect(print.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    fireEvent.click(print);
    expect(printDocument).toHaveBeenCalledOnce();
    fireEvent.click(back);
    expect(within(history).getByLabelText(t('search'))).toHaveValue('PFC-2026-002-CRIO');
    expect(within(history).getByRole('button', { name: t('fractionationView') })).toBeInTheDocument();
  });
  it('renders a safe missing-backend error and permits retry, without showing internal details', async () => {
    render(<FractionationPage api={openmrsFractionationApi} />);
    expect(await screen.findByText(t('loadFailed'))).toBeInTheDocument();
    expect(screen.queryByText('BACKEND_NOT_IMPLEMENTED')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('retry') })).toBeEnabled();
    expect(screen.getByRole('button', { name: t('fractionate') })).toBeDisabled();
  });
  it('keeps internal pointer focus stable without swallowing keyboard blur events', async () => {
    const api = createMockFractionationApi();
    const initial = await api.start(['PFC-2026-002']);
    const blur = vi.fn();
    render(
      <div role="group" onBlur={blur}>
        <FractionationWorkflow initial={initial} api={api} onClose={vi.fn()} onSaved={vi.fn()} t={t} />
      </div>,
    );
    const field = screen.getByLabelText(t('fractionationOperator'));
    const button = screen.getByRole('button', { name: 'Dividir — PFC-2026-002' });
    fireEvent.pointerDown(button);
    fireEvent.blur(field, { relatedTarget: button });
    expect(blur).not.toHaveBeenCalled();
    fireEvent.pointerUp(button);
    fireEvent.blur(field, { relatedTarget: button });
    expect(blur).toHaveBeenCalledOnce();
    fireEvent.click(button);
    expect(screen.getByText('PFC-2026-002-CRIO')).toBeInTheDocument();
  });
  it('keeps edits after failed draft persistence and never announces success or displays technical details', async () => {
    const api = createMockFractionationApi();
    const initial = await api.start(['PFC-2026-002']);
    const failing = { ...api, save: vi.fn().mockRejectedValue(new Error('PRIVATE_BACKEND_TRACE')) };
    render(<FractionationWorkflow initial={initial} api={failing} onClose={vi.fn()} onSaved={vi.fn()} t={t} />);
    fireEvent.change(screen.getByLabelText(t('fractionationOperator')), { target: { value: 'Edición DEMO' } });
    fireEvent.click(screen.getByRole('button', { name: t('close') }));
    const exit = screen.getByRole('dialog', { name: t('exitTitle') });
    fireEvent.click(within(exit).getByRole('button', { name: t('leave') }));
    expect(await screen.findByText(t('fractionationSaveFailed'))).toBeInTheDocument();
    expect(screen.getByLabelText(t('fractionationOperator'))).toHaveValue('Edición DEMO');
    expect(screen.queryByText('PRIVATE_BACKEND_TRACE')).not.toBeInTheDocument();
    expect(showSnackbar).not.toHaveBeenCalled();
  });
  it('keeps source traceability and conditional final-label content, while escaping untrusted text', async () => {
    const api = createMockFractionationApi();
    const batch = await reviewBatch(api, await api.start(['PFC-2026-002']));
    for (const node of finalNodes(batch)) {
      node.label.autologous = true;
      node.label.recipientName = '<script>private</script>';
      node.label.recipientDocument = '90000099';
    }
    const { container } = render(<FractionationLabels batch={batch} actual t={t} />);
    expect(container.querySelector('script')).toBeNull();
    expect(screen.getAllByText(t('fractionationAutologousOnly'))).toHaveLength(2);
    expect(screen.getAllByText('ST-DEMO-002')).toHaveLength(2);
    expect(screen.getAllByText(t('printPrototype'))).toHaveLength(2);
    expect(screen.getAllByText(t('fractionationInfectionWarning'))).toHaveLength(2);
  });
  it('keeps EN/ES keys in parity for all new fractionation content', () => {
    expect(Object.keys(spanish.processing).sort()).toEqual(Object.keys(english.processing).sort());
  });
});
