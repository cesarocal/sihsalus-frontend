import { Button, InlineNotification, Search, Select, SelectItem, TextInput } from '@carbon/react';
import { Reset } from '@carbon/react/icons';
import { useState } from 'react';
import type { DonorDonation } from '../../types/blood-bank.types';
import { ProcessingTable, type ProcessingTranslate } from '../../shared/processing-page.component';
import { emptyDonationHistoryFilters, filterDonationHistory, validDonationHistoryRange } from './donation-history';
import { formatDonorDate } from './donor-utils';
import styles from '../applicant-selection/selection.scss';

export function DonationHistoryTable({
  donations,
  reload,
  t,
}: {
  donations: DonorDonation[];
  reload: () => void;
  t: ProcessingTranslate;
}) {
  const [filters, setFilters] = useState(emptyDonationHistoryFilters);
  const validRange = validDonationHistoryRange(filters);
  const records = filterDonationHistory(donations, filters);
  return (
    <div className={styles.surface}>
      <div className={styles.filters}>
        <div className={styles.dateRangeFilters}>
          <TextInput
            id="donations-from"
            type="date"
            labelText={t('donationsFrom')}
            value={filters.from}
            max={filters.to || undefined}
            onChange={(event) => setFilters({ ...filters, from: event.target.value })}
          />
          <TextInput
            id="donations-to"
            type="date"
            labelText={t('donationsTo')}
            value={filters.to}
            min={filters.from || undefined}
            invalid={!validRange}
            invalidText={t('invalidDonationDateRange')}
            onChange={(event) => setFilters({ ...filters, to: event.target.value })}
          />
        </div>
        <Select
          id="donations-modality"
          labelText={t('modality')}
          value={filters.modality}
          onChange={(event) => {
            const modality = event.target.value;
            if (modality === '' || modality === 'wholeBlood' || modality === 'apheresis')
              setFilters({ ...filters, modality });
          }}
        >
          <SelectItem value="" text={t('allModalities')} />
          <SelectItem value="wholeBlood" text={t('wholeBlood')} />
          <SelectItem value="apheresis" text={t('apheresis')} />
        </Select>
        <div className={styles.searchActions}>
          <Search
            id="donations-search"
            labelText={t('searchDonationHistory')}
            placeholder={t('donationHistorySearchPlaceholder')}
            value={filters.search}
            closeButtonLabelText={t('clearSearch')}
            onChange={(event) => setFilters({ ...filters, search: event.target.value })}
          />
          <Button kind="ghost" size="sm" renderIcon={Reset} onClick={() => setFilters(emptyDonationHistoryFilters)}>
            {t('clearFilters')}
          </Button>
        </div>
      </div>
      {!validRange ? (
        <div className={styles.filterWarning}>
          <InlineNotification hideCloseButton kind="warning" title={t('invalidDonationDateRange')} />
        </div>
      ) : (
        <ProcessingTable
          filterKey={JSON.stringify(filters)}
          title={t('donationHistory')}
          columns={['date', 'number', 'unitCode', 'modality', 'extractedVolume', 'extractionStatus', 'attendedBy']}
          rows={records.map((record) => ({
            id: record.id,
            cells: [
              formatDonorDate(record.date),
              record.applicationNumber,
              record.unitCode,
              t(record.modality),
              record.extractedVolume || '—',
              record.extractionStatus ? t(record.extractionStatus) : '—',
              record.attendedBy || '—',
            ],
          }))}
          loading={false}
          failed={false}
          reload={reload}
          emptyHelp={t(donations.length ? 'emptyFilteredHistory' : 'emptyHistory')}
          t={t}
        />
      )}
    </div>
  );
}
