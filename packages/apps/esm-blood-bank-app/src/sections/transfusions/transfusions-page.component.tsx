import { Button, InlineNotification, Search, Select, SelectItem, Tag } from '@carbon/react';
import { Book, RecentlyViewed } from '@carbon/react/icons';
import { userHasAccess, useSession } from '@openmrs/esm-framework';
import { useCallback, useEffect, useRef, useState } from 'react';
import { bloodBankPrivileges } from '../../access/blood-bank-privileges';
import type { TransfusionsApi } from '../../api/transfusions.api';
import { formatListDate } from '../../shared/format-list-date';
import {
  normalizeSearch,
  ProcessingPage,
  ProcessingTable,
  useProcessingData,
} from '../../shared/processing-page.component';
import shared from '../applicant-selection/selection.scss';
import { IssuedTransfusionOrderDialog } from './issued-transfusion-order-dialog.component';
import { transfusionBloodGroupLabel } from './transfusion-blood-group';
import { TransfusionHistory } from './transfusion-history.component';
import {
  configuredTransfusionOrders,
  type IssuedTransfusionOrder,
  issuedOrderStatus,
  issuedOrderStatusKeys,
  listIssuedTransfusionOrders,
  type TransfusionOrderConfig,
  transfusionOrdersChanged,
} from './transfusion-order.resource';
import { TransfusionWorkflow } from './transfusion-workflow.component';
import styles from './transfusions.scss';
import type { TransfusionOrder, TransfusionRequest } from './transfusions.types';
import { comparePriority, priorityKeys, readyForDelivery, transfusionStatusKeys } from './transfusions-rules';
import { useTransfusionsTranslation } from './use-transfusions-translation';

const bankOrderRead = [bloodBankPrivileges.module, bloodBankPrivileges.transfusions, 'Get Orders'];
const statusCards = [
  {
    filter: 'txPendingCount',
    label: 'txPendingCount',
    statuses: new Set(['txPending', 'txReviewed', 'txSampleReady', 'fr08Sent', 'fr08Received', 'fr08InProgress']),
  },
  { filter: 'txTesting', label: 'txTesting', statuses: new Set(['txTesting']) },
  { filter: 'txCompatible', label: 'txReadyCount', statuses: new Set(['txCompatible', 'txReadyUrgent']) },
];

interface InboxRow {
  order: TransfusionOrder;
  statusKey: string;
  request?: TransfusionRequest;
  issued?: IssuedTransfusionOrder;
  canPrepare?: boolean;
  canReceive?: boolean;
}

export function TransfusionsPage({
  api,
  orderConfig,
  useMockData = true,
}: {
  api: TransfusionsApi;
  orderConfig?: TransfusionOrderConfig;
  useMockData?: boolean;
}) {
  const t = useTransfusionsTranslation();
  const { authenticated, user } = useSession();
  const configured = configuredTransfusionOrders(orderConfig) ? orderConfig : undefined;
  const readableConfig = authenticated && configured && userHasAccess(bankOrderRead, user) ? configured : undefined;
  const loadWorkspace = useMockData || !configured;
  const load = useCallback(() => api.list(), [api]);
  const workspace = useProcessingData(load, loadWorkspace);
  const loadIssued = useCallback(
    () => (readableConfig ? listIssuedTransfusionOrders(readableConfig) : Promise.resolve([])),
    [readableConfig],
  );
  const orders = useProcessingData(loadIssued, Boolean(readableConfig));
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [active, setActive] = useState<TransfusionRequest | null>(null);
  const [selected, setSelected] = useState<{ order: TransfusionOrder; issued: boolean; attend: boolean }>();
  const [preparing, setPreparing] = useState(false);
  const [prepareFailed, setPrepareFailed] = useState(false);
  const [archive, setArchive] = useState<'history' | 'book' | null>(null);
  const preparingRequest = useRef(false);
  const reloadOrders = orders.reload;
  useEffect(() => {
    if (!readableConfig) return;
    window.addEventListener(transfusionOrdersChanged, reloadOrders);
    window.addEventListener('focus', reloadOrders);
    return () => {
      window.removeEventListener(transfusionOrdersChanged, reloadOrders);
      window.removeEventListener('focus', reloadOrders);
    };
  }, [readableConfig, reloadOrders]);

  const workspaceFailed = loadWorkspace && workspace.failed;
  const ordersFailed = Boolean(readableConfig && orders.failed);
  const loading = (loadWorkspace && workspace.loading) || Boolean(readableConfig && orders.loading);
  const failed =
    (workspaceFailed || ordersFailed) && !(loadWorkspace && !workspaceFailed) && !(readableConfig && !ordersFailed);
  const archiveUnavailable = loading || !loadWorkspace || workspaceFailed;
  const issued = readableConfig && !ordersFailed ? (orders.data ?? []) : [];
  const issuedById = new Map(issued.map((item) => [item.order.id, item]));
  const requests = loadWorkspace && !workspaceFailed ? (workspace.data?.requests ?? []) : [];
  const requestById = new Map(requests.filter((item) => item.issuedOrder).map((item) => [item.order.id, item]));
  const shownRequests = requests.filter((item) => !item.issuedOrder || issuedById.has(item.order.id));
  const canEditOrders = Boolean(readableConfig && userHasAccess('Edit Orders', user));
  const rows: InboxRow[] = [
    ...requests
      .filter((request) => !request.issuedOrder)
      .map((request) => ({ order: request.order, statusKey: transfusionStatusKeys[request.status], request })),
    ...issued.map((item) => {
      const existing = requestById.get(item.order.id);
      const canReceive = canEditOrders && !item.stopped && !item.fulfillerStatus;
      const canPrepare = Boolean(
        useMockData &&
          !workspaceFailed &&
          api.prepareIssuedRequest &&
          !item.order.otherComponent &&
          !item.stopped &&
          (canReceive ||
            item.fulfillerStatus === 'RECEIVED' ||
            (!item.fulfillerStatus && existing && existing.status !== 'pending')),
      );
      const request = canPrepare ? existing : undefined;
      return {
        order: item.order,
        request,
        issued: item,
        canPrepare,
        canReceive,
        statusKey:
          request && request.status !== 'pending'
            ? transfusionStatusKeys[request.status]
            : canPrepare && !item.fulfillerStatus
              ? transfusionStatusKeys.pending
              : issuedOrderStatus(item),
      };
    }),
  ];
  const statusOptions = new Set([
    'txPendingCount',
    ...(loadWorkspace ? Object.values(transfusionStatusKeys).filter((key) => key !== 'txDelivered') : []),
    'txTesting',
    'txCompatible',
    ...(readableConfig ? ['fr08Sent', ...Object.values(issuedOrderStatusKeys), 'fr08Cancelled'] : []),
  ]);
  const activeCard = statusCards.find((card) => card.filter === status);
  const inbox = rows.filter((item) => item.request?.status !== 'delivered');
  const queue = inbox
    .filter(
      (item) =>
        (!status || (activeCard ? activeCard.statuses.has(item.statusKey) : item.statusKey === status)) &&
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
  const openRequest = async (item: InboxRow) => {
    if (item.request) {
      setActive(item.request);
      return;
    }
    if (!item.canPrepare || !api.prepareIssuedRequest) {
      setSelected({ order: item.order, issued: Boolean(item.issued), attend: Boolean(item.canReceive) });
      return;
    }
    if (preparingRequest.current) return;
    preparingRequest.current = true;
    setPreparing(true);
    setPrepareFailed(false);
    try {
      setActive(await api.prepareIssuedRequest(item.order));
    } catch {
      setPrepareFailed(true);
    } finally {
      preparingRequest.current = false;
      setPreparing(false);
    }
  };
  return (
    <ProcessingPage title={t('txTitle')} illustration="transfusions">
      <section className={shared.summary} aria-label={t('txTitle')}>
        {statusCards.map((card) => (
          <button
            key={card.filter}
            type="button"
            className={`cds--tile ${shared.summaryTile} ${styles.inboxStatusCard}`}
            aria-pressed={status === card.filter}
            disabled={loading || failed}
            onClick={() => setStatus((current) => (current === card.filter ? '' : card.filter))}
          >
            <span className={styles.inboxStatusLabel}>{t(card.label)}</span>
            <small>{t('txRequests')}</small>
            <span>{loading || failed ? '—' : inbox.filter((item) => card.statuses.has(item.statusKey)).length}</span>
          </button>
        ))}
      </section>
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
          <Button kind="tertiary" renderIcon={Book} disabled={archiveUnavailable} onClick={() => setArchive('book')}>
            {t('txBook')}
          </Button>
          <Button
            kind="tertiary"
            renderIcon={RecentlyViewed}
            disabled={archiveUnavailable}
            onClick={() => setArchive('history')}
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
            {Array.from(statusOptions, (key) => (
              <SelectItem key={key} value={key} text={t(key)} />
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
        {ordersFailed && !failed && (
          <div className={styles.toolbar}>
            <InlineNotification hideCloseButton kind="error" title={t('fr08OrdersUnavailable')} />
            <Button kind="tertiary" onClick={reloadOrders}>
              {t('retry')}
            </Button>
          </div>
        )}
        {prepareFailed && <InlineNotification hideCloseButton kind="error" title={t('txSaveFailed')} />}
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
            id: item.request?.id ?? item.order.id,
            cells: [
              item.order.number,
              <Tag key="priority" type={item.order.priority === 'scheduled' ? 'blue' : 'red'}>
                {t(priorityKeys[item.order.priority])}
              </Tag>,
              formatListDate(item.order.requestedAt),
              item.order.patientName,
              item.order.historyNumber,
              transfusionBloodGroupLabel(item.order.bloodGroup, t),
              t(item.statusKey),
              <Button key="action" kind="ghost" size="sm" disabled={preparing} onClick={() => void openRequest(item)}>
                {t(
                  item.request && readyForDelivery(item.request.status)
                    ? 'txDeliver'
                    : (item.request ? item.request.status !== 'testing' : item.canPrepare || item.canReceive)
                      ? 'txAttend'
                      : 'fr08Open',
                )}
              </Button>,
            ],
          }))}
          loading={loading}
          failed={failed}
          reload={() => {
            workspace.reload();
            reloadOrders();
          }}
          emptyHelp={t('txEmptyInbox')}
          filterKey={`${search}:${status}:${priority}`}
          t={t}
        />
      </div>
      {active && (
        <TransfusionWorkflow
          key={active.id}
          initial={active}
          issued={active.issuedOrder ? issuedById.get(active.order.id) : undefined}
          orderConfig={readableConfig}
          units={workspace.data?.units ?? []}
          api={api}
          onSaved={workspace.reload}
          onClose={() => {
            setActive(null);
            workspace.reload();
          }}
          t={t}
        />
      )}
      {selected && (!selected.issued || readableConfig) && (
        <IssuedTransfusionOrderDialog
          key={selected.order.id}
          config={readableConfig}
          order={selected.order}
          issued={selected.issued ? issuedById.get(selected.order.id) : undefined}
          attend={selected.attend}
          onClose={() => setSelected(undefined)}
          t={t}
        />
      )}
      {archive === 'history' && <TransfusionHistory requests={shownRequests} onClose={() => setArchive(null)} t={t} />}
      {archive === 'book' && (
        <TransfusionHistory
          bookEntries={(workspace.data?.bookEntries ?? []).filter((entry) =>
            shownRequests.some((request) => request.id === entry.requestId),
          )}
          onClose={() => setArchive(null)}
          t={t}
        />
      )}
    </ProcessingPage>
  );
}
