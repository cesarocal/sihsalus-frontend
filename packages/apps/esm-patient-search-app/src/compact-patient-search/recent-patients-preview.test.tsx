import { getDefaultsFromConfigSchema, restBaseUrl, userHasAccess, useConfig, useSession } from '@openmrs/esm-framework';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import dayjs from 'dayjs';

import { configSchema, type PatientSearchConfig } from '../config-schema';
import { patientChartPrivilege } from '../patient-chart-access';
import { PatientSearchContext } from '../patient-search-context';
import { type SearchedPatient } from '../types';

import RecentPatientsPreview from './recent-patients-preview.component';

const defaultProps = {
  data: [],
  fetchError: null,
  isLoading: false,
  isValidating: false,
};

const mockUseConfig = vi.mocked(useConfig<PatientSearchConfig>);
const mockUseSession = vi.mocked(useSession);
const mockUserHasAccess = vi.mocked(userHasAccess);
const clinicalUser = {
  privileges: [{ display: patientChartPrivilege }],
  roles: [],
};

describe('RecentPatientsPreview', () => {
  const birthdate = '1990-01-01T00:00:00.000+0000';
  const age = dayjs().diff(birthdate, 'years');
  const mockRecentPatients: Array<SearchedPatient> = [
    {
      attributes: [],
      identifiers: [
        {
          display: 'OpenMRS ID = 1000NLY',
          uuid: '19e98c23-d26f-4668-8810-00da0e10e326',
          identifier: '1000NLY',
          identifierType: {
            uuid: '05a29f94-c0ed-11e2-94be-8c13b969e334',
            display: 'OpenMRS ID',
            links: [
              {
                rel: 'self',
                uri: `http://dev3.openmrs.org/openmrs/${restBaseUrl}/patientidentifiertype/05a29f94-c0ed-11e2-94be-8c13b969e334`,
                resourceAlias: 'patientidentifiertype',
              },
            ],
          },
          location: {
            uuid: '44c3efb0-2583-4c80-a79e-1f756a03c0a1',
            display: 'Outpatient Clinic',
          },
          preferred: true,
        },
      ],
      person: {
        age,
        addresses: [],
        birthdate,
        dead: false,
        deathDate: null,
        gender: 'M',
        personName: {
          display: 'Smith, John Doe',
          givenName: 'John',
          middleName: 'Doe',
          familyName: 'Smith',
          familyName2: '',
        },
      },
      uuid: 'test-patient-uuid',
    },
  ];

  beforeEach(() => {
    mockUseConfig.mockReturnValue(getDefaultsFromConfigSchema(configSchema));
    mockUseSession.mockReturnValue({ user: clinicalUser } as ReturnType<typeof useSession>);
    mockUserHasAccess.mockImplementation((privilege) => privilege === patientChartPrivilege);
  });

  it('renders a loading state when fetching recently viewed patients on initial render', () => {
    renderRecentPatientsPreview({
      isLoading: true,
      data: undefined,
    });

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders an empty state when there are no recent patient charts', () => {
    renderRecentPatientsPreview({
      isLoading: false,
      data: [],
    });

    expect(screen.getByRole('region', { name: 'Recently viewed patients' })).toBeInTheDocument();
    expect(screen.getByText(/No recently viewed patient charts are available in this session/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Open a patient chart from search, a queue, a visit or a direct link/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders an error state when recent patient charts fail to fetch', () => {
    const error = {
      message: 'You are not logged in',
      response: {
        status: 401,
        statusText: 'Unauthorized',
      },
    };

    renderRecentPatientsPreview({
      fetchError: error,
      isLoading: false,
    });

    expect(screen.getByText(/sorry, there was an error. Please try again/i)).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders a list of recently viewed patients', () => {
    renderRecentPatientsPreview({
      data: mockRecentPatients,
    });

    const patientLink = screen.getByRole('link');
    expect(patientLink).toHaveAttribute('href', `/openmrs/spa/patient/${mockRecentPatients[0].uuid}/chart/`);
    expect(within(patientLink).getByText(/Smith, John Doe/i)).toBeInTheDocument();
    expect(within(patientLink).getByText(/1000NLY/)).toBeInTheDocument();
    expect(screen.getByRole('img')).toBeInTheDocument();
    expect(screen.getByText(/1 recently viewed patient/i)).toBeInTheDocument();
  });

  it('renders a loading spinner when revalidating recently viewed patients', () => {
    renderRecentPatientsPreview({
      data: mockRecentPatients,
      isValidating: true,
    });

    expect(screen.getByTitle(/loading/i)).toBeInTheDocument();
  });

  it.each(['click', 'keyboard'])('reopens the selected recent chart with %s', async (activation) => {
    const user = userEvent.setup();
    const patientClickSideEffect = vi.fn();
    render(
      <PatientSearchContext.Provider value={{ patientClickSideEffect }}>
        <RecentPatientsPreview {...defaultProps} data={mockRecentPatients} />
      </PatientSearchContext.Provider>,
    );
    const link = screen.getByRole('link', { name: 'Smith, John Doe' });
    expect(link).toHaveAttribute('href', '/openmrs/spa/patient/test-patient-uuid/chart/');
    if (activation === 'click') {
      await user.click(link);
    } else {
      link.focus();
      await user.keyboard('{Enter}');
    }
    expect(patientClickSideEffect).toHaveBeenCalledOnce();
    expect(patientClickSideEffect).toHaveBeenCalledWith('test-patient-uuid');
  });

  it('does not offer a chart link without chart access', () => {
    mockUserHasAccess.mockReturnValue(false);
    renderRecentPatientsPreview({ data: mockRecentPatients });
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

function renderRecentPatientsPreview(props = {}) {
  render(
    <PatientSearchContext.Provider value={{}}>
      <RecentPatientsPreview {...defaultProps} {...props} />
    </PatientSearchContext.Provider>,
  );
}
