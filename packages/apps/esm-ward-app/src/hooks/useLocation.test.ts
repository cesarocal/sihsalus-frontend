import { type FetchResponse, type Location, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { createElement, type PropsWithChildren } from 'react';
import { SWRConfig } from 'swr';
import useLocation from './useLocation';

const mockFetch = vi.mocked(openmrsFetch);
const ward: Location = { uuid: 'ward-one', display: 'Synthetic ward' };
const wardResponse = { data: ward } as FetchResponse<Location>;

function createWrapper() {
  const cache = new Map();
  return function Wrapper({ children }: PropsWithChildren) {
    return createElement(
      SWRConfig,
      {
        value: { provider: () => cache, shouldRetryOnError: false, dedupingInterval: 0 },
      },
      children,
    );
  };
}

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue(wardResponse);
});

afterEach(cleanup);

describe('useLocation with SWR', () => {
  it('fetches the requested ward representation', async () => {
    const { result } = renderHook(() => useLocation('ward-one'), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.data).toEqual(wardResponse));
    expect(mockFetch).toHaveBeenCalledWith(
      restBaseUrl + '/location/ward-one?v=custom:(display,uuid,tags:(uuid,display))',
    );
  });

  it('preserves a custom representation', async () => {
    const { result } = renderHook(() => useLocation('ward-one', 'custom:(display,uuid,links)'), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.data).toEqual(wardResponse));
    expect(mockFetch).toHaveBeenCalledWith(restBaseUrl + '/location/ward-one?v=custom:(display,uuid,links)');
  });

  it('does not fetch when the location UUID is null', () => {
    const { result } = renderHook(() => useLocation(null), { wrapper: createWrapper() });
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
  });

  it.each([
    ['ward%2Fone', 'ward%252Fone'],
    ['ward/one?query#fragment', 'ward%2Fone%3Fquery%23fragment'],
  ])('encodes the entire UUID as one REST path segment: %s', async (uuid, encoded) => {
    const { result } = renderHook(() => useLocation(uuid), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.data).toEqual(wardResponse));
    expect(mockFetch).toHaveBeenCalledWith(
      restBaseUrl + '/location/' + encoded + '?v=custom:(display,uuid,tags:(uuid,display))',
    );
  });

  it('keeps a late response for ward A out of ward B after navigation', async () => {
    let resolveFirst: (value: FetchResponse<Location>) => void = () => {};
    mockFetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );
    const secondResponse = { data: { ...ward, uuid: 'ward-two' } } as FetchResponse<Location>;
    mockFetch.mockResolvedValueOnce(secondResponse);
    const { result, rerender } = renderHook(({ uuid }) => useLocation(uuid), {
      initialProps: { uuid: 'ward-one' },
      wrapper: createWrapper(),
    });
    expect(result.current.isLoading).toBe(true);
    rerender({ uuid: 'ward-two' });
    await waitFor(() => expect(result.current.data).toEqual(secondResponse));

    await act(async () => {
      resolveFirst(wardResponse);
    });

    expect(result.current.data).toEqual(secondResponse);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('clears old data while the new ward loads and when selection is removed', async () => {
    const { result, rerender } = renderHook(({ uuid }: { uuid: string | null }) => useLocation(uuid), {
      initialProps: { uuid: 'ward-one' as string | null },
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.data).toEqual(wardResponse));
    let resolveSecond: (value: FetchResponse<Location>) => void = () => {};
    mockFetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSecond = resolve;
        }),
    );
    rerender({ uuid: 'ward-two' });
    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(true);
    rerender({ uuid: null });
    expect(result.current.data).toBeUndefined();
    await act(async () => {
      resolveSecond({ data: { ...ward, uuid: 'ward-two' } } as FetchResponse<Location>);
    });
    expect(result.current.data).toBeUndefined();
  });

  it('revalidates through the existing mutator with throwOnError disabled', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Synthetic transport failure'));
    const { result } = renderHook(() => useLocation('ward-one'), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));

    await act(async () => {
      await result.current.mutate(undefined, { throwOnError: false });
    });

    await waitFor(() => expect(result.current.data).toEqual(wardResponse));
    expect(result.current.error).toBeUndefined();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
