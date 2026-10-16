import { Button, Search, Select, SelectItem, Tab, TabList, TabPanel, TabPanels, Tabs, Tag } from '@carbon/react';
import { Add, RecentlyViewed } from '@carbon/react/icons';
import { useCallback, useState } from 'react';
import type { TransfersApi } from '../../api/transfers.api';
import {
  normalizeSearch,
  ProcessingPage,
  ProcessingTable,
  useProcessingData,
} from '../../shared/processing-page.component';
import shared from '../applicant-selection/selection.scss';
import { inventoryDisplayDate } from '../inventory/inventory-rules';
import { componentDefinitions } from '../laboratory/fractionation/fractionation-rules';
import styles from './transfers.scss';
import type { TransferDirection, TransferRequest } from './transfers.types';
import { TransfersHistory } from './transfers-history.component';
import { newTransferRequest, transferDirection, transferStatusKeys } from './transfers-rules';
import { TransfersWorkflow } from './transfers-workflow.component';
import { useTransfersTranslation } from './use-transfers-translation';

export function TransfersPage({ api }: { api: TransfersApi }) {
  const t = useTransfersTranslation();
  const load = useCallback(() => api.list(), [api]);
  const { data, loading, failed, reload } = useProcessingData(load);
  const [tab, setTab] = useState(0);
  const direction: TransferDirection = tab === 0 ? 'incoming' : 'outgoing';
  const outgoing = direction === 'outgoing';
  const [filters, setFilters] = useState({
    incoming: { search: '', status: '', institution: '' },
    outgoing: { search: '', status: '', institution: '' },
  });
  const { search, status, institution } = filters[direction];
  const update = (key: keyof typeof filters.incoming, value: string) =>
    setFilters((previous) => ({ ...previous, [direction]: { ...previous[direction], [key]: value } }));
  const [history, setHistory] = useState<{ direction: TransferDirection; detail?: TransferRequest } | null>(null);
  const [active, setActive] = useState<{ request: TransferRequest; mode: 'register' | 'attend' | 'deliver' } | null>(
    null,
  );
  const allRequests = data?.requests ?? [];
  const requests = allRequests.filter((item) => transferDirection(item) === direction);
  const queue = requests.filter((item) => outgoing || ['draft', 'received', 'prepared'].includes(item.status));
  const institutionOf = (item: TransferRequest) =>
    outgoing ? item.data.destinationInstitution : item.data.requestingInstitution;
  const filtered = queue.filter(
    (item) =>
      (!status || item.status === status) &&
      (!institution || institutionOf(item) === institution) &&
      normalizeSearch(
        `${item.data.office} ${item.data.patientName} ${item.data.patientHistory} ${institutionOf(item)}`,
      ).includes(normalizeSearch(search)),
  );
  const title = t(outgoing ? 'transferOutgoingList' : 'transferInbox');
  const statuses = outgoing ? (['draft', 'issued'] as const) : (['draft', 'received', 'prepared'] as const);
  const table = (
    <>
      <div className={shared.listHeading}>
        <h2>{title}</h2>
      </div>
      <div className={`${shared.surface} ${styles.responsive}`}>
        <div className={styles.toolbar}>
          <Search
            id={`transfer-${direction}-search`}
            labelText={t('transferSearchInbox')}
            placeholder={t('transferSearchInbox')}
            value={search}
            closeButtonLabelText={t('clearSearch')}
            onChange={(event) => update('search', event.target.value)}
          />
          <div className={styles.toolbarActions}>
            <Button
              kind="tertiary"
              size="lg"
              className={styles.toolbarAction}
              renderIcon={RecentlyViewed}
              disabled={loading || failed}
              onClick={() => setHistory({ direction })}
            >
              {t('transferHistory')}
            </Button>
            <Button
              size="lg"
              className={styles.toolbarAction}
              renderIcon={Add}
              disabled={loading || failed}
              onClick={() => setActive({ request: newTransferRequest(direction), mode: 'register' })}
            >
              {t('transferRegisterReceived')}
            </Button>
          </div>
        </div>
        <div className={styles.filters}>
          <Select
            id={`transfer-${direction}-status`}
            labelText={t('status')}
            value={status}
            onChange={(event) => update('status', event.target.value)}
          >
            <SelectItem value="" text={t('allStatuses')} />
            {statuses.map((value) => (
              <SelectItem key={value} value={value} text={t(transferStatusKeys[value])} />
            ))}
          </Select>
          <Select
            id={`transfer-${direction}-institution`}
            labelText={t(outgoing ? 'transferDestinationInstitution' : 'transferRequestingInstitution')}
            value={institution}
            onChange={(event) => update('institution', event.target.value)}
          >
            <SelectItem value="" text={t('transferAllInstitutions')} />
            {Array.from(new Set(queue.map(institutionOf)))
              .filter(Boolean)
              .map((value) => (
                <SelectItem key={value} value={value} text={value} />
              ))}
          </Select>
        </div>
        <ProcessingTable
          title={title}
          columns={[
            'transferRequestOffice',
            'transferRequestDate',
            outgoing ? 'transferDestinationInstitution' : 'transferRequestingInstitution',
            'transferPatientName',
            'transferRequirement',
            'status',
            'actions',
          ]}
          rows={filtered.map((item) => ({
            id: item.id,
            cells: [
              item.data.office || item.id,
              inventoryDisplayDate(item.data.date),
              institutionOf(item),
              item.data.patientName,
              item.data.items
                .map((row) => `${row.quantity} × ${t(componentDefinitions[row.component].key)} (${row.bloodGroup})`)
                .join('; '),
              <Tag key="status" type={item.status === 'prepared' ? 'purple' : 'blue'}>
                {t(transferStatusKeys[item.status])}
              </Tag>,
              <Button
                key="action"
                size="sm"
                kind="ghost"
                onClick={() => {
                  if (item.status === 'issued') setHistory({ direction, detail: item });
                  else
                    setActive({
                      request: item,
                      mode: item.status === 'draft' ? 'register' : item.status === 'prepared' ? 'deliver' : 'attend',
                    });
                }}
              >
                {t(
                  item.status === 'draft'
                    ? 'transferResume'
                    : item.status === 'issued'
                      ? 'transferViewRequest'
                      : item.status === 'prepared'
                        ? 'transferDeliver'
                        : 'transferAttend',
                )}
              </Button>,
            ],
          }))}
          loading={loading}
          failed={failed}
          reload={reload}
          emptyHelp={t(outgoing ? 'transferEmptyOutgoing' : 'transferEmptyInbox')}
          filterKey={`${direction}:${search}:${status}:${institution}`}
          t={t}
        />
      </div>
    </>
  );
  const counts = outgoing
    ? [
        { label: 'transferDraftCount', value: requests.filter((item) => item.status === 'draft').length },
        { label: 'transferIssuedCount', value: requests.filter((item) => item.status === 'issued').length },
        { label: 'transferOutgoingTotal', value: requests.length },
      ]
    : [
        { label: 'transferPendingCount', value: requests.filter((item) => item.status === 'received').length },
        { label: 'transferPreparedCount', value: requests.filter((item) => item.status === 'prepared').length },
        { label: 'transferDeliveredCount', value: requests.filter((item) => item.status === 'delivered').length },
      ];
  return (
    <Tabs selectedIndex={tab} onChange={({ selectedIndex }) => setTab(selectedIndex)}>
      <ProcessingPage
        title={t('transferTitle')}
        illustration="transfers"
        tabs={
          <TabList contained aria-label={t('transferDirectionTabs')}>
            <Tab>{t('transferIncomingTab')}</Tab>
            <Tab>{t('transferOutgoingTab')}</Tab>
          </TabList>
        }
        counts={counts.map((count) => ({
          label: t(count.label),
          description: t('transferRequests'),
          value: loading || failed ? '—' : count.value,
        }))}
      >
        <TabPanels>
          <TabPanel className={styles.tabPanel}>{tab === 0 && table}</TabPanel>
          <TabPanel className={styles.tabPanel}>{tab === 1 && table}</TabPanel>
        </TabPanels>
        {active && (
          <TransfersWorkflow
            initial={active.request}
            mode={active.mode}
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
          <TransfersHistory
            direction={history.direction}
            initialDetail={history.detail}
            requests={allRequests}
            entries={data?.bookEntries ?? []}
            onClose={() => setHistory(null)}
            t={t}
          />
        )}
      </ProcessingPage>
    </Tabs>
  );
}
