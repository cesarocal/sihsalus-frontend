import { Button, Search, Select, SelectItem, Tab, TabList, TabPanel, TabPanels, Tabs, Tag } from '@carbon/react';
import { Add, RecentlyViewed } from '@carbon/react/icons';
import { useState } from 'react';
import type { ScreeningApi } from '../../../api/blood-bank-processing.api';
import {
  ProcessingPage,
  ProcessingTable,
  useProcessingData,
  useProcessingTranslation,
} from '../../../shared/processing-page.component';
import { notifySuccess } from '../../../shared/notify-success';
import { ScreeningWorkflow } from './screening-workflow.component';
import { ScreeningHistory } from './screening-history.component';
import { ApheresisSampleWorkflow } from './apheresis-sample-workflow.component';
import { matchesScreeningSearch, screeningCategory, screeningOriginLabel } from './screening-rules';
import type { ScreeningCategory, ScreeningRecord } from './screening.types';
import styles from '../../applicant-selection/selection.scss';
import screeningStyles from './screening.scss';

const categories: ScreeningCategory[] = ['donors', 'followUps'];
export function ScreeningPage({ api }: { api: ScreeningApi }) {
  const t = useProcessingTranslation();
  const { data, loading, failed, reload } = useProcessingData(api.listScreenings);
  const [tab, setTab] = useState(0);
  const [filters, setFilters] = useState({
    donors: { search: '', status: '', origin: '' },
    followUps: { search: '', status: '', origin: '' },
  });
  const [active, setActive] = useState<ScreeningRecord | null>(null);
  const [history, setHistory] = useState<ScreeningCategory | null>(null);
  const [apheresis, setApheresis] = useState(false);
  const category = categories[tab];
  const filter = filters[category];
  const update = (key: keyof typeof filter, value: string) =>
    setFilters((previous) => ({ ...previous, [category]: { ...previous[category], [key]: value } }));
  const records = (data ?? []).filter((record) => screeningCategory(record) === category);
  const filtered = records
    .filter(
      (record) =>
        record.status !== 'validated' &&
        (!filter.status || record.status === filter.status) &&
        (!filter.origin || screeningOriginLabel(record) === filter.origin) &&
        matchesScreeningSearch(record, filter.search),
    )
    .sort((left, right) => left.collectedOn.localeCompare(right.collectedOn));
  const queue = (
    <div className={styles.surface}>
      <div className={screeningStyles.toolbar}>
        <Search
          id={`screening-${category}-search`}
          labelText={t('search')}
          placeholder={t('screeningSearchPlaceholder')}
          value={filter.search}
          closeButtonLabelText={t('clearSearch')}
          onChange={(event) => update('search', event.target.value)}
        />
        <Button kind="tertiary" renderIcon={RecentlyViewed} onClick={() => setHistory(category)}>
          {t('reportHistory')}
        </Button>
        {category === 'donors' && (
          <Button renderIcon={Add} onClick={() => setApheresis(true)}>
            {t('registerApheresisSample')}
          </Button>
        )}
      </div>
      <div className={screeningStyles.filters}>
        <Select
          id={`screening-${category}-status`}
          labelText={t('status')}
          value={filter.status}
          onChange={(event) => update('status', event.target.value)}
        >
          <SelectItem value="" text={t('allStatuses')} />
          {['pending', 'inProgress'].map((value) => (
            <SelectItem key={value} value={value} text={t(value)} />
          ))}
        </Select>
        <Select
          id={`screening-${category}-origin`}
          labelText={t('sampleOrigin')}
          value={filter.origin}
          onChange={(event) => update('origin', event.target.value)}
        >
          <SelectItem value="" text={t('allOrigins')} />
          {(category === 'donors'
            ? ['postExtractionSample', 'apheresisSample']
            : ['donorFollowUp', 'recipientFollowUp']
          ).map((value) => (
            <SelectItem key={value} value={value} text={t(value)} />
          ))}
        </Select>
      </div>
      <ProcessingTable
        title={t(category === 'donors' ? 'donorSampleQueue' : 'followUpSampleQueue')}
        columns={[
          'sampleCode',
          'sampleOrigin',
          'association',
          category === 'followUps' ? 'person' : 'applicant',
          'document',
          'collectedOn',
          'status',
          'actions',
        ]}
        rows={filtered.map((record) => ({
          id: record.id,
          cells: [
            record.sampleCode,
            t(screeningOriginLabel(record)),
            record.unitCode ||
              record.applicationNumber ||
              (record.origin?.type === 'followUp' ? record.origin.followUpId : '—'),
            record.applicantName,
            record.documentNumber,
            record.collectedOn,
            <Tag key="status" type={record.status === 'inProgress' ? 'blue' : 'gray'}>
              {t(record.status)}
            </Tag>,
            <Button key="action" kind="ghost" size="sm" onClick={() => setActive(record)}>
              {t('registerResults')}
            </Button>,
          ],
        }))}
        loading={loading}
        failed={failed}
        reload={reload}
        emptyHelp={t('emptyScreening')}
        filterKey={`${category}:${JSON.stringify(filter)}`}
        t={t}
      />
    </div>
  );
  return (
    <ProcessingPage
      title={t('screeningTitle')}
      illustration="screening"
      counts={['pending', 'inProgress', 'validated'].map((value) => ({
        label: t(value),
        description: t('samplesUnit'),
        value: loading || failed ? '—' : records.filter((record) => record.status === value).length,
      }))}
    >
      <Tabs selectedIndex={tab} onChange={({ selectedIndex }) => setTab(selectedIndex)}>
        <TabList aria-label={t('screeningSources')}>
          <Tab>{t('donorSamples')}</Tab>
          <Tab>{t('followUpSamples')}</Tab>
        </TabList>
        <TabPanels>
          <TabPanel>{tab === 0 && queue}</TabPanel>
          <TabPanel>{tab === 1 && queue}</TabPanel>
        </TabPanels>
      </Tabs>
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
            notifySuccess(t(active.unitCode ? 'screeningFinished' : 'sampleScreeningFinished'));
            reload();
          }}
        />
      )}
      {history && (
        <ScreeningHistory
          category={history}
          records={data ?? []}
          loading={loading}
          failed={failed}
          reload={reload}
          onClose={() => setHistory(null)}
          t={t}
        />
      )}
      {apheresis && (
        <ApheresisSampleWorkflow
          api={api}
          t={t}
          onClose={() => {
            setApheresis(false);
            reload();
          }}
          onRegistered={reload}
        />
      )}
    </ProcessingPage>
  );
}
