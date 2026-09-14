import { openmrsFetch } from '@openmrs/esm-api';
import { type Location, restBaseUrl, useOpenmrsFetchAll } from '@openmrs/esm-framework';
import { act, renderHook, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { SWRConfig } from 'swr';
import useWardLocations from './useWardLocations';

vi.mock('@openmrs/esm-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@openmrs/esm-api')>()),
  openmrsFetch: vi.fn(),
}));

const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const catalogUrl = `${restBaseUrl}/location?tag=Admission%20Location&v=custom:(uuid,display,name)`;
const backendNextUrl = `https://synthetic.example${catalogUrl}&startIndex=1`;
const nextPageUrl = new URL(`${catalogUrl}&startIndex=1`, window.location.href).toString();
const firstWard: Location = { uuid: 'synthetic-ward-one', display: 'First ward', name: 'First ward' };
const secondWard: Location = { uuid: 'synthetic-ward-two', display: 'Second ward', name: 'Second ward' };

function pageResponse(results: Location[], nextUri?: string, totalCount = results.length) {
  return Object.assign(new Response(), {
    data: {
      results,
      links: nextUri ? [{ rel: 'next' as const, uri: nextUri }] : [],
      totalCount,
    },
  });
}

function wrapper({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false, dedupingInterval: 0 }}>
      {children}
    </SWRConfig>
  );
}

function renderWardLocations() {
  const observedData: Array<Location[] | undefined> = [];
  return {
    ...renderHook(
      () => {
        const response = useWardLocations();
        observedData.push(response.data);
        return response;
      },
      { wrapper },
    ),
    observedData,
  };
}

describe('useWardLocations pagination integration', () => {
  beforeEach(() => {
    mockOpenmrsFetch.mockReset();
  });

  it('follows the next page and withholds the catalog until every ward is available', async () => {
    let finishNextPage: (value: ReturnType<typeof pageResponse>) => void;
    const nextPage = new Promise<ReturnType<typeof pageResponse>>((resolve) => {
      finishNextPage = resolve;
    });
    mockOpenmrsFetch.mockImplementation(async (url) => {
      if (url === catalogUrl) return pageResponse([firstWard], backendNextUrl, 2);
      if (url === nextPageUrl) return nextPage;
      throw new Error('UNEXPECTED_SYNTHETIC_CATALOG_REQUEST');
    });

    const { result, observedData } = renderWardLocations();

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
    await waitFor(() => expect(mockOpenmrsFetch).toHaveBeenCalledWith(nextPageUrl));
    expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(1, catalogUrl);
    expect(useOpenmrsFetchAll).toHaveBeenCalledWith(catalogUrl, { immutable: true });
    expect(result.current.hasMore).toBe(true);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();

    await act(async () => finishNextPage(pageResponse([secondWard], undefined, 2)));

    await waitFor(() => expect(result.current.data).toEqual([firstWard, secondWard]));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasMore).toBe(false);
    expect(result.current.error).toBeUndefined();
    expect(observedData.every((data) => data === undefined || data.length === 2)).toBe(true);
  });

  it('distinguishes a successful empty catalog from loading', async () => {
    mockOpenmrsFetch.mockResolvedValue(pageResponse([]));

    const { result } = renderWardLocations();

    await waitFor(() => expect(result.current.data).toEqual([]));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasMore).toBe(false);
    expect(result.current.error).toBeUndefined();
    expect(mockOpenmrsFetch).toHaveBeenCalledExactlyOnceWith(catalogUrl);
  });

  it('keeps a failed later page unavailable and recovers the complete catalog through mutate', async () => {
    const error = new Error('SYNTHETIC_CATALOG_PAGE_FAILURE');
    let failNextPage = true;
    let finishNextPage: (value: ReturnType<typeof pageResponse>) => void;
    const nextPage = new Promise<ReturnType<typeof pageResponse>>((resolve) => {
      finishNextPage = resolve;
    });
    mockOpenmrsFetch.mockImplementation(async (url) => {
      if (url === catalogUrl) return pageResponse([firstWard], backendNextUrl, 2);
      if (url === nextPageUrl) {
        if (failNextPage) throw error;
        return nextPage;
      }
      throw new Error('UNEXPECTED_SYNTHETIC_CATALOG_REQUEST');
    });

    const { result, observedData } = renderWardLocations();

    await waitFor(() => expect(result.current.error).toBe(error));
    expect(result.current.data).toBeUndefined();
    expect(result.current.hasMore).toBe(true);
    expect(result.current.isLoading).toBe(true);

    // A repeated failure stays visible and does not escape as an unhandled rejection.
    await act(async () => {
      await expect(result.current.mutate(undefined, { throwOnError: false })).resolves.toBeUndefined();
    });
    expect(result.current.error).toBe(error);
    expect(result.current.data).toBeUndefined();

    failNextPage = false;
    let retry: ReturnType<typeof result.current.mutate>;
    act(() => {
      retry = result.current.mutate(undefined, { throwOnError: false });
    });
    await waitFor(() => {
      expect(mockOpenmrsFetch.mock.calls.filter(([url]) => url === nextPageUrl)).toHaveLength(3);
    });
    expect(result.current.data).toBeUndefined();

    await act(async () => {
      finishNextPage(pageResponse([secondWard], undefined, 2));
      await retry;
    });

    await waitFor(() => expect(result.current.data).toEqual([firstWard, secondWard]));
    expect(result.current.error).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasMore).toBe(false);
    expect(observedData.every((data) => data === undefined || data.length === 2)).toBe(true);
  });
});
