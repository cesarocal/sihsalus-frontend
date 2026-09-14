import { type Location, useLocations } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import WardLocationSelector from './ward-location-selector.component';

vi.mock('@openmrs/esm-framework', () => ({ useLocations: vi.fn() }));

const mockUseLocations = vi.mocked(useLocations);
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
    mockUseLocations.mockReturnValue([firstWard, secondWard]);
  });

  it('requests admission locations and keeps the initial selection explicit', () => {
    renderSelector();

    expect(mockUseLocations).toHaveBeenCalledWith('Admission Location');
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
    mockUseLocations.mockReturnValue([{ uuid: 'ward-name-only', name: 'Named ward' }]);
    const user = userEvent.setup();
    renderSelector();

    await user.click(screen.getByRole('combobox', { name: 'Ward location' }));
    await user.click(screen.getByRole('option', { name: 'Named ward' }));

    expect(screen.getByLabelText('Current route')).toHaveTextContent(/^\/ward-name-only$/);
  });

  it('shows the existing loading state without navigating when no locations are available', () => {
    mockUseLocations.mockReturnValue([]);
    renderSelector();

    expect(screen.getByText('Loading ward locations...')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Current route')).toHaveTextContent(/^\/$/);
  });
});
