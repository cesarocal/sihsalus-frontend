import { Button, InlineNotification, Search, Select, SelectItem, Tag } from '@carbon/react';
import { useState } from 'react';
import type { ScreeningApi } from '../../../api/blood-bank-processing.api';
import {
  normalizeSearch,
  ProcessingPage,
  ProcessingTable,
  useProcessingData,
  useProcessingTranslation,
} from '../../../shared/processing-page.component';
import { ScreeningWorkflow } from './screening-workflow.component';
import type { ScreeningRecord } from './screening.types';
import styles from '../../applicant-selection/selection.scss';

export function ScreeningPage({ api }: { api: ScreeningApi }) {
  const t = useProcessingTranslation();
  const { data, loading, failed, reload } = useProcessingData(api.listScreenings);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [result, setResult] = useState('');
  const [active, setActive] = useState<ScreeningRecord | null>(null);
  const [message, setMessage] = useState(false);
  const records = data ?? [];
  const filtered = records.filter(
    (record) =>
      (!status || record.status === status) &&
      (!result || record.result === result) &&
      normalizeSearch(
        `${record.sampleCode} ${record.unitCode} ${record.documentNumber} ${record.applicantName}`,
      ).includes(normalizeSearch(search.trim())),
  );
  return (
    <ProcessingPage
      title={t('screeningTitle')}
      description={t('screeningDescription')}
      t={t}
      counts={['pending', 'inProgress', 'validated'].map((value) => ({
        label: t(value),
        value: loading || failed ? '—' : records.filter((record) => record.status === value).length,
      }))}
    >
      {message && (
        <InlineNotification kind="success" title={t('finished')} onCloseButtonClick={() => setMessage(false)} />
      )}
      <div className={styles.surface}>
        <div className={styles.filters}>
          <Select
            id="screening-status"
            labelText={t('status')}
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <SelectItem value="" text={t('allStatuses')} />
            {['pending', 'inProgress', 'validated'].map((value) => (
              <SelectItem key={value} value={value} text={t(value)} />
            ))}
          </Select>
          <Select
            id="screening-result"
            labelText={t('globalResult')}
            value={result}
            onChange={(event) => setResult(event.target.value)}
          >
            <SelectItem value="" text={t('allStatuses')} />
            {['nonReactive', 'reactive', 'inconclusive'].map((value) => (
              <SelectItem key={value} value={value} text={t(value)} />
            ))}
          </Select>
          <Search
            id="screening-search"
            labelText={t('search')}
            placeholder={t('searchPlaceholder')}
            value={search}
            closeButtonLabelText={t('clearSearch')}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <ProcessingTable
          title={t('screeningTitle')}
          columns={[
            'sampleCode',
            'unitCode',
            'applicant',
            'document',
            'collectedOn',
            'status',
            'globalResult',
            'actions',
          ]}
          rows={filtered.map((record) => ({
            id: record.id,
            cells: [
              record.sampleCode,
              record.unitCode,
              record.applicantName,
              record.documentNumber,
              record.collectedOn,
              <Tag
                key="status"
                type={record.status === 'validated' ? 'green' : record.status === 'inProgress' ? 'blue' : 'gray'}
              >
                {t(record.status)}
              </Tag>,
              record.result ? t(record.result) : t('pendingResult'),
              <Button
                key="action"
                kind="ghost"
                size="sm"
                onClick={() => {
                  setActive(record);
                  setMessage(false);
                }}
              >
                {t(record.status === 'validated' ? 'viewResults' : 'registerResults')}
              </Button>,
            ],
          }))}
          loading={loading}
          failed={failed}
          reload={reload}
          emptyHelp={t('emptyScreening')}
          t={t}
        />
      </div>
      {active && (
        <ScreeningWorkflow
          initial={active}
          api={api}
          t={t}
          onClose={() => {
            setActive(null);
            reload();
          }}
          onSaved={() => {
            setActive(null);
            setMessage(true);
            reload();
          }}
        />
      )}
    </ProcessingPage>
  );
}
