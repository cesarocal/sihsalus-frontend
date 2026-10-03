import {
  Button,
  InlineNotification,
  Search,
  Select,
  SelectItem,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Tag,
} from '@carbon/react';
import { useState } from 'react';
import type { CollectionApi } from '../../api/blood-bank-processing.api';
import {
  normalizeSearch,
  ProcessingPage,
  ProcessingTable,
  useProcessingData,
  useProcessingTranslation,
} from '../../shared/processing-page.component';
import { fullName } from './collection-rules';
import { CollectionWorkflow } from './collection-workflow.component';
import type { CollectionRecord } from './collection.types';
import styles from '../applicant-selection/selection.scss';

export function CollectionPage({ api }: { api: CollectionApi }) {
  const t = useProcessingTranslation();
  const { data, loading, failed, reload } = useProcessingData(api.listCollections);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [modality, setModality] = useState('');
  const [active, setActive] = useState<CollectionRecord | null>(null);
  const [tab, setTab] = useState(0);
  const [message, setMessage] = useState(false);
  const records = data ?? [];
  const filtered = records.filter(
    (record) =>
      (tab === 0 ? record.status !== 'completed' : record.completedSteps.includes('registry')) &&
      (!status || record.status === status) &&
      (!modality || record.application.admission.modality === modality) &&
      normalizeSearch(
        `${record.application.number} ${record.unitCode} ${record.application.admission.documentNumber} ${fullName(record.application)}`,
      ).includes(normalizeSearch(search.trim())),
  );
  const list = (
    <div className={styles.surface}>
      <div className={styles.filters}>
        <Select
          id="collection-status"
          labelText={t('status')}
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <SelectItem value="" text={t('allStatuses')} />
          {['pending', 'inProgress', 'completed'].map((value) => (
            <SelectItem key={value} value={value} text={t(value)} />
          ))}
        </Select>
        <Select
          id="collection-modality"
          labelText={t('modality')}
          value={modality}
          onChange={(event) => setModality(event.target.value)}
        >
          <SelectItem value="" text={t('allModalities')} />
          <SelectItem value="wholeBlood" text={t('wholeBlood')} />
          <SelectItem value="apheresis" text={t('apheresis')} />
        </Select>
        <Search
          id="collection-search"
          labelText={t('search')}
          placeholder={t('searchPlaceholder')}
          value={search}
          closeButtonLabelText={t('clearSearch')}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <ProcessingTable
        title={t(tab === 0 ? 'queue' : 'donationRegistry')}
        columns={['number', 'applicant', 'document', 'modality', 'unitCode', 'status', 'actions']}
        rows={filtered.map((record) => ({
          id: record.id,
          cells: [
            record.application.number,
            fullName(record.application),
            `${record.application.admission.documentType} ${record.application.admission.documentNumber}`,
            t(record.application.admission.modality),
            record.unitCode,
            <Tag
              key="status"
              type={record.status === 'completed' ? 'green' : record.status === 'inProgress' ? 'blue' : 'gray'}
            >
              {t(record.status)}
            </Tag>,
            <Button
              key="action"
              kind="ghost"
              size="sm"
              onClick={() => {
                setActive(record);
                setMessage(false);
              }}
            >
              {t(record.status === 'completed' ? 'viewCertificate' : record.revision ? 'resume' : 'collect')}
            </Button>,
          ],
        }))}
        loading={loading}
        failed={failed}
        reload={reload}
        emptyHelp={t('emptyCollection')}
        t={t}
      />
    </div>
  );
  return (
    <ProcessingPage
      title={t('collectionTitle')}
      description={t('collectionDescription')}
      t={t}
      counts={['pending', 'inProgress', 'completed'].map((value) => ({
        label: t(value),
        value: loading || failed ? '—' : records.filter((record) => record.status === value).length,
      }))}
    >
      {message && (
        <InlineNotification kind="success" title={t('finished')} onCloseButtonClick={() => setMessage(false)} />
      )}
      <Tabs
        selectedIndex={tab}
        onChange={({ selectedIndex }) => {
          setTab(selectedIndex);
          setStatus('');
        }}
      >
        <TabList aria-label={t('collectionTitle')}>
          <Tab>{t('queue')}</Tab>
          <Tab>{t('donationRegistry')}</Tab>
        </TabList>
        <TabPanels>
          <TabPanel>{tab === 0 && list}</TabPanel>
          <TabPanel>{tab === 1 && list}</TabPanel>
        </TabPanels>
      </Tabs>
      {active && (
        <CollectionWorkflow
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
