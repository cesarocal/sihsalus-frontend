import type { DonorDonation } from '../../types/blood-bank.types';

export interface DonationHistoryFilters {
  from: string;
  to: string;
  modality: DonorDonation['modality'] | '';
  search: string;
}

export const emptyDonationHistoryFilters: DonationHistoryFilters = { from: '', to: '', modality: '', search: '' };

function validDate(value: string) {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validDonationHistoryRange({ from, to }: DonationHistoryFilters) {
  return validDate(from) && validDate(to) && (!from || !to || from <= to);
}

/** Date-only comparisons are inclusive and do not shift dates across time zones. */
export function filterDonationHistory(records: DonorDonation[], filters: DonationHistoryFilters) {
  if (!validDonationHistoryRange(filters)) return [];
  const query = filters.search.trim().toLocaleLowerCase();
  return records.filter((record) => {
    const date = record.date.slice(0, 10);
    return (
      (!filters.from || (validDate(date) && date >= filters.from)) &&
      (!filters.to || (date !== '' && validDate(date) && date <= filters.to)) &&
      (!filters.modality || record.modality === filters.modality) &&
      `${record.unitCode} ${record.applicationNumber}`.toLocaleLowerCase().includes(query)
    );
  });
}
