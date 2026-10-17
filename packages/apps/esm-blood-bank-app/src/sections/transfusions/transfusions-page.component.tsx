import { Button, Search, Select, SelectItem, Tag } from '@carbon/react';
import { RecentlyViewed } from '@carbon/react/icons';
import { formatDatetime } from '@openmrs/esm-framework';
import { useCallback, useState } from 'react';
import type { TransfusionsApi } from '../../api/transfusions.api';
import {
  normalizeSearch,
  ProcessingPage,
  ProcessingTable,
  useProcessingData,
} from '../../shared/processing-page.component';
import shared from '../applicant-selection/selection.scss';
import { TransfusionHistory } from './transfusion-history.component';
import { TransfusionWorkflow } from './transfusion-workflow.component';
import styles from './transfusions.scss';
import type { TransfusionRequest } from './transfusions.types';
import { comparePriority, priorityKeys, transfusionStatusKeys } from './transfusions-rules';
import { useTransfusionsTranslation } from './use-transfusions-translation';

export function TransfusionsPage({ api }: { api: TransfusionsApi }) {
  const t = useTransfusionsTranslation();
  const load = useCallback(() => api.list(), [api]);
  const { data, loading, failed, reload } = useProcessingData(load);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [active, setActive] = useState<TransfusionRequest | null>(null);
  const [history, setHistory] = useState(false);
  const requests = data?.requests ?? [];
  const queue = requests
    .filter((item) => item.status !== 'delivered')
    .filter(
      (item) =>
        (!status || item.status === status) &&
        (!priority || item.order.priority === priority) &&
        normalizeSearch(`${item.order.number} ${item.order.patientName} ${item.order.historyNumber}`).includes(
          normalizeSearch(search),
        ),
    )
    .sort((a, b) =>
      comparePriority(
        { priority: a.order.priority, date: a.order.requestedAt },
        { priority: b.order.priority, date: b.order.requestedAt },
      ),
    );
  return (
    <ProcessingPage
      title={t('txTitle')}
      illustration="transfusions"
      counts={[
        {
          label: t('txPendingCount'),
          description: t('txRequests'),
          value:
            loading || failed
              ? '—'
              : requests.filter((item) => ['pending', 'reviewed', 'sampleReady'].includes(item.status)).length,
        },
        {
          label: t('txTesting'),
          description: t('txRequests'),
          value: loading || failed ? '—' : requests.filter((item) => item.status === 'testing').length,
        },
        {
          label: t('txReadyCount'),
          description: t('txRequests'),
          value: loading || failed ? '—' : requests.filter((item) => item.status === 'compatible').length,
        },
      ]}
    >
      <div className={shared.listHeading}>
        <h2>{t('txInbox')}</h2>
      </div>
      <div className={`${shared.surface} ${styles.responsive}`}>
        <div className={styles.toolbar}>
          <Search
            id="tx-inbox-search"
            labelText={t('txSearch')}
            placeholder={t('txSearch')}
            value={search}
            closeButtonLabelText={t('clearSearch')}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Button
            kind="tertiary"
            renderIcon={RecentlyViewed}
            disabled={loading || failed}
            onClick={() => setHistory(true)}
          >
            {t('txHistory')}
          </Button>
        </div>
        <div className={styles.toolbar}>
          <Select
            id="tx-status-filter"
            labelText={t('status')}
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <SelectItem value="" text={t('allStatuses')} />
            {Object.entries(transfusionStatusKeys)
              .filter(([key]) => key !== 'delivered')
              .map(([key, label]) => (
                <SelectItem key={key} value={key} text={t(label)} />
              ))}
          </Select>
          <Select
            id="tx-priority-filter"
            labelText={t('txPriority')}
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
          >
            <SelectItem value="" text={t('txAllPriorities')} />
            {Object.entries(priorityKeys).map(([key, label]) => (
              <SelectItem key={key} value={key} text={t(label)} />
            ))}
          </Select>
        </div>
        <ProcessingTable
          title={t('txInbox')}
          columns={[
            'txNumber',
            'txPriority',
            'txRequestedAt',
            'txPatient',
            'txHistoryNumber',
            'bloodGroup',
            'status',
            'actions',
          ]}
          rows={queue.map((item) => ({
            id: item.id,
            cells: [
              item.order.number,
              <Tag key="priority" type={item.order.priority === 'scheduled' ? 'blue' : 'red'}>
                {t(priorityKeys[item.order.priority])}
              </Tag>,
              formatDatetime(new Date(item.order.requestedAt), { noToday: true }),
              item.order.patientName,
              item.order.historyNumber,
              item.order.bloodGroup,
              t(transfusionStatusKeys[item.status]),
              <Button
                key="action"
                kind="ghost"
                size="sm"
                disabled={item.order.priority !== 'scheduled'}
                onClick={() => setActive(item)}
              >
                {t(
                  item.order.priority !== 'scheduled'
                    ? 'txUrgentPending'
                    : item.status === 'compatible'
                      ? 'txDeliver'
                      : item.status === 'testing'
                        ? 'txViewTests'
                        : item.status === 'incompatible'
                          ? 'txReplaceUnits'
                          : 'txAttend',
                )}
              </Button>,
            ],
          }))}
          loading={loading}
          failed={failed}
          reload={reload}
          emptyHelp={t('txEmptyInbox')}
          filterKey={`${search}:${status}:${priority}`}
          t={t}
        />
      </div>
      {active && (
        <TransfusionWorkflow
          initial={active}
          units={data?.units ?? []}
          api={api}
          onSaved={reload}
          onClose={() => {
            setActive(null);
            reload();
          }}
          t={t}
        />
      )}
      {history && (
        <TransfusionHistory
          requests={requests}
          entries={data?.bookEntries ?? []}
          onClose={() => setHistory(false)}
          t={t}
        />
      )}
    </ProcessingPage>
  );
}
