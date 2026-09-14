import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { createElement, type PropsWithChildren } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import useLocation from './useLocation';
import useWardLocation from './useWardLocation';

vi.mock('./useLocation', () => ({ default: vi.fn() }));

const mockUseLocation = vi.mocked(useLocation);
const mutateLocation = vi.fn();
const originalUrl = window.location.href;
const originalGetSpaBase = window.getOpenmrsSpaBase;
const ward = {
  uuid: 'ward-one',
  display: 'Synthetic ward',
  tags: [{ uuid: 'admission-location-tag', display: 'Admission Location' }],
};

function response(overrides: Record<string, unknown> = {}): ReturnType<typeof useLocation> {
  return {
    data: Object.assign(new Response(), { data: ward }),
    isLoading: false,
    isValidating: false,
    error: undefined,
    mutate: mutateLocation,
    ...overrides,
  };
}

function routerAt(path: string) {
  return function Wrapper({ children }: PropsWithChildren) {
    return createElement(
      MemoryRouter,
      { basename: '/openmrs/spa/home/ward', initialEntries: [path] },
      createElement(
        Routes,
        null,
        createElement(Route, { path: '/', element: children }),
        createElement(Route, { path: '/:locationUuid', element: children }),
      ),
    );
  };
}

function followRequestedWard() {
  mockUseLocation.mockImplementation((uuid) => response({ data: uuid ? { data: { ...ward, uuid } } : undefined }));
}

beforeEach(() => {
  window.getOpenmrsSpaBase = () => '/openmrs/spa/';
  window.history.replaceState(null, '', '/openmrs/spa/home/ward/ward-one');
  mockUseLocation.mockReturnValue(response());
});

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', originalUrl);
  window.getOpenmrsSpaBase = originalGetSpaBase;
  vi.restoreAllMocks();
});

describe('useWardLocation routing', () => {
  it('resolves the selected ward in an independent React root without a Router', () => {
    followRequestedWard();
    const { result } = renderHook(() => useWardLocation());
    expect(mockUseLocation).toHaveBeenLastCalledWith(ward.uuid);
    expect(result.current.location).toEqual(ward);
  });

  it('prefers real Router params over the browser URL in a separate root', () => {
    followRequestedWard();
    const routed = renderHook(() => useWardLocation(), { wrapper: routerAt('/openmrs/spa/home/ward/ward-two') });
    const parcel = renderHook(() => useWardLocation());
    expect(routed.result.current.location?.uuid).toBe('ward-two');
    expect(parcel.result.current.location?.uuid).toBe('ward-one');
  });

  it('keeps an empty Router route unselected even when the browser URL names a ward', () => {
    const { result } = renderHook(() => useWardLocation(), { wrapper: routerAt('/openmrs/spa/home/ward') });
    expect(mockUseLocation).toHaveBeenLastCalledWith(null);
    expect(result.current.location).toBeUndefined();
    expect(result.current.invalidLocation).toBe(false);
    expect(result.current.errorFetchingLocation).toBeUndefined();
  });

  it('updates on routing events and clears the ward when leaving the route', () => {
    followRequestedWard();
    const { result } = renderHook(() => useWardLocation());
    act(() => {
      window.history.pushState(null, '', '/openmrs/spa/home/ward/ward-two?view=beds#details');
      window.dispatchEvent(new CustomEvent('single-spa:routing-event'));
    });
    expect(result.current.location?.uuid).toBe('ward-two');
    act(() => {
      window.history.pushState(null, '', '/openmrs/spa/home/appointments');
      window.dispatchEvent(new CustomEvent('single-spa:routing-event'));
    });
    expect(mockUseLocation).toHaveBeenLastCalledWith(null);
    expect(result.current.location).toBeUndefined();
  });

  it('updates on back and forward navigation without a Router', async () => {
    followRequestedWard();
    window.history.pushState(null, '', '/openmrs/spa/home/ward/ward-two');
    const { result } = renderHook(() => useWardLocation());
    act(() => window.history.back());
    await waitFor(() => expect(result.current.location?.uuid).toBe('ward-one'));
    act(() => window.history.forward());
    await waitFor(() => expect(result.current.location?.uuid).toBe('ward-two'));
  });

  it('uses the current snapshot when a render follows a URL change before a routing event', () => {
    followRequestedWard();
    const { result, rerender } = renderHook(() => useWardLocation());
    window.history.pushState(null, '', '/openmrs/spa/home/ward/ward-two');
    rerender();
    expect(result.current.location?.uuid).toBe('ward-two');
  });

  it('removes both route subscriptions on unmount', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useWardLocation());
    const subscriptions = add.mock.calls.filter(
      ([event]) => event === 'popstate' || event === 'single-spa:routing-event',
    );
    expect(subscriptions.map(([event]) => event).sort()).toEqual(['popstate', 'single-spa:routing-event']);
    unmount();
    for (const [event, listener] of subscriptions) {
      expect(remove).toHaveBeenCalledWith(event, listener);
    }
  });

  it('does not subscribe to browser navigation inside the Router', () => {
    const add = vi.spyOn(window, 'addEventListener');
    renderHook(() => useWardLocation(), { wrapper: routerAt('/openmrs/spa/home/ward/ward-one') });
    expect(
      add.mock.calls.filter(([event]) => event === 'single-spa:routing-event' || event === 'popstate'),
    ).toHaveLength(0);
  });

  it.each([
    '/openmrs/spa/home/ward',
    '/openmrs/spa/home/ward/',
    '/openmrs/spa/home/ward/ward-one/ward-two',
    '/openmrs/spa/home/ward//ward-one',
    '/openmrs/spa/home/ward/ward-one%2Fward-two',
    '/openmrs/spa/home/ward/%E0%A4%A',
    '/other/spa/home/ward/ward-one',
  ])('does not fetch outside a valid selected-ward path: %s', (path) => {
    window.history.replaceState(null, '', path);
    mockUseLocation.mockReturnValue(response({ error: new Error('SYNTHETIC_PRIVATE_MESSAGE') }));
    const { result } = renderHook(() => useWardLocation());
    expect(mockUseLocation).toHaveBeenLastCalledWith(null);
    expect(result.current.location).toBeUndefined();
    expect(result.current.errorFetchingLocation).toBeUndefined();
  });
});

describe('useWardLocation metadata states', () => {
  it('exposes loading and revalidation without returning an old location', () => {
    mockUseLocation.mockReturnValue(response({ isLoading: true, isValidating: true }));
    const { result } = renderHook(() => useWardLocation());
    expect(result.current.isLoadingLocation).toBe(true);
    expect(result.current.isValidatingLocation).toBe(true);
    expect(result.current.location).toBeUndefined();
    expect(result.current.errorFetchingLocation).toBeUndefined();
  });

  it.each([
    401,
    403,
    429,
    500,
    503,
    undefined,
  ])('reports HTTP %s or transport errors without declaring the ward invalid', (status) => {
    const error = Object.assign(new Error('SYNTHETIC_PRIVATE_MESSAGE'), {
      response: status ? { status } : undefined,
      responseBody: 'SYNTHETIC_PRIVATE_BODY',
    });
    mockUseLocation.mockReturnValue(response({ error }));
    const { result } = renderHook(() => useWardLocation());
    expect(result.current.location).toBeUndefined();
    expect(result.current.invalidLocation).toBe(false);
    expect(result.current.errorFetchingLocation).toBeInstanceOf(Error);
    expect(result.current.errorFetchingLocation).not.toBe(error);
    expect(result.current.errorFetchingLocation?.message).toBe('Unable to load ward location');
    expect(result.current.errorFetchingLocation).not.toHaveProperty('cause');
    expect(result.current.errorFetchingLocation).not.toHaveProperty('responseBody');
  });

  it('classifies a 404 as invalid and hides cached metadata', () => {
    mockUseLocation.mockReturnValue(response({ error: { response: { status: 404 } } }));
    const { result } = renderHook(() => useWardLocation());
    expect(result.current.invalidLocation).toBe(true);
    expect(result.current.location).toBeUndefined();
    expect(result.current.errorFetchingLocation).toBeUndefined();
  });

  it.each([
    { tags: [] },
    { tags: [{ uuid: 'facility-tag', display: 'Facility Location' }] },
  ])('rejects a location without an admission tag', ({ tags }) => {
    mockUseLocation.mockReturnValue(response({ data: { data: { ...ward, tags } } }));
    const { result } = renderHook(() => useWardLocation());
    expect(result.current.invalidLocation).toBe(true);
    expect(result.current.location).toBeUndefined();
    expect(result.current.errorFetchingLocation).toBeUndefined();
  });

  it.each([
    undefined,
    null,
    'SYNTHETIC_PRIVATE_BODY',
    [],
    {},
    { ...ward, uuid: 'ward-two' },
    { ...ward, uuid: null },
    { ...ward, display: null },
    { ...ward, tags: undefined },
    { ...ward, tags: 'SYNTHETIC_PRIVATE_BODY' },
    { ...ward, tags: [null] },
    { ...ward, tags: [{}] },
  ])('rejects missing, malformed or mismatched metadata case %#', (data) => {
    mockUseLocation.mockReturnValue(response({ data: { data } }));
    const { result } = renderHook(() => useWardLocation());
    expect(result.current.location).toBeUndefined();
    expect(result.current.invalidLocation).toBe(false);
    expect(result.current.errorFetchingLocation?.message).toBe('Unable to load ward location');
  });

  it('does not expose a late response for the previous ward after the route changes', () => {
    const { result } = renderHook(() => useWardLocation());
    expect(result.current.location?.uuid).toBe('ward-one');
    act(() => {
      window.history.pushState(null, '', '/openmrs/spa/home/ward/ward-two');
      window.dispatchEvent(new CustomEvent('single-spa:routing-event'));
    });
    expect(mockUseLocation).toHaveBeenLastCalledWith('ward-two');
    expect(result.current.location).toBeUndefined();
    expect(result.current.errorFetchingLocation).toBeInstanceOf(Error);
  });

  it.each([
    undefined,
    null,
    {},
    'SYNTHETIC_PRIVATE_BODY',
  ])('rejects a missing or malformed response envelope case %#', (data) => {
    mockUseLocation.mockReturnValue(response({ data }));
    const { result } = renderHook(() => useWardLocation());
    expect(result.current.location).toBeUndefined();
    expect(result.current.invalidLocation).toBe(false);
    expect(result.current.errorFetchingLocation?.message).toBe('Unable to load ward location');
  });

  it('keeps a fetch error visible while revalidating instead of masking it with loading', () => {
    mockUseLocation.mockReturnValue(
      response({
        error: new Error('SYNTHETIC_PRIVATE_MESSAGE'),
        isLoading: true,
        isValidating: true,
      }),
    );
    const { result } = renderHook(() => useWardLocation());
    expect(result.current.location).toBeUndefined();
    expect(result.current.isLoadingLocation).toBe(false);
    expect(result.current.isValidatingLocation).toBe(true);
    expect(result.current.errorFetchingLocation?.message).toBe('Unable to load ward location');
  });

  it('exposes the existing SWR mutator for a safe UI retry', async () => {
    const { result } = renderHook(() => useWardLocation());
    await result.current.mutateLocation(undefined, { throwOnError: false });
    expect(mutateLocation).toHaveBeenCalledWith(undefined, { throwOnError: false });
  });
});
