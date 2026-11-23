import { openmrsFetch } from '@openmrs/esm-framework';
import type { BloodBankSettings } from '../sections/settings/blood-bank-settings';

export interface SavedBloodBankSettings extends BloodBankSettings {
  revision: number;
}

export const settingsEndpoint = '/ws/rest/v1/bloodbank/settings';

export async function readBloodBankSettings(locationUuid: string, defaultWarningDays: number) {
  const params = new URLSearchParams({ locationUuid, defaultWarningDays: String(defaultWarningDays) });
  const { data } = await openmrsFetch<SavedBloodBankSettings>(`${settingsEndpoint}?${params}`, {
    rejectOnAuthFailure: true,
  });
  return data;
}

export async function updateBloodBankSettings(locationUuid: string, settings: SavedBloodBankSettings) {
  const params = new URLSearchParams({ locationUuid });
  try {
    const { data } = await openmrsFetch<SavedBloodBankSettings>(`${settingsEndpoint}?${params}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: settings,
      rejectOnAuthFailure: true,
    });
    return data;
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'responseBody' in error) {
      const { responseBody } = error;
      if (responseBody && typeof responseBody === 'object' && 'error' in responseBody &&
          responseBody.error === 'BLOOD_BANK_SETTINGS_SIGNATORY_UNAVAILABLE') {
        throw new Error(responseBody.error);
      }
    }
    throw error;
  }
}
