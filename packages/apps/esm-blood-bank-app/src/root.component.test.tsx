import { useConfig } from '@openmrs/esm-framework';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { BloodBankConfig } from './config-schema';
import Root from './root.component';

const mockUseConfig = vi.mocked(useConfig<BloodBankConfig>);

vi.mock('@sihsalus/esm-rbac', () => ({
  AppErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string, values?: Record<string, number>) =>
      fallback?.replace('{{count}}', String(values?.count ?? '')).replace('{{total}}', String(values?.total ?? '')) ?? _key,
  }),
}));

describe('Blood bank prototype', () => {
  beforeEach(() => {
    mockUseConfig.mockReturnValue({
      enabled: true,
      prototypeMode: true,
      selectionFormVersion: 'R.M. N.° 241-2018-MINSA · Anexo 1',
      title: 'Banco de Sangre',
    });
  });

  it('renders the operational dashboard without prototype labels', () => {
    render(<Root />);

    expect(screen.getByRole('heading', { name: 'Banco de Sangre' })).toBeInTheDocument();
    expect(screen.queryByText('Datos sintéticos')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Bandeja operativa' })).toBeInTheDocument();
  });

  it('opens the applicant selection flow without the regulatory label', async () => {
    render(<Root />);

    await act(async () => {
      globalThis.dispatchEvent(new CustomEvent('sihsalus:blood-bank:navigate', { detail: { view: 'selection' } }));
    });

    expect(screen.getByRole('heading', { name: 'Identificación' })).toBeInTheDocument();
    expect(screen.queryByText('R.M. N.° 241-2018-MINSA · Anexo 1')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Tipo de documento')).toBeInTheDocument();
    expect(screen.getByLabelText('Procedimiento previsto')).toBeInTheDocument();
  });

  it('gates reservation on recipient identity and compatibility', async () => {
    const user = userEvent.setup();
    render(<Root />);

    await act(async () => {
      globalThis.dispatchEvent(new CustomEvent('sihsalus:blood-bank:navigate', { detail: { view: 'transfusion' } }));
    });
    const reserveButton = screen.getByRole('button', { name: 'Reservar unidad' });
    expect(reserveButton).toBeDisabled();

    await user.click(screen.getByLabelText('Verifiqué dos identificadores independientes del receptor'));
    await user.selectOptions(screen.getByLabelText('Resultado de compatibilidad'), 'compatible');

    expect(reserveButton).toBeEnabled();
  });

  it('renders inventory using the system data table with operational columns', async () => {
    render(<Root />);

    await act(async () => {
      globalThis.dispatchEvent(new CustomEvent('sihsalus:blood-bank:navigate', { detail: { view: 'inventory' } }));
    });

    expect(screen.getByRole('table', { name: 'Unidades y hemocomponentes' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Código de unidad/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Hemocomponente/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Grupo \/ Rh/ })).toBeInTheDocument();
    expect(screen.getByText('GR-01088-A')).toBeInTheDocument();
  });

  it('fails closed when the module is disabled', () => {
    mockUseConfig.mockReturnValue({
      enabled: false,
      prototypeMode: true,
      selectionFormVersion: 'R.M. N.° 241-2018-MINSA · Anexo 1',
      title: 'Banco de Sangre',
    });

    render(<Root />);

    expect(screen.getByText('Módulo deshabilitado')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Banco de Sangre' })).not.toBeInTheDocument();
  });
});
