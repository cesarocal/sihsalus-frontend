import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import CareLogbookMergeAppMenuItem from './care-logbook-merge-app-menu-item.component';

type UserHasAccessProps = {
  privilege: string | string[];
  fallback?: ReactNode;
  children?: ReactNode;
};

const mockUserHasAccess = vi.hoisted(() => vi.fn((_props: UserHasAccessProps): ReactNode => null));

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  UserHasAccess: (props: UserHasAccessProps) => mockUserHasAccess(props),
}));

describe('patient merge application menu item', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.getOpenmrsSpaBase = vi.fn(() => '/openmrs/spa/');
    mockUserHasAccess.mockImplementation(({ children }) => <>{children}</>);
  });

  it('links to the guarded merge route with all required privileges', () => {
    render(<CareLogbookMergeAppMenuItem />);

    expect(screen.getByRole('link', { name: 'Merge duplicate records' })).toHaveAttribute(
      'href',
      '/openmrs/spa/home/care-logbook/merge',
    );
    expect(mockUserHasAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        privilege: ['app:home.libroAtenciones', 'app:home.libroAtenciones.editar', 'app:opciones.fusionarPacientes'],
        fallback: null,
      }),
    );
  });

  it('hides the entry when the authorization provider denies access', () => {
    mockUserHasAccess.mockImplementation(({ fallback }) => <>{fallback}</>);
    const { container } = render(<CareLogbookMergeAppMenuItem />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });
});
