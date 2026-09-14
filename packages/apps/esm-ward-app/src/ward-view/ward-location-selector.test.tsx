import { type Location } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import useWardLocations from '../hooks/useWardLocations';
import WardLocationSelector from './ward-location-selector.component';

vi.mock('../hooks/useWardLocations', () => ({ default: vi.fn() }));

const mockUseWardLocations = vi.mocked(useWardLocations);
const mutate = vi.fn().mockResolvedValue(undefined);
const catalogState: ReturnType<typeof useWardLocations> = {
  data: undefined,
  error: undefined,
  isLoading: false,
  isValidating: false,
  hasMore: false,
  loadMore: vi.fn(),
  mutate,
  totalCount: undefined,
  nextUri: null,
};
const firstWard: Location = { uuid: 'ward-one', display: 'First ward', name: 'First ward name' };
const secondWard: Location = { uuid: 'ward-two', display: 'Second ward', name: 'Second ward name' };

function CurrentRoute() {
  const { pathname } = useLocation();
  return <output aria-label="Current route">{pathname}</output>;
}

function renderSelector(selectedLocation?: Location, route = '/') {
  const basename = '/openmrs/spa/home/ward';
  return render(
    <MemoryRouter basename={basename} initialEntries={[`${basename}${route}`]}>
      <Routes>
        <Route path="/" element={<WardLocationSelector selectedLocation={selectedLocation} />} />
        <Route path="/:locationUuid" element={<WardLocationSelector selectedLocation={selectedLocation} />} />
      </Routes>
      <CurrentRoute />
    </MemoryRouter>,
  );
}

describe('WardLocationSelector', () => {
  beforeEach(() => {
    mockUseWardLocations.mockReturnValue({ ...catalogState, data: [firstWard, secondWard] });
  });

  it('keeps the initial selection explicit', () => {
    renderSelector();

    expect(screen.getByRole('combobox', { name: 'Ward location' })).toHaveTextContent('Select a ward');
    expect(screen.getByLabelText('Current route')).toHaveTextContent(/^\/$/);
  });

  it.each(['/', '/ward-one'])('selects a ward from %s without appending to the current ward route', async (route) => {
    const user = userEvent.setup();
    renderSelector(route === '/' ? undefined : firstWard, route);

    await user.click(screen.getByRole('combobox', { name: 'Ward location' }));
    await user.click(screen.getByRole('option', { name: 'Second ward' }));

    expect(screen.getByLabelText('Current route')).toHaveTextContent(/^\/ward-two$/);
    expect(screen.getByRole('combobox', { name: 'Ward location' })).toBeInTheDocument();
  });

  it('selects the catalog item by UUID when the current location is a different object', () => {
    renderSelector({ ...secondWard, display: 'Separate location response' }, '/ward-two');

    expect(screen.getByRole('combobox', { name: 'Ward location' })).toHaveTextContent('Second ward');
    expect(screen.queryByText('Separate location response')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Current route')).toHaveTextContent(/^\/ward-two$/);
  });

  it('uses the location name when display is unavailable', async () => {
    mockUseWardLocations.mockReturnValue({ ...catalogState, data: [{ uuid: 'ward-name-only', name: 'Named ward' }] });
    const user = userEvent.setup();
    renderSelector();

    await user.click(screen.getByRole('combobox', { name: 'Ward location' }));
    await user.click(screen.getByRole('option', { name: 'Named ward' }));

    expect(screen.getByLabelText('Current route')).toHaveTextContent(/^\/ward-name-only$/);
  });

  it('shows loading while the catalog is still being fetched without navigating', () => {
    mockUseWardLocations.mockReturnValue({ ...catalogState, isLoading: true });
    renderSelector();

    expect(screen.getByText('Loading ward locations...')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Current route')).toHaveTextContent(/^\/$/);
  });

  it('shows an empty state after a successful empty response and allows refreshing it', async () => {
    mockUseWardLocations.mockReturnValue({ ...catalogState, data: [] });
    const user = userEvent.setup();
    renderSelector();

    expect(screen.getByText('No wards are available.')).toBeInTheDocument();
    expect(screen.queryByText('Loading ward locations...')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(mutate).toHaveBeenCalledWith(undefined, { throwOnError: false });
    expect(screen.getByLabelText('Current route')).toHaveTextContent(/^\/$/);
  });

  it.each([false, true])('shows a safe error when catalog loading fails (loading=%s)', async (isLoading) => {
    mockUseWardLocations.mockReturnValue({
      ...catalogState,
      error: new Error('Private server response'),
      isLoading,
    });
    const user = userEvent.setup();
    renderSelector();

    expect(screen.getByText('Could not load the list of wards.')).toBeInTheDocument();
    expect(screen.queryByText('Private server response')).not.toBeInTheDocument();
    expect(screen.queryByText('Loading ward locations...')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(mutate).toHaveBeenCalledWith(undefined, { throwOnError: false });
    expect(screen.getByLabelText('Current route')).toHaveTextContent(/^\/$/);
  });

  it('disables repeated retries while a failed catalog is revalidating', () => {
    mockUseWardLocations.mockReturnValue({
      ...catalogState,
      error: new Error('Private server response'),
      isValidating: true,
    });
    renderSelector();

    expect(screen.getByRole('button', { name: 'Retry' })).toBeDisabled();
  });

  it('recovers from a catalog error without changing the selected ward route', () => {
    mockUseWardLocations.mockReturnValue({ ...catalogState, error: new Error('Unavailable') });
    const { rerender } = renderSelector(secondWard, '/ward-two');
    mockUseWardLocations.mockReturnValue({ ...catalogState, data: [firstWard, secondWard] });
    // Re-render the same router tree so its selected route is retained.
    rerender(
      <MemoryRouter basename="/openmrs/spa/home/ward" initialEntries={['/openmrs/spa/home/ward/ward-two']}>
        <Routes>
          <Route path="/:locationUuid" element={<WardLocationSelector selectedLocation={secondWard} />} />
        </Routes>
        <CurrentRoute />
      </MemoryRouter>,
    );

    expect(screen.getByRole('combobox', { name: 'Ward location' })).toHaveTextContent('Second ward');
    expect(screen.queryByText('Could not load the list of wards.')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Current route')).toHaveTextContent(/^\/ward-two$/);
  });
});
