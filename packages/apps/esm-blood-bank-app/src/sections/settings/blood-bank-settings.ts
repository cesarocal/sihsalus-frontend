import type { BloodBankConfig } from '../../config-schema';
import { componentTypes } from '../laboratory/fractionation/fractionation-rules';
import type { ComponentType } from '../laboratory/fractionation/fractionation.types';

export const defaultExpiryWarningDays = 7;
export const maxExpiryWarningDays = 365;
export const signatoryLookupError = 'BLOOD_BANK_SETTINGS_SIGNATORY_UNAVAILABLE';

export type StockMinimums = Partial<Record<ComponentType, number>>;

export interface BloodBankSettings {
  expiryWarningDays: number;
  stockMinimums: StockMinimums;
  inventoryCardComponents: readonly ComponentType[];
  servicePersonUuid: string;
  epidemiologyPersonUuid: string;
}

export const isExpiryWarningDays = (value: number | undefined): value is number =>
  value !== undefined && Number.isInteger(value) && value >= 1 && value <= maxExpiryWarningDays;

export const isStockMinimum = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

export function defaultBloodBankSettings(config?: BloodBankConfig): BloodBankSettings {
  const days = config?.dashboardExpiryWarningDays;
  return {
    expiryWarningDays: isExpiryWarningDays(days) ? days : defaultExpiryWarningDays,
    stockMinimums: {},
    inventoryCardComponents: componentTypes,
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
      const stockMinimums: StockMinimums = {};
      for (const component of componentTypes) {
        const minimum = data.stockMinimums?.[component];
        if (isStockMinimum(minimum)) stockMinimums[component] = minimum;
      }
      const savedComponents = data.inventoryCardComponents;
      return {
        expiryWarningDays: data.expiryWarningDays,
        stockMinimums,
        inventoryCardComponents: Array.isArray(savedComponents)
          ? componentTypes.filter((component) => savedComponents.includes(component))
          : componentTypes,
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
