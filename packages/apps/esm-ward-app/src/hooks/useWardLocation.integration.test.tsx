import { openmrsFetch } from '@openmrs/esm-framework';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { type PropsWithChildren } from 'react';
import { SWRConfig } from 'swr';
import useWardLocation from './useWardLocation';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const originalUrl = window.location.href;
const originalGetSpaBase = window.getOpenmrsSpaBase;

function wardResponse(uuid: string) {
  return Object.assign(new Response(), {
    data: { uuid, display: 'Synthetic ward', tags: [{ uuid: 'admission-tag', display: 'Admission Location' }] },
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((finish) => {
    resolve = finish;
  });
  return { promise, resolve };
}

function wrapper({ children }: PropsWithChildren) {
  return (
    <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false, dedupingInterval: 0 }}>
      {children}
    </SWRConfig>
  );
}

beforeEach(() => {
  window.getOpenmrsSpaBase = () => '/openmrs/spa/';
  window.history.replaceState(null, '', '/openmrs/spa/home/ward/ward-one');
  mockOpenmrsFetch.mockReset();
});

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', originalUrl);
  window.getOpenmrsSpaBase = originalGetSpaBase;
});

it('keeps an independent ward root on the new ward when the previous request finishes late', async () => {
  const first = deferred<ReturnType<typeof wardResponse>>();
  const second = deferred<ReturnType<typeof wardResponse>>();
  mockOpenmrsFetch.mockImplementation((url) => (String(url).includes('/ward-one?') ? first.promise : second.promise));
  const observed: Array<string | undefined> = [];
  const { result } = renderHook(
    () => {
      const ward = useWardLocation();
      observed.push(ward.location?.uuid);
      return ward;
    },
    { wrapper },
  );

  expect(result.current.isLoadingLocation).toBe(true);
  await waitFor(() => expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1));
  act(() => {
    window.history.pushState(null, '', '/openmrs/spa/home/ward/ward-two');
    window.dispatchEvent(new CustomEvent('single-spa:routing-event'));
  });
  expect(result.current.location).toBeUndefined();
  await waitFor(() => expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2));

  await act(async () => second.resolve(wardResponse('ward-two')));
  await waitFor(() => expect(result.current.location?.uuid).toBe('ward-two'));
  await act(async () => first.resolve(wardResponse('ward-one')));
  expect(result.current.location?.uuid).toBe('ward-two');
  expect(observed).not.toContain('ward-one');

  act(() => {
    window.history.pushState(null, '', '/openmrs/spa/home/appointments');
    window.dispatchEvent(new CustomEvent('single-spa:routing-event'));
  });
  expect(result.current.location).toBeUndefined();
  expect(result.current.errorFetchingLocation).toBeUndefined();
  expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2);
});

it('retains a safe error through a failed retry and recovers using the UI mutator options', async () => {
  const privateError = Object.assign(new Error('SYNTHETIC_PRIVATE_RESPONSE'), { response: { status: 503 } });
  mockOpenmrsFetch.mockRejectedValue(privateError);
  const { result } = renderHook(() => useWardLocation(), { wrapper });

  await waitFor(() => expect(result.current.errorFetchingLocation).toBeInstanceOf(Error));
  expect(result.current.errorFetchingLocation?.message).not.toContain('SYNTHETIC_PRIVATE_RESPONSE');
  expect(result.current.location).toBeUndefined();
  expect(result.current.invalidLocation).toBe(false);
  await act(async () => {
    await expect(result.current.mutateLocation(undefined, { throwOnError: false })).resolves.toBeUndefined();
  });
  expect(result.current.errorFetchingLocation).toBeInstanceOf(Error);
  expect(result.current.location).toBeUndefined();

  const response = deferred<ReturnType<typeof wardResponse>>();
  mockOpenmrsFetch.mockReturnValue(response.promise);
  let retry: ReturnType<typeof result.current.mutateLocation>;
  act(() => {
    retry = result.current.mutateLocation(undefined, { throwOnError: false });
  });
  await waitFor(() => expect(result.current.isValidatingLocation).toBe(true));
  expect(result.current.location).toBeUndefined();
  await act(async () => {
    response.resolve(wardResponse('ward-one'));
    await retry;
  });
  await waitFor(() => expect(result.current.location?.uuid).toBe('ward-one'));
  expect(result.current.errorFetchingLocation).toBeUndefined();
  expect(result.current.isValidatingLocation).toBe(false);
});
