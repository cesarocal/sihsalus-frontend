import { getDefaultsFromConfigSchema, useAppContext, useConfig, useFeatureFlag } from '@openmrs/esm-framework';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { renderWithSwr } from 'test-utils';
import { mockWardPatientGroupDetails, mockWardViewContext } from '../../test-utils/mock';
import { configSchema, type WardConfigObject } from '../config-schema';
import { useObs } from '../hooks/useObs';
import useWardLocation from '../hooks/useWardLocation';
import useWardLocations from '../hooks/useWardLocations';
import { type WardViewContext } from '../types';
import DefaultWardView from './default-ward/default-ward-view.component';
import WardView from './ward-view.component';

const mockUseConfig = vi.mocked(useConfig<WardConfigObject>);
const mockUseFeatureFlag = vi.mocked(useFeatureFlag);
const mockUseWardLocation = vi.mocked(useWardLocation);
const mutateLocation = vi.fn().mockResolvedValue(undefined);

vi.mock('../hooks/useWardLocations', () => ({ default: vi.fn() }));

vi.mock('../hooks/useWardLocation', async () => ({
  default: vi.fn().mockReturnValue({
    location: { uuid: 'abcd', display: 'mock location' },
    isLoadingLocation: false,
    isValidatingLocation: false,
    mutateLocation: vi.fn(),
    errorFetchingLocation: null,
    invalidLocation: false,
  }),
}));

vi.mock('../hooks/useObs', async () => ({
  useObs: vi.fn(),
}));

vi.mocked(useAppContext<WardViewContext>).mockReturnValue(mockWardViewContext);

//@ts-expect-error
vi.mocked(useObs).mockReturnValue({
  data: [],
});

class IntersectionObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

window.IntersectionObserver = IntersectionObserverMock as unknown as typeof IntersectionObserver;

beforeEach(() => {
  const config = getDefaultsFromConfigSchema<WardConfigObject>(configSchema);
  mockUseConfig.mockReturnValue(config);
  vi.mocked(useWardLocations).mockReturnValue({
    data: [{ uuid: 'abcd', display: 'mock location' }],
    error: undefined,
    isLoading: false,
    isValidating: false,
    hasMore: false,
    loadMore: vi.fn(),
    mutate: vi.fn(),
    totalCount: 1,
    nextUri: null,
  });
});

function renderWardView() {
  return renderWithSwr(
    <MemoryRouter>
      <WardView />
    </MemoryRouter>,
  );
}

describe('WardView', () => {
  let restoreBedLayouts: (() => void) | null = null;

  it('shows the page header and selection instructions before a ward is selected', () => {
    mockUseWardLocation.mockReturnValueOnce({
      location: undefined,
      isLoadingLocation: false,
      isValidatingLocation: false,
      mutateLocation,
      errorFetchingLocation: undefined,
      invalidLocation: false,
    });

    const { container } = renderWardView();

    expect(screen.getByText('Hospitalization')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Ward location' })).toHaveTextContent('Select a ward');
    expect(screen.getByText('Select a ward to view its beds and admitted patients.')).toBeInTheDocument();
    expect(container.querySelector('[data-extension-slot-name]')).not.toBeInTheDocument();
  });

  it('keeps the page header and selector visible while the requested ward loads', () => {
    mockUseWardLocation.mockReturnValueOnce({
      location: undefined,
      isLoadingLocation: true,
      isValidatingLocation: true,
      mutateLocation,
      errorFetchingLocation: undefined,
      invalidLocation: false,
    });

    const { container } = renderWardView();

    expect(screen.getByText('Hospitalization')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Ward location' })).toBeInTheDocument();
    expect(screen.getByText('Loading ward locations...')).toBeInTheDocument();
    expect(container.querySelector('[data-extension-slot-name]')).not.toBeInTheDocument();
  });

  it.each([
    'default-ward',
    'maternal-ward',
  ])('preserves the configured %s content beneath the page header', (wardId) => {
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema<WardConfigObject>(configSchema),
      wards: [{ id: wardId }],
    });

    const { container } = renderWardView();

    expect(screen.getByText('Hospitalization')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Ward location' })).toHaveTextContent('mock location');
    expect(container.querySelector(`[data-extension-slot-name="${wardId}"]`)).toBeInTheDocument();
    expect(screen.queryByText('Select a ward to view its beds and admitted patients.')).not.toBeInTheDocument();
  });

  it('renders the selected location in the ward header', () => {
    renderWithSwr(<DefaultWardView />);
    const header = screen.getByRole('heading', { name: 'mock location' });
    expect(header).toBeInTheDocument();
  });

  it('renders the correct number of occupied and empty beds', async () => {
    renderWithSwr(<DefaultWardView />);
    const emptyBedCards = await screen.findAllByText(/empty bed/i);
    expect(emptyBedCards).toHaveLength(3);
  });

  it('renders admitted patient without bed', async () => {
    renderWithSwr(<DefaultWardView />);
    const admittedPatientWithoutBed = screen.queryByText('Brian Johnson');
    expect(admittedPatientWithoutBed).toBeInTheDocument();
  });

  it('renders all admitted patients even if bed management module not installed', async () => {
    mockUseFeatureFlag.mockReturnValueOnce(false);
    renderWithSwr(<DefaultWardView />);
    const admittedPatientWithoutBed = screen.queryByText('Brian Johnson');
    expect(admittedPatientWithoutBed).toBeInTheDocument();
  });

  it('shows a recoverable fetch error without labeling the ward invalid or rendering clinical content', async () => {
    mockUseWardLocation.mockReturnValueOnce({
      location: undefined,
      isLoadingLocation: true,
      isValidatingLocation: false,
      mutateLocation,
      errorFetchingLocation: new Error('Private server response'),
      invalidLocation: false,
    });
    const user = userEvent.setup();
    const { container } = renderWardView();

    expect(screen.getByText('Error loading ward location')).toBeInTheDocument();
    expect(screen.queryByText('Private server response')).not.toBeInTheDocument();
    expect(screen.queryByText('Invalid location specified')).not.toBeInTheDocument();
    expect(screen.queryByText('Loading ward locations...')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Ward location' })).toBeInTheDocument();
    expect(container.querySelector('[data-extension-slot-name]')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(mutateLocation).toHaveBeenCalledWith(undefined, { throwOnError: false });
  });

  it('disables the location retry while revalidation is in progress', () => {
    mockUseWardLocation.mockReturnValueOnce({
      location: undefined,
      isLoadingLocation: false,
      isValidatingLocation: true,
      mutateLocation,
      errorFetchingLocation: new Error('Unavailable'),
      invalidLocation: false,
    });
    renderWardView();

    expect(screen.getByRole('button', { name: 'Retry' })).toBeDisabled();
  });

  it('renders notification for invalid location uuid', () => {
    mockUseWardLocation.mockReturnValueOnce({
      location: undefined,
      isLoadingLocation: false,
      isValidatingLocation: false,
      mutateLocation,
      errorFetchingLocation: undefined,
      invalidLocation: true,
    });

    const { container } = renderWardView();
    const notification = screen.getByRole('status');
    expect(notification).toBeInTheDocument();
    const invalidText = screen.queryByText('Invalid location specified');
    expect(invalidText).toBeInTheDocument();
    expect(screen.getByText('Hospitalization')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Ward location' })).toBeInTheDocument();
    expect(container.querySelector('[data-extension-slot-name]')).not.toBeInTheDocument();
  });

  it('should render warning if backend module installed and no beds configured', () => {
    // override the default response so that no beds are returned
    const wardPatientGroupDetails = mockWardPatientGroupDetails();
    const originalBedLayouts = wardPatientGroupDetails.bedLayouts;
    restoreBedLayouts = () => {
      wardPatientGroupDetails.bedLayouts = originalBedLayouts;
    };
    wardPatientGroupDetails.bedLayouts = [];

    mockUseFeatureFlag.mockReturnValue(true);

    renderWithSwr(<DefaultWardView />);
    expect(screen.getByText('No beds configured for this location')).toBeInTheDocument();
    expect(screen.getByText('Brian Johnson')).toBeInTheDocument();
  });

  it('does not warn about missing beds when bed management is not installed', () => {
    // override the default response so that no beds are returned
    const wardPatientGroupDetails = mockWardPatientGroupDetails();
    const originalBedLayouts = wardPatientGroupDetails.bedLayouts;
    restoreBedLayouts = () => {
      wardPatientGroupDetails.bedLayouts = originalBedLayouts;
    };
    wardPatientGroupDetails.bedLayouts = [];
    mockUseFeatureFlag.mockReturnValue(false);

    renderWithSwr(<DefaultWardView />);
    const noBedsConfiguredForThisLocation = screen.queryByText('No beds configured for this location');
    expect(noBedsConfiguredForThisLocation).not.toBeInTheDocument();
  });

  afterEach(() => {
    restoreBedLayouts?.();
    restoreBedLayouts = null;
  });
});
