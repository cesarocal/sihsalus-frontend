import {
  type FetchResponse,
  formatDatetime,
  getConfig,
  openmrsFetch,
  parseDate,
  showModal,
  useConnectivity,
  userHasAccess,
} from '@openmrs/esm-framework';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockEncounters, mockPatient, renderWithSwr } from 'test-utils';

import VisitsTable from './visits-table.component';

const defaultProps = {
  patientUuid: mockPatient.id,
  showAllEncounters: true,
  visits: mockEncounters,
};

const mockShowModal = vi.mocked(showModal);
const mockGetConfig = getConfig as vi.Mock;
const mockUserHasAccess = userHasAccess as vi.Mock;
const getProviderName = (provider: unknown) =>
  typeof provider === 'string'
    ? provider
    : provider && typeof provider === 'object' && 'name' in provider
      ? String(provider.name ?? '--')
      : '--';

describe('EncounterList', () => {
  it('renders an empty state when no encounters are available', async () => {
    mockGetConfig.mockResolvedValue({ htmlFormEntryForms: [] });

    renderVisitsTable({ visits: [] });

    await screen.findByTitle(/empty data illustration/i);
    expect(screen.getByText(/there are no encounters to display for this patient/i)).toBeInTheDocument();
  });

  it('offers paginated catalog options with no encounters and excludes options that require a missing privilege', async () => {
    const user = userEvent.setup();
    vi.mocked(useConnectivity).mockReturnValue(true);
    const fetcher = vi.mocked(openmrsFetch);
    fetcher.mockResolvedValueOnce({
      data: { results: [{ uuid: 'a', display: 'Admission' }], links: [{ rel: 'next' }] },
    } as FetchResponse<unknown>);
    fetcher.mockResolvedValueOnce({
      data: {
        results: [
          { uuid: 'b', display: 'Outpatient' },
          { uuid: 'restricted', display: 'Restricted type', viewPrivilege: { display: 'Private encounter access' } },
        ],
      },
    } as FetchResponse<unknown>);
    mockUserHasAccess.mockReturnValue(false);
    renderVisitsTable({ visits: [] });
    await user.click(screen.getByRole('combobox', { name: /filter by encounter type/i }));
    expect(await screen.findByRole('option', { name: 'Outpatient' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Admission' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Restricted type' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: 'Outpatient' }));
    expect(screen.getByText('Check the filters above')).toBeInTheDocument();
    vi.mocked(useConnectivity).mockReturnValue(false);
  });

  it("renders a tabular overview of the patient's clinical encounters", async () => {
    const user = userEvent.setup();

    renderVisitsTable({ visits: mockEncounters });

    await screen.findByRole('table');

    const filterDropdown = screen.getByRole('combobox', { name: /filter by encounter type/i });
    const searchbox = screen.getByRole('searchbox', { name: /filter table/i });
    const expectedColumnHeaders = [/date & time/, /visit type/, /Form name/, /encounter type/, /provider/];
    const expectedTableRows = mockEncounters.map(
      ({ datetime, encounterType, form, provider, visitType }) =>
        `${formatDatetime(parseDate(datetime))} ${visitType} ${encounterType} ${form?.display ?? '--'} ${getProviderName(
          provider,
        )} Options`,
    );

    expectedColumnHeaders.forEach((header) => {
      expect(screen.getByRole('columnheader', { name: new RegExp(header, 'i') })).toBeInTheDocument();
    });
    expectedTableRows.forEach((row) => {
      expect(screen.getByRole('row', { name: new RegExp(row, 'i') })).toBeInTheDocument();
    });

    // filter table to show only `Admission` encounters
    await user.click(filterDropdown);
    await user.click(screen.getByRole('option', { name: /Admission/i }));

    // screen.logTestingPlaygroundURL();
    expect(screen.queryByRole('cell', { name: /visit note/i })).not.toBeInTheDocument();
    expect(screen.getByRole('cell', { name: /admission/i })).toBeInTheDocument();

    // show all encounter types
    await user.click(filterDropdown);
    await user.click(screen.getByRole('option', { name: /all/i }));

    // filter table by typing in the searchbox
    await user.type(searchbox, 'Visit Note');

    expect(screen.queryByText(/consultation/i)).not.toBeInTheDocument();
    expect(screen.getByText(/visit note/i)).toBeInTheDocument();

    await user.clear(searchbox);
    await user.type(searchbox, 'triage');

    expect(screen.getByText(/no encounters to display/i)).toBeInTheDocument();
    expect(screen.getByText(/check the filters above/i)).toBeInTheDocument();
  });
});

describe('Delete Encounter', () => {
  it('Clicking the `Delete` button deletes an encounter', async () => {
    const user = userEvent.setup();

    mockUserHasAccess.mockReturnValue(true);

    renderVisitsTable({ visits: mockEncounters });

    await screen.findByRole('table');
    expect(screen.getByRole('table')).toBeInTheDocument();

    const firstEncounter = mockEncounters[0];
    const row = screen.getByRole('row', {
      name: new RegExp(
        `${formatDatetime(parseDate(firstEncounter.datetime))} ${firstEncounter.visitType} ${
          firstEncounter.encounterType
        } ${firstEncounter.form?.display ?? '--'} ${getProviderName(firstEncounter.provider)} Options`,
        'i',
      ),
    });

    await user.click(within(row).getByRole('button', { name: /expand current row/i }));
    await user.click(screen.getByRole('button', { name: /danger Delete this encounter/i }));

    expect(mockShowModal).toHaveBeenCalledTimes(1);
    expect(mockShowModal).toHaveBeenCalledWith(
      'delete-encounter-modal',
      expect.objectContaining({
        encounterTypeName: 'POC Consent Form',
      }),
    );
  });
});

function renderVisitsTable(props = {}) {
  renderWithSwr(<VisitsTable {...defaultProps} {...props} />);
}
