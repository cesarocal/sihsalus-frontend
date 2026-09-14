import { type Location } from '@openmrs/esm-framework';
import { useMemo } from 'react';
import { useWardLocationUuid } from '../ward-route';
import useLocation from './useLocation';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRequestedLocation(
  value: unknown,
  uuid: string,
): value is Location & { tags: NonNullable<Location['tags']> } {
  return (
    isRecord(value) &&
    value.uuid === uuid &&
    typeof value.display === 'string' &&
    Array.isArray(value.tags) &&
    value.tags.every((tag) => isRecord(tag) && typeof tag.display === 'string')
  );
}

export default function useWardLocation(): {
  location: Location | undefined;
  isLoadingLocation: boolean;
  isValidatingLocation: boolean;
  errorFetchingLocation: Error | undefined;
  invalidLocation: boolean;
  mutateLocation: ReturnType<typeof useLocation>['mutate'];
} {
  const locationUuid = useWardLocationUuid();
  const {
    data: locationResponse,
    isLoading,
    isValidating,
    error,
    mutate: mutateLocation,
  } = useLocation(locationUuid ?? null);

  return useMemo(() => {
    let location: Location | undefined;
    let invalidLocation = false;
    let errorFetchingLocation: Error | undefined;
    const hasFetchError = error !== undefined && error !== null;

    if (locationUuid) {
      if (hasFetchError) {
        invalidLocation = isRecord(error) && isRecord(error.response) && error.response.status === 404;
        if (!invalidLocation) errorFetchingLocation = new Error('Unable to load ward location');
      } else if (!isLoading) {
        const candidate = locationResponse?.data;
        if (!isRequestedLocation(candidate, locationUuid)) {
          errorFetchingLocation = new Error('Unable to load ward location');
        } else if (!candidate.tags.some((tag) => tag.display === 'Admission Location')) {
          invalidLocation = true;
        } else {
          location = candidate;
        }
      }
    }

    return {
      location,
      isLoadingLocation: Boolean(locationUuid && isLoading && !hasFetchError),
      isValidatingLocation: Boolean(locationUuid && isValidating),
      errorFetchingLocation,
      invalidLocation,
      mutateLocation,
    };
  }, [locationUuid, locationResponse, isLoading, isValidating, error, mutateLocation]);
}
