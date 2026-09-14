import { type Location, restBaseUrl, useOpenmrsFetchAll } from '@openmrs/esm-framework';

export default function useWardLocations() {
  return useOpenmrsFetchAll<Location>(`${restBaseUrl}/location?tag=Admission%20Location&v=custom:(uuid,display,name)`, {
    immutable: true,
  });
}
