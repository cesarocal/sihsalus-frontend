import type { BloodBankConfig } from '../../config-schema';

export const defaultExpiryWarningDays = 7;
export const maxExpiryWarningDays = 365;
export const signatoryLookupError = 'BLOOD_BANK_SETTINGS_SIGNATORY_UNAVAILABLE';

export interface BloodBankSettings {
  expiryWarningDays: number;
  servicePersonUuid: string;
  epidemiologyPersonUuid: string;
}

export const isExpiryWarningDays = (value: number | undefined): value is number =>
  value !== undefined && Number.isInteger(value) && value >= 1 && value <= maxExpiryWarningDays;

export function defaultBloodBankSettings(config?: BloodBankConfig): BloodBankSettings {
  const days = config?.dashboardExpiryWarningDays;
  return {
    expiryWarningDays: isExpiryWarningDays(days) ? days : defaultExpiryWarningDays,
    servicePersonUuid: config?.inventoryDisposalSignatories?.servicePersonUuid ?? '',
    epidemiologyPersonUuid: config?.inventoryDisposalSignatories?.epidemiologyPersonUuid ?? '',
  };
}

const locationKey = (locationUuid: string) => `sihsalus.blood-bank.settings.mock.v1:${locationUuid}`;

/** Location-specific mock settings kept in the browser. Used only while mock mode is enabled. */
export function readMockBloodBankSettings(locationUuid: string): BloodBankSettings | undefined {
  try {
    const data: Partial<BloodBankSettings> | null = JSON.parse(
      localStorage.getItem(locationKey(locationUuid)) ?? 'null',
    );
    if (
      data &&
      isExpiryWarningDays(data.expiryWarningDays) &&
      typeof data.servicePersonUuid === 'string' &&
      typeof data.epidemiologyPersonUuid === 'string'
    ) {
      return {
        expiryWarningDays: data.expiryWarningDays,
        servicePersonUuid: data.servicePersonUuid,
        epidemiologyPersonUuid: data.epidemiologyPersonUuid,
      };
    }
  } catch {
    return undefined;
  }
}

export function saveMockBloodBankSettings(locationUuid: string, settings: BloodBankSettings) {
  localStorage.setItem(locationKey(locationUuid), JSON.stringify(settings));
}
