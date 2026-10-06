import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { showSnackbar } from '@openmrs/esm-framework';
import spanish from '../../../../translations/es.json';
import { createMockApplicantSelectionApi } from '../../../api/mock-applicant-selection.api';
import { createMockProcessingApi } from '../../../api/mock-blood-bank-processing.api';
import { ScreeningPage } from './screening-page.component';
import { localDateTime, screeningCategory } from './screening-rules';
import { screeningTests, type ScreeningCategory } from './screening.types';
import { printDocument } from '../../../shared/print-document';

vi.mock('@openmrs/esm-framework', () => ({
  useSession: () => ({ sessionLocation: { display: 'Hospital de prueba' } }),
  formatDatetime: () => '05 oct 2026, 13:47',
  showSnackbar: vi.fn(),
  PageHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  PageHeaderContent: ({ title }: { title: string }) => <div>{title}</div>,
  BloodBankPictogram: () => null,
  LaboratoryPictogram: () => null,
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }) }));
vi.mock('../../../shared/print-document', () => ({ printDocument: vi.fn() }));
const t = (key: string) => (spanish.processing as Record<string, string>)[key] ?? key;
const api = () => createMockProcessingApi(createMockApplicantSelectionApi()).screening;
async function validate(apiInstance: ReturnType<typeof api>, category: ScreeningCategory) {
  let record = (await apiInstance.listScreenings()).find((item) => screeningCategory(item) === category);
  if (!record) throw new Error('SYNTHETIC_SAMPLE_MISSING');
  record.identityVerified = true;
  record.receivedOn = localDateTime();
  record.receivedBy = 'DEMO';
  record.performedOn = localDateTime();
  record.performedBy = 'DEMO';
  record.validatedBy = 'DEMO';
  for (const test of screeningTests)
    record.tests[test] = { result: 'nonReactive', reagent: 'DEMO', brand: 'DEMO', lot: 'DEMO' };
  for (const step of ['reception', 'results', 'validation'] as const)
    record = await apiInstance.saveScreening(record, step);
  return record;
}
describe('independent screening queues and histories', () => {
  beforeEach(() => sessionStorage.clear());
  it('keeps named actions with decorative icons in both queues and apheresis registration only in donors', async () => {
    render(<ScreeningPage api={api()} />);
    await screen.findByText('M-DEMO-001');
    for (const key of ['reportHistory', 'registerApheresisSample']) {
      const button = screen.getByRole('button', { name: t(key) });
      expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    }
    fireEvent.click(screen.getByRole('tab', { name: t('followUpSamples') }));
    expect(screen.getByRole('button', { name: t('reportHistory') }).querySelector('svg')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    expect(screen.queryByRole('button', { name: t('registerApheresisSample') })).not.toBeInTheDocument();
  });
  it('separates donors/follow-ups and retains independent searches and source filters', async () => {
    render(<ScreeningPage api={api()} />);
    expect(await screen.findByText('M-DEMO-001')).toBeInTheDocument();
    expect(screen.queryByText('M-SEG-DEMO-001')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(t('search')), { target: { value: 'missing' } });
    fireEvent.click(screen.getByRole('tab', { name: t('followUpSamples') }));
    expect(await screen.findByText('M-SEG-DEMO-001')).toBeInTheDocument();
    expect(screen.getByLabelText(t('search'))).toHaveValue('');
    expect(screen.queryByRole('button', { name: t('registerApheresisSample') })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(t('sampleOrigin')), { target: { value: 'recipientFollowUp' } });
    expect(screen.queryByText('M-SEG-DEMO-001')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: t('donorSamples') }));
    expect(screen.getByLabelText(t('search'))).toHaveValue('missing');
    expect(screen.getByLabelText(t('sampleOrigin'))).toHaveValue('');
  });
  it('moves validated samples out of queues and isolates searchable read-only result histories', async () => {
    const instance = api();
    await validate(instance, 'donors');
    await validate(instance, 'followUps');
    render(<ScreeningPage api={instance} />);
    await waitFor(() => expect(screen.queryByRole('button', { name: t('registerResults') })).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: t('reportHistory') }));
    const history = screen.getByRole('dialog');
    expect(within(history).getAllByRole('button', { name: t('close') })).toHaveLength(1);
    expect(within(history).getByText('M-DEMO-001')).toBeInTheDocument();
    expect(within(history).queryByText('M-SEG-DEMO-001')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(t('searchReports')), { target: { value: 'missing' } });
    expect(within(history).queryByRole('button', { name: t('viewResults') })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(t('searchReports')), { target: { value: '90000020' } });
    fireEvent.click(screen.getByRole('button', { name: t('viewResults') }));
    expect(within(history).getByRole('heading', { name: t('results') })).toBeInTheDocument();
    expect(within(history).queryByRole('button', { name: t('validateResults') })).not.toBeInTheDocument();
    expect(within(history).getByRole('button', { name: t('printResults') }).querySelector('svg')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: t('printResults') }));
    expect(printDocument).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: t('backToHistory') }));
    expect(screen.getByLabelText(t('searchReports'))).toHaveValue('90000020');
    fireEvent.click(within(history).getByRole('button', { name: t('close') }));
    fireEvent.click(screen.getByRole('tab', { name: t('followUpSamples') }));
    fireEvent.click(screen.getByRole('button', { name: t('reportHistory') }));
    expect(within(screen.getByRole('dialog')).getByText('M-SEG-DEMO-001')).toBeInTheDocument();
    expect(within(screen.getByRole('dialog')).queryByText('M-DEMO-001')).not.toBeInTheDocument();
    const followUpHistory = screen.getByRole('dialog');
    expect(within(followUpHistory).getAllByRole('button', { name: t('close') })).toHaveLength(1);
    fireEvent.click(within(followUpHistory).getByRole('button', { name: t('close') }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it.each(['donors', 'followUps'] as const)(
    'keeps only the header X in the %s history and preserves the print-only detail footer',
    async (category) => {
      const instance = api();
      await validate(instance, category);
      render(<ScreeningPage api={instance} />);
      if (category === 'followUps') fireEvent.click(screen.getByRole('tab', { name: t('followUpSamples') }));
      fireEvent.click(screen.getByRole('button', { name: t('reportHistory') }));
      const history = screen.getByRole('dialog');
      expect(within(history).getAllByRole('button', { name: t('close') })).toHaveLength(1);
      expect(history.querySelector('.cds--modal-footer')).not.toBeInTheDocument();
      expect(within(history).queryByRole('button', { name: t('printResults') })).not.toBeInTheDocument();
      fireEvent.click(await within(history).findByRole('button', { name: t('viewResults') }));
      const footer = history.querySelector<HTMLElement>('.cds--modal-footer');
      if (!footer) throw new Error('Missing print footer');
      expect(within(footer).getAllByRole('button')).toHaveLength(1);
      const print = within(footer).getByRole('button', { name: t('printResults') });
      expect(print.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
      fireEvent.click(print);
      expect(printDocument).toHaveBeenCalledOnce();
      expect(within(history).getAllByRole('button', { name: t('close') })).toHaveLength(1);
      fireEvent.click(within(history).getByRole('button', { name: t('close') }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    },
  );
  it('registers apheresis through search, read-only review and printing, then reprints the persisted label', async () => {
    const instance = api();
    const register = vi.spyOn(instance, 'registerApheresisSample');
    render(<ScreeningPage api={instance} />);
    fireEvent.click(screen.getByRole('button', { name: t('registerApheresisSample') }));
    fireEvent.change(screen.getByLabelText(t('searchApplications')), { target: { value: '90000010' } });
    fireEvent.click(await screen.findByRole('button', { name: t('associateApplication') }));
    fireEvent.click(screen.getByRole('button', { name: t('next') }));
    await screen.findByRole('button', { name: t('confirmSample') });
    expect(screen.getByText('Postulante 1 Demostración')).toBeInTheDocument();
    expect(screen.queryByLabelText(t('applicant'))).not.toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
    const before = (await instance.listScreenings()).length;
    fireEvent.click(screen.getByRole('button', { name: t('confirmSample') }));
    await screen.findByRole('button', { name: t('printSample') });
    expect(register).toHaveBeenCalledOnce();
    expect((await instance.listScreenings()).length).toBe(before + 1);
    fireEvent.click(screen.getByRole('button', { name: t('printSample') }));
    expect(printDocument).toHaveBeenCalledOnce();
    fireEvent.click(within(screen.getByRole('dialog')).getAllByRole('button', { name: t('close') })[1]);
    const row = (await screen.findByText('M-AF-000001')).closest('tr');
    if (!row) throw new Error('SYNTHETIC_ROW_MISSING');
    fireEvent.click(within(row).getByRole('button', { name: t('registerResults') }));
    fireEvent.click(screen.getByRole('button', { name: t('printSample') }));
    expect(printDocument).toHaveBeenCalledTimes(2);
  });
  it('persists the selected application on X/Salir and resumes at review without creating a tube', async () => {
    const instance = api();
    const register = vi.spyOn(instance, 'registerApheresisSample');
    render(<ScreeningPage api={instance} />);
    fireEvent.click(screen.getByRole('button', { name: t('registerApheresisSample') }));
    fireEvent.click(await screen.findByRole('button', { name: t('associateApplication') }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: t('close') }));
    fireEvent.click(screen.getByRole('button', { name: t('keepEditing') }));
    expect(screen.getByText(t('applicationAssociated'))).toBeInTheDocument();
    fireEvent.click(
      within(screen.getByRole('dialog', { name: t('registerApheresisSample') })).getByRole('button', {
        name: t('close'),
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: t('leave') }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: t('registerApheresisSample') }));
    expect(await screen.findByRole('button', { name: t('confirmSample') })).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });
  it('keeps a failed registration at review, hides raw errors and emits no success', async () => {
    const instance = api();
    instance.registerApheresisSample = vi.fn().mockRejectedValue(new Error('PRIVATE_ERROR'));
    render(<ScreeningPage api={instance} />);
    fireEvent.click(screen.getByRole('button', { name: t('registerApheresisSample') }));
    fireEvent.click(await screen.findByRole('button', { name: t('associateApplication') }));
    fireEvent.click(screen.getByRole('button', { name: t('next') }));
    await screen.findByRole('button', { name: t('confirmSample') });
    vi.mocked(showSnackbar).mockClear();
    fireEvent.click(screen.getByRole('button', { name: t('confirmSample') }));
    expect(await screen.findByText(t('apheresisSaveFailed'))).toBeInTheDocument();
    expect(screen.queryByText('PRIVATE_ERROR')).not.toBeInTheDocument();
    expect(showSnackbar).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: t('printSample') })).not.toBeInTheDocument();
  });
  it('shows a safe candidate-load error, retry and blocks continuation', async () => {
    const instance = api();
    instance.listApheresisCandidates = vi.fn().mockRejectedValue(new Error('PRIVATE_ERROR'));
    render(<ScreeningPage api={instance} />);
    fireEvent.click(screen.getByRole('button', { name: t('registerApheresisSample') }));
    expect(await screen.findByText(t('loadFailed'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('retry') })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('next') })).toBeDisabled();
    expect(screen.queryByText('PRIVATE_ERROR')).not.toBeInTheDocument();
  });
});
