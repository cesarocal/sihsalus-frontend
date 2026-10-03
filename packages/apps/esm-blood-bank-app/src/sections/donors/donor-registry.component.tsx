import { Button, Search, Select, SelectItem } from '@carbon/react';
import { ArrowLeft } from '@carbon/react/icons';
import { useState } from 'react';
import type { BloodBankApi } from '../../api';
import {
  normalizeSearch,
  ProcessingTable,
  useProcessingData,
  useProcessingTranslation,
} from '../../shared/processing-page.component';
import { formatDonorDate } from './donor-utils';
import styles from '../applicant-selection/selection.scss';

export function DonorRegistry({ api, onBack }: { api: BloodBankApi; onBack: () => void }) {
  const t = useProcessingTranslation();
  const { data, loading, failed, reload } = useProcessingData(api.getDonorRegistry);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [modality, setModality] = useState('');
  const records = (data ?? []).filter(
    (record) =>
      (!status || record.extractionStatus === status) &&
      (!modality || record.modality === modality) &&
      normalizeSearch(
        `${record.fullName} ${record.documentNumber} ${record.donorId} ${record.applicationNumber} ${record.unitCode} ${record.bagLot}`,
      ).includes(normalizeSearch(search.trim())),
  );
  return (
    <>
      <div className={styles.listHeading}>
        <h2>{t('donorRegistry')}</h2>
        <Button kind="tertiary" size="sm" renderIcon={ArrowLeft} onClick={onBack}>
          {t('backToDonors')}
        </Button>
      </div>
      <div className={styles.surface}>
        <div className={styles.filters}>
          <Select
            id="registry-status"
            labelText={t('extractionStatus')}
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <SelectItem value="" text={t('allStatuses')} />
            {['complete', 'incomplete'].map((value) => (
              <SelectItem key={value} value={value} text={t(value)} />
            ))}
          </Select>
          <Select
            id="registry-modality"
            labelText={t('modality')}
            value={modality}
            onChange={(event) => setModality(event.target.value)}
          >
            <SelectItem value="" text={t('allModalities')} />
            {['wholeBlood', 'apheresis'].map((value) => (
              <SelectItem key={value} value={value} text={t(value)} />
            ))}
          </Select>
          <Search
            id="registry-search"
            labelText={t('searchRegistry')}
            placeholder={t('registrySearchPlaceholder')}
            value={search}
            closeButtonLabelText={t('clearSearch')}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <ProcessingTable
          title={t('donorRegistry')}
          columns={[
            'date',
            'number',
            'donorName',
            'document',
            'unitCode',
            'bagLot',
            'modality',
            'extractedVolume',
            'complications',
            'extractionStatus',
            'attendedBy',
          ]}
          rows={records.map((record) => ({
            id: record.id,
            cells: [
              formatDonorDate(record.date),
              record.applicationNumber,
              record.fullName,
              record.documentNumber,
              record.unitCode,
              record.bagLot || '—',
              t(record.modality),
              record.extractedVolume || '—',
              record.complications ? t(record.complications) : '—',
              record.extractionStatus ? t(record.extractionStatus) : '—',
              record.attendedBy || '—',
            ],
          }))}
          loading={loading}
          failed={failed}
          reload={reload}
          emptyHelp={t('emptyRegistry')}
          t={t}
        />
      </div>
    </>
  );
}
