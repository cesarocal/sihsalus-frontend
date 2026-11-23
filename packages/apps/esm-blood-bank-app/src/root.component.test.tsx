import {
  type FetchResponse,
  openmrsFetch,
  useConfig,
  useLeftNav,
  userHasAccess,
  useSession,
} from '@openmrs/esm-framework';
import { act, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bloodBankPrivileges } from './access/blood-bank-privileges';
import type { BloodBankApp } from './blood-bank-app.component';
import type { BloodBankConfig } from './config-schema';
import Root from './root.component';
import { componentTypes } from './sections/laboratory/fractionation/fractionation-rules';

type RequirePrivilegeProps = {
  privilege: string | string[];
  children?: ReactNode;
};

const mockRequirePrivilege = vi.hoisted(() => vi.fn((_props: RequirePrivilegeProps): ReactNode => null));
const mockUseConfig = vi.mocked(useConfig<BloodBankConfig>);
const mockUseLeftNav = vi.mocked(useLeftNav);
const mockBloodBankApp = vi.hoisted(() => vi.fn<(props: ComponentProps<typeof BloodBankApp>) => ReactNode>());

vi.mock('@openmrs/esm-framework', () => ({
  useConfig: vi.fn(),
  useLeftNav: vi.fn(),
  useSession: vi.fn(),
  userHasAccess: vi.fn(),
  openmrsFetch: vi.fn(),
  restBaseUrl: '/ws/rest/v1',
}));

vi.mock('@sihsalus/esm-rbac', async () => {
  const React = await import('react');

  return {
    AppErrorBoundary: ({ children }: { children?: ReactNode }) => React.createElement(React.Fragment, null, children),
    RequirePrivilege: (props: RequirePrivilegeProps) => mockRequirePrivilege(props),
  };
});

vi.mock('./blood-bank-app.component', () => ({
  BloodBankApp: mockBloodBankApp,
}));

const sessionAt = (uuid: string) =>
  ({ authenticated: true, sessionLocation: { uuid, display: 'Hospital DEMO' } }) as ReturnType<typeof useSession>;

describe('Blood Bank root', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(openmrsFetch).mockReset();
    mockUseLeftNav.mockClear();
    mockBloodBankApp.mockClear();
    mockBloodBankApp.mockReturnValue(<div>Blood Bank application</div>);
    vi.mocked(useSession).mockReturnValue(sessionAt('bank-a'));
    vi.mocked(userHasAccess).mockReturnValue(true);
    mockUseConfig.mockReturnValue({ enabled: true, useMockData: true });
    mockRequirePrivilege.mockImplementation(({ children }) => <>{children}</>);
  });

  it('protects direct access with the Blood Bank privilege', () => {
    render(<Root />);

    expect(mockRequirePrivilege).toHaveBeenCalledWith(
      expect.objectContaining({ privilege: bloodBankPrivileges.module, children: expect.anything() }),
    );
    expect(screen.getByText('Blood Bank application')).toBeInTheDocument();
    expect(mockUseLeftNav).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'blood-bank-nav-slot', basePath: expect.stringContaining('/blood-bank') }),
    );
  });

  it('does not render the application when access is denied', () => {
    mockRequirePrivilege.mockImplementation(() => null);

    render(<Root />);

    expect(screen.queryByText('Blood Bank application')).not.toBeInTheDocument();
    expect(mockUseLeftNav).not.toHaveBeenCalled();
  });

  it('renders a safe disabled state', () => {
    mockUseConfig.mockReturnValue({ enabled: false, useMockData: true });

    render(<Root />);

    expect(screen.getByText('Banco de Sangre deshabilitado')).toBeInTheDocument();
  });

  it('does not allow settings edits without the dedicated privilege', () => {
    vi.mocked(userHasAccess).mockReturnValue(false);
    render(<Root />);
    expect(mockBloodBankApp.mock.lastCall?.[0].saveSettings).toBeUndefined();
    expect(userHasAccess).toHaveBeenCalledWith([bloodBankPrivileges.module, bloodBankPrivileges.settings], undefined);
  });

  it('persists settings per location and uses the designated person in the disposal workflow', async () => {
    const { unmount } = render(<Root />);
    const before = mockBloodBankApp.mock.lastCall?.[0];
    const save = before?.saveSettings;
    if (!save || !before.settings) throw new Error('Missing settings editor');
    vi.mocked(openmrsFetch).mockResolvedValue({
      data: { uuid: 'person-epidemiology', preferredName: { display: 'Celia Ríos' } },
    } as FetchResponse<unknown>);
    await act(() =>
      save({
        ...before.settings,
        expiryWarningDays: 14,
        stockMinimums: { wholeBlood: 3 },
        inventoryCardComponents: ['wholeBlood', 'redCells'],
        epidemiologyPersonUuid: 'person-epidemiology',
      }),
    );
    expect(mockBloodBankApp.mock.lastCall?.[0].settings?.expiryWarningDays).toBe(14);
    unmount();

    const bankA = render(<Root />);
    const restored = mockBloodBankApp.mock.lastCall?.[0];
    expect(restored?.settings).toMatchObject({
      expiryWarningDays: 14,
      stockMinimums: { wholeBlood: 3 },
      inventoryCardComponents: ['wholeBlood', 'redCells'],
      epidemiologyPersonUuid: 'person-epidemiology',
    });
    await expect(restored?.api.inventory.getDisposalSignatories()).resolves.toMatchObject({
      epidemiologyResponsible: 'Celia Ríos',
    });
    bankA.unmount();

    vi.mocked(useSession).mockReturnValue(sessionAt('bank-b'));
    render(<Root />);
    expect(mockBloodBankApp.mock.lastCall?.[0].settings).toMatchObject({
      expiryWarningDays: 7,
      stockMinimums: {},
      inventoryCardComponents: componentTypes,
      epidemiologyPersonUuid: '',
    });
  });

  it('shows all cards when reopening settings that predate card selection', () => {
    localStorage.setItem(
      'sihsalus.blood-bank.settings.mock.v1:bank-a',
      JSON.stringify({ expiryWarningDays: 9, servicePersonUuid: 'service-person', epidemiologyPersonUuid: '' }),
    );
    render(<Root />);
    expect(mockBloodBankApp.mock.lastCall?.[0].settings).toMatchObject({
      expiryWarningDays: 9,
      stockMinimums: {},
      inventoryCardComponents: componentTypes,
      servicePersonUuid: 'service-person',
    });
  });

  it('loads and saves settings against the active site revision in real mode', async () => {
    mockUseConfig.mockReturnValue({ enabled: true, useMockData: false, dashboardExpiryWarningDays: 9 });
    const originalSettings = {
      revision: 3,
      expiryWarningDays: 14,
      stockMinimums: { wholeBlood: 4 },
      inventoryCardComponents: ['wholeBlood'],
      servicePersonUuid: '',
      epidemiologyPersonUuid: '',
    };
    vi.mocked(openmrsFetch).mockResolvedValueOnce({ data: originalSettings } as FetchResponse<unknown>);
    render(<Root />);
    await waitFor(() => expect(mockBloodBankApp.mock.lastCall?.[0].settings).toEqual(originalSettings));
    expect(openmrsFetch).toHaveBeenCalledWith(
      '/ws/rest/v1/bloodbank/settings?locationUuid=bank-a&defaultWarningDays=9',
      expect.objectContaining({ rejectOnAuthFailure: true }),
    );
    const { settings, saveSettings } = mockBloodBankApp.mock.lastCall?.[0] ?? {};
    if (!settings || !saveSettings) throw new Error('Missing settings editor');

    const savedSettings = { ...originalSettings, revision: 4, expiryWarningDays: 25 };
    vi.mocked(openmrsFetch).mockResolvedValueOnce({ data: savedSettings } as FetchResponse<unknown>);
    await act(() => saveSettings({ ...settings, expiryWarningDays: 25 }));
    expect(openmrsFetch).toHaveBeenLastCalledWith(
      '/ws/rest/v1/bloodbank/settings?locationUuid=bank-a',
      expect.objectContaining({ method: 'PUT', body: { ...originalSettings, expiryWarningDays: 25 } }),
    );
    expect(mockBloodBankApp.mock.lastCall?.[0].settings).toEqual(savedSettings);
    expect(localStorage.length).toBe(0);
  });
});
