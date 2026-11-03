import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import spanish from '../../../translations/es.json';
import { createMockFollowUpApi } from '../../api/mock-follow-up.api';
import { printDocument } from '../../shared/print-document';
import { FollowUpPage } from './follow-up-page.component';
import { FollowUpReport } from './follow-up-report.component';
import { FollowUpWorkflow } from './follow-up-workflow.component';

vi.mock('@openmrs/esm-framework', () => ({
  useSession: () => ({ sessionLocation: { display: 'Hospital DEMO' } }),
  formatDatetime: () => '31 oct 2026, 12:00',
  showSnackbar: vi.fn(),
  PageHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  PageHeaderContent: ({ title }: { title: string }) => <div>{title}</div>,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));
vi.mock('../../shared/print-document', () => ({ printDocument: vi.fn() }));
const t = (key: string) =>
  (spanish.followUp as Record<string, string>)[key] ?? (spanish.processing as Record<string, string>)[key] ?? key;

describe('follow-up inboxes, detail, history and PRONAHEBAS forms', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });
  it.each(['donor', 'recipient'] as const)(
    'shows independent %s inbox, history and new-case actions with icons',
    async (kind) => {
      render(<FollowUpPage kind={kind} api={createMockFollowUpApi()} />);
      const table = await screen.findByRole('table', { name: t('openCases') });
      expect(within(table).getByText(kind === 'donor' ? 'Receptor Uno DEMO' : 'Donante Alfa DEMO')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: t('history') }).querySelector('svg')).toBeTruthy();
      expect(screen.getByRole('button', { name: t('newCase') }).querySelector('svg')).toBeTruthy();
      fireEvent.change(screen.getByRole('searchbox', { name: t('searchCases') }), { target: { value: 'no-match' } });
      expect(screen.queryByRole('button', { name: t('viewCase') })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: t('history') }));
      const dialog = screen.getByRole('dialog', { name: t('history') });
      expect(within(dialog).getByRole('button', { name: t('viewCase') })).toBeInTheDocument();
      expect(within(dialog).queryByRole('button', { name: t('close') })).toBeInTheDocument();
      expect(within(dialog).getAllByRole('button', { name: t('close') })).toHaveLength(1);
      fireEvent.change(within(dialog).getByLabelText(t('from')), {
        target: { value: '2026-10-31' },
      });
      fireEvent.change(within(dialog).getByLabelText(t('to')), {
        target: { value: '2026-01-01' },
      });
      expect(within(dialog).queryByRole('table')).not.toBeInTheDocument();
    },
  );
  it('saves detection before tracing, prints without closing and requires all linked transfusions', async () => {
    const api = createMockFollowUpApi();
    const workspace = await api.list('donor');
    render(
      <FollowUpWorkflow
        initial={workspace.cases[0]}
        api={api}
        workspace={workspace}
        onSaved={vi.fn()}
        onClose={vi.fn()}
        t={t}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: t('saveContinue') }));
    await screen.findByRole('table', { name: t('traceTable') });
    fireEvent.click(screen.getByRole('button', { name: t('printReport') }));
    expect(printDocument).toHaveBeenCalledOnce();
    expect((await api.list('donor')).cases[0].status).toBe('open');
    fireEvent.click(screen.getByRole('button', { name: t('saveContinue') }));
    expect(await screen.findByRole('alert', { name: t('requiredFields') })).toHaveTextContent(t('traceAllRequired'));
  });
  it('keeps failed saves editable and never displays technical errors', async () => {
    const real = createMockFollowUpApi();
    const workspace = await real.list('donor');
    const save = vi.fn().mockRejectedValue(new Error('private endpoint or trace'));
    render(
      <FollowUpWorkflow
        initial={workspace.cases[0]}
        api={{ ...real, save }}
        workspace={workspace}
        onSaved={vi.fn()}
        onClose={vi.fn()}
        t={t}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: t('saveContinue') }));
    await screen.findByText(t('saveFailed'));
    expect(screen.queryByText('private endpoint or trace')).not.toBeInTheDocument();
    expect(screen.getByLabelText(t('reportedBy'))).not.toHaveAttribute('readonly');
  });
  it('uses the shared two-action exit and saves drafts when requested', async () => {
    const api = createMockFollowUpApi();
    const workspace = await api.list('recipient');
    const close = vi.fn();
    render(
      <FollowUpWorkflow
        initial={workspace.cases[0]}
        api={api}
        workspace={workspace}
        onSaved={vi.fn()}
        onClose={close}
        t={t}
      />,
    );
    fireEvent.change(screen.getByLabelText(t('notes')), {
      target: { value: 'Nota DEMO' },
    });
    fireEvent.click(screen.getByRole('button', { name: t('close') }));
    const dialog = screen.getByRole('dialog', { name: t('exitTitle') });
    expect(within(dialog).getByRole('checkbox')).toBeChecked();
    expect(within(dialog).getByRole('button', { name: t('keepEditing') })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: t('leave') }));
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect((await api.list('recipient')).cases[0].detection.notes).toBe('Nota DEMO');
  });
  it.each(['donor', 'recipient'] as const)(
    'keeps the %s report layout and source identity aligned with FR13/FR14',
    async (kind) => {
      const api = createMockFollowUpApi();
      const w = await api.list(kind);
      let record = await api.save(w.cases[0], true);
      record.traces = w.traces.filter(
        (row) => (kind === 'donor' ? row.recipient.id : row.donor.id) === record.detection.person.id,
      );
      record = await api.save(record, true);
      render(<FollowUpReport record={record} t={t} print />);
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(t(kind === 'donor' ? 'fr13' : 'fr14'));
      expect(screen.getAllByRole('table')).toHaveLength(3);
      expect(screen.getByText(t('syntheticPrint'))).toBeInTheDocument();
      expect(screen.getByRole('table', { name: t('originIdentity') })).toHaveTextContent(record.detection.person.name);
      expect(
        screen.getByRole('table', {
          name: t(kind === 'donor' ? 'relatedRecipients' : 'recipientAntecedents'),
        }),
      ).toBeInTheDocument();
    },
  );
});
