import { type FetchResponse, openmrsFetch } from '@openmrs/esm-framework';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import spanish from '../../../translations/es.json';
import { componentTypes } from '../laboratory/fractionation/fractionation-rules';
import { BloodBankSettingsPage } from './settings-page.component';

vi.mock('@openmrs/esm-framework', () => ({
  openmrsFetch: vi.fn(),
  restBaseUrl: '/ws/rest/v1',
  useDebounce: (value: string) => value,
  useSession: () => ({}),
  formatDatetime: () => '16 nov 2026, 10:00',
  showSnackbar: vi.fn(),
  PageHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  PageHeaderContent: ({ title }: { title: string }) => <div>{title}</div>,
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }) }));

const t = spanish.processing;
const settings = {
  expiryWarningDays: 7,
  stockMinimums: {},
  inventoryCardComponents: componentTypes,
  servicePersonUuid: '',
  epidemiologyPersonUuid: '',
};
const response = (data: unknown) => ({ data }) as FetchResponse<unknown>;
const person = (uuid: string, display: string) => ({ uuid, preferredName: { display } });

describe('Blood Bank signatory settings', () => {
  beforeEach(() => {
    vi.mocked(openmrsFetch).mockReset();
  });

  it('validates minimums per component and removes a minimum when its input is cleared', async () => {
    const onSave = vi.fn(async () => {});
    render(<BloodBankSettingsPage settings={{ ...settings, stockMinimums: { wholeBlood: 5 } }} onSave={onSave} />);
    const form = within(screen.getByRole('group', { name: t.settingsStockMinimums }));
    const wholeBlood = form.getByRole('spinbutton', { name: t.componentWholeBlood });
    const redCells = form.getByRole('spinbutton', { name: t.componentRedCells });
    const save = screen.getByRole('button', { name: t.settingsSave });
    expect(wholeBlood).toHaveValue(5);
    fireEvent.change(redCells, { target: { value: '-1' } });
    fireEvent.click(save);
    expect(form.getByText(t.settingsInvalidStockMinimum)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.change(redCells, { target: { value: '2' } });
    fireEvent.change(wholeBlood, { target: { value: '' } });
    fireEvent.click(save);
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ ...settings, stockMinimums: { redCells: 2 } }));
  });

  it('saves the visible cards separately from the stock minimums, including an empty selection', async () => {
    const stockMinimums = { wholeBlood: 5 };
    const onSave = vi.fn(async () => {});
    render(
      <BloodBankSettingsPage
        settings={{ ...settings, stockMinimums, inventoryCardComponents: ['wholeBlood'] }}
        onSave={onSave}
      />,
    );
    const visibility = within(screen.getByRole('group', { name: t.settingsInventoryCards }));
    const wholeBlood = visibility.getByRole('checkbox', { name: t.componentWholeBlood });
    const redCells = visibility.getByRole('checkbox', { name: t.componentRedCells });
    expect(wholeBlood).toBeChecked();
    expect(redCells).not.toBeChecked();
    fireEvent.click(wholeBlood);
    fireEvent.click(redCells);
    const save = screen.getByRole('button', { name: t.settingsSave });
    fireEvent.click(save);
    await waitFor(() =>
      expect(onSave).toHaveBeenLastCalledWith({ ...settings, stockMinimums, inventoryCardComponents: ['redCells'] }),
    );
    await waitFor(() => expect(save).toBeEnabled());
    fireEvent.click(redCells);
    fireEvent.click(save);
    await waitFor(() =>
      expect(onSave).toHaveBeenLastCalledWith({ ...settings, stockMinimums, inventoryCardComponents: [] }),
    );
  });

  it('loads a saved designation by name and submits only selected people for the two roles', async () => {
    const servicePerson = person('service-person', 'Alicia Quispe');
    const epidemiologyPerson = person('epidemiology-person', 'Nora Díaz');
    const onSave = vi.fn(async () => {});
    vi.mocked(openmrsFetch)
      .mockResolvedValueOnce(response(servicePerson))
      .mockResolvedValueOnce(response({ results: [servicePerson] }))
      .mockResolvedValueOnce(response({ results: [epidemiologyPerson] }));
    render(
      <BloodBankSettingsPage settings={{ ...settings, servicePersonUuid: servicePerson.uuid }} onSave={onSave} />,
    );

    const service = within(screen.getByRole('group', { name: t.inventoryServiceResponsible }));
    const epidemiology = within(screen.getByRole('group', { name: t.inventoryEpidemiologyResponsible }));
    expect(await service.findByText('Alicia Quispe')).toBeInTheDocument();

    fireEvent.change(service.getByRole('searchbox'), { target: { value: 'Alicia Quispe' } });
    fireEvent.click(await service.findByRole('button', { name: 'Alicia Quispe' }));
    fireEvent.change(epidemiology.getByRole('searchbox'), { target: { value: '  Nora   Díaz  ' } });
    fireEvent.click(await epidemiology.findByRole('button', { name: 'Nora Díaz' }));
    expect(epidemiology.getByText('Nora Díaz')).toBeInTheDocument();
    expect(epidemiology.getByRole('searchbox')).toHaveValue('');
    const queries = vi.mocked(openmrsFetch).mock.calls.slice(1).map(([url]) => new URLSearchParams(url.split('?')[1]));
    expect(queries.map((params) => params.get('q'))).toEqual(['Alicia Quispe', 'Nora Díaz']);
    expect(queries[1].get('v')).toBe('custom:(uuid,preferredName:(display))');

    fireEvent.click(screen.getByRole('button', { name: t.settingsSave }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        ...settings,
        servicePersonUuid: servicePerson.uuid,
        epidemiologyPersonUuid: epidemiologyPerson.uuid,
      }),
    );
  });

  it('shows loading, empty and expired-session states without changing a selected person', async () => {
    const servicePerson = person('service-person', 'Alicia Quispe');
    const onSave = vi.fn(async () => {});
    let finishSearch: (value: FetchResponse<unknown>) => void = () => {};
    const pendingSearch = new Promise<FetchResponse<unknown>>((resolve) => {
      finishSearch = resolve;
    });
    vi.mocked(openmrsFetch)
      .mockResolvedValueOnce(response(servicePerson))
      .mockReturnValueOnce(pendingSearch)
      .mockRejectedValueOnce({ status: 401 })
      .mockResolvedValueOnce(response({ results: [] }));
    render(
      <BloodBankSettingsPage settings={{ ...settings, servicePersonUuid: servicePerson.uuid }} onSave={onSave} />,
    );
    const service = within(screen.getByRole('group', { name: t.inventoryServiceResponsible }));
    const input = service.getByRole('searchbox');

    fireEvent.change(input, { target: { value: 'Al' } });
    expect(service.getByText(t.settingsSignatorySearchHelp)).toBeInTheDocument();
    expect(openmrsFetch).toHaveBeenCalledTimes(1);
    fireEvent.change(input, { target: { value: 'Adela' } });
    expect(service.getByText(t.settingsSignatorySearching)).toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'Raúl' } });
    expect(await service.findByText(t.settingsSignatorySearchError)).toBeInTheDocument();
    await act(() => finishSearch(response({ results: [person('stale', 'Adela Ríos')] })));
    expect(service.queryByRole('button', { name: 'Adela Ríos' })).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'Raúl Pérez' } });
    expect(await service.findByText(t.settingsSignatoryNoResults)).toBeInTheDocument();
    expect(service.getByText('Alicia Quispe')).toBeInTheDocument();

    fireEvent.click(service.getByRole('button', { name: t.settingsRemoveSignatory }));
    fireEvent.click(screen.getByRole('button', { name: t.settingsSave }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(settings));
  });
});
