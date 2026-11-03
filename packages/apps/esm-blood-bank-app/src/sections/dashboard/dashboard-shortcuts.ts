import { inventoryExpiry } from '../inventory/inventory-rules';
import { localDateTime } from '../laboratory/screening/screening-rules';

export interface DashboardShortcut {
  q: string;
  status: string;
  category: string;
  unit: string;
  expires: number;
  newApplication: boolean;
  application?: string;
  collection?: string;
  screening?: string;
  round?: string;
}
export function readDashboardShortcut(search: string): DashboardShortcut {
  const params = new URLSearchParams(search);
  const days = Number(params.get('expires'));
  return {
    q: params.get('q') ?? '',
    status: params.get('status') ?? '',
    category: params.get('category') ?? '',
    unit: params.get('unit') ?? '',
    expires: Number.isInteger(days) && days > 0 && days <= 365 ? days : 0,
    newApplication: params.get('action') === 'newApplication',
    application: params.get('application') ?? '',
    collection: params.get('collection') ?? '',
    screening: params.get('screening') ?? '',
    round: params.get('round') ?? '',
  };
}
export function dashboardLink(path: string, params: Record<string, string | number> = {}) {
  const query = new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)]));
  return `${path}${query.size ? `?${query}` : ''}`;
}
/** Operational reminder only; never changes expiry or clinical eligibility. */
export function expiresSoon(value: string, days: number, today = localDateTime().slice(0, 10)) {
  const expiry = inventoryExpiry(value);
  if (!expiry || expiry < today) return false;
  const end = new Date(`${today}T12:00:00`);
  end.setDate(end.getDate() + days);
  return expiry <= new Date(end.getTime() - end.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
