import { describe, expect, it } from 'vitest';
import { donorDetailsMock } from '../../mocks/donors.mock';
import { emptyDonationHistoryFilters, filterDonationHistory, validDonationHistoryRange } from './donation-history';

const donation = donorDetailsMock[0].donations[0];
const records = [
  {
    ...donation,
    id: 'latest',
    date: '2026-10-03',
    unitCode: 'U-RECENT',
    applicationNumber: 'POST-003',
    modality: 'apheresis' as const,
  },
  { ...donation, id: 'middle', date: '2026-08-13', unitCode: 'U-MIDDLE', applicationNumber: 'POST-002' },
  { ...donation, id: 'earliest', date: '2026-01-01', unitCode: 'U-EARLY', applicationNumber: 'POST-001' },
];
describe('donation history filters', () => {
  it('preserves newest-first order and never mutates the original records', () => {
    const snapshot = structuredClone(records);
    expect(filterDonationHistory(records, emptyDonationHistoryFilters)).toEqual(records);
    expect(records).toEqual(snapshot);
  });
  it('uses inclusive date-only boundaries and supports either open end', () => {
    expect(
      filterDonationHistory(records, { ...emptyDonationHistoryFilters, from: '2026-08-13', to: '2026-10-03' }).map(
        (r) => r.id,
      ),
    ).toEqual(['latest', 'middle']);
    expect(
      filterDonationHistory(records, { ...emptyDonationHistoryFilters, to: '2026-08-13' }).map((r) => r.id),
    ).toEqual(['middle', 'earliest']);
    expect(
      filterDonationHistory(records, { ...emptyDonationHistoryFilters, from: '2026-10-03' }).map((r) => r.id),
    ).toEqual(['latest']);
  });
  it('combines modality with case-insensitive unit/application search, excluding personal identifiers', () => {
    expect(
      filterDonationHistory(records, {
        ...emptyDonationHistoryFilters,
        modality: 'apheresis',
        search: ' u-recent ',
      }).map((r) => r.id),
    ).toEqual(['latest']);
    expect(
      filterDonationHistory(records, { ...emptyDonationHistoryFilters, search: 'post-002' }).map((r) => r.id),
    ).toEqual(['middle']);
    expect(
      filterDonationHistory(records, { ...emptyDonationHistoryFilters, modality: 'wholeBlood', search: 'POST-003' }),
    ).toEqual([]);
    expect(filterDonationHistory(records, { ...emptyDonationHistoryFilters, search: donation.documentNumber })).toEqual(
      [],
    );
  });
  it.each(['2026-02-30', '2026-13-01', 'not-a-date'])('rejects malformed or nonexistent date %s', (from) => {
    const filters = { ...emptyDonationHistoryFilters, from };
    expect(validDonationHistoryRange(filters)).toBe(false);
    expect(filterDonationHistory(records, filters)).toEqual([]);
  });
  it('rejects reversed ranges and excludes undated records from date-bounded searches', () => {
    expect(validDonationHistoryRange({ ...emptyDonationHistoryFilters, from: '2026-10-03', to: '2026-01-01' })).toBe(
      false,
    );
    expect(
      filterDonationHistory([{ ...donation, date: '' }], { ...emptyDonationHistoryFilters, to: '2026-10-03' }),
    ).toEqual([]);
  });
});
