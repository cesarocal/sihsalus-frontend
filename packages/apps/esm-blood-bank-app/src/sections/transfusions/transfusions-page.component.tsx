import { Button, InlineNotification, Search, Select, SelectItem, Tag } from '@carbon/react';
import { Book, RecentlyViewed, Report } from '@carbon/react/icons';
import { useConfig, userHasAccess, useSession } from '@openmrs/esm-framework';
import { useCallback, useEffect, useRef, useState } from 'react';
import { bloodBankPrivileges } from '../../access/blood-bank-privileges';
import type { TransfusionsApi } from '../../api/transfusions.api';
import type { BloodBankConfig } from '../../config-schema';
import { formatListDate } from '../../shared/format-list-date';
import {
  normalizeSearch,
  ProcessingPage,
  ProcessingTable,
  useProcessingData,
} from '../../shared/processing-page.component';
import shared from '../applicant-selection/selection.scss';
import {
  closesTransfusion,
  isClinicalUuid,
  listConsent,
  listLatestRecipientConsents,
  recipientConsentChanged,
  recipientConsentSubject,
} from '../consents/paper-consent.resource';
import { hemoPrivileges } from '../hemovigilance/hemovigilance';
import { BankHemovigilance } from '../hemovigilance/hemovigilance.component';
import {
  isLocalHemovigilance,
  listHemovigilance,
  listRecordedDeliveries,
  recordDemoDispatch,
} from '../hemovigilance/hemovigilance.resource';
import { IssuedTransfusionOrderDialog } from './issued-transfusion-order-dialog.component';
import { transfusionBloodGroupLabel } from './transfusion-blood-group';
import { TransfusionHistory } from './transfusion-history.component';
import type { ReturnActions } from './transfusion-returns.component';
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
import type { TransfusionBookEntry, TransfusionOrder, TransfusionRequest } from './transfusions.types';
import {
  comparePriority,
  priorityKeys,
  readyForDelivery,
  transfusionOperatorName,
  transfusionStatusKeys,
} from './transfusions-rules';
import { useTransfusionsTranslation } from './use-transfusions-translation';

const bankOrderRead = [bloodBankPrivileges.module, bloodBankPrivileges.transfusions, 'Get Orders'];
const statusCards = [
  {
    filter: 'txPendingCount',
    label: 'txPendingCount',
    statuses: new Set([
      'txPending',
      'txReviewed',
      'txSampleReady',
      'fr08Sent',
      'fr08Received',
      'fr08InProgress',
      'txConsentPending',
    ]),
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
  const session = useSession();
  const { authenticated, user } = session;
  const { paperConsent } = useConfig<BloodBankConfig>();
  const configured = configuredTransfusionOrders(orderConfig) ? orderConfig : undefined;
  const readableConfig = authenticated && configured && userHasAccess(bankOrderRead, user) ? configured : undefined;
  const loadWorkspace = useMockData || !configured;
  const verifyDelivery = Boolean(readableConfig && isLocalHemovigilance(useMockData));
  const load = useCallback(() => api.list(), [api]);
  const workspace = useProcessingData(load, loadWorkspace);
  const loadIssued = useCallback(async () => {
    const issued = readableConfig ? await listIssuedTransfusionOrders(readableConfig) : [];
    const [delivered, consents] = await Promise.all([
      verifyDelivery ? listRecordedDeliveries(issued.map(({ order }) => order)) : new Map<string, string>(),
      paperConsent
        ? listLatestRecipientConsents(
            paperConsent,
            issued.map(({ order }) => order),
          )
        : undefined,
    ]);
    const reconciliations = await Promise.allSettled(
      Array.from(consents ?? [], async ([id, record]) => {
        if (!loadWorkspace || !record || !closesTransfusion(record.decision) || delivered.has(id)) return false;
        return api.cancelIssuedRequest?.(id, { ...record, decision: record.decision });
      }),
    );
    const reconciled = reconciliations.some((result) => result.status === 'fulfilled' && result.value);
    return { issued, delivered, consents, reconciled };
  }, [api, loadWorkspace, paperConsent, readableConfig, verifyDelivery]);
  const orders = useProcessingData(loadIssued, Boolean(readableConfig));
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [active, setActive] = useState<TransfusionRequest | null>(null);
  const [selected, setSelected] = useState<{ order: TransfusionOrder; issued: boolean; attend: boolean }>();
  const [preparing, setPreparing] = useState(false);
  const [prepareFailed, setPrepareFailed] = useState('');
  const [archive, setArchive] = useState<'history' | 'book' | null>(null);
  const [reactionQueue, setReactionQueue] = useState(false);
  const preparingRequest = useRef(false);
  const reloadOrders = orders.reload;
  useEffect(() => {
    if (!readableConfig) return;
    window.addEventListener(transfusionOrdersChanged, reloadOrders);
    window.addEventListener(recipientConsentChanged, reloadOrders);
    window.addEventListener('focus', reloadOrders);
    return () => {
      window.removeEventListener(transfusionOrdersChanged, reloadOrders);
      window.removeEventListener(recipientConsentChanged, reloadOrders);
      window.removeEventListener('focus', reloadOrders);
    };
  }, [readableConfig, reloadOrders]);

  const reloadWorkspace = workspace.reload;
  useEffect(() => {
    if (orders.data?.reconciled) reloadWorkspace();
  }, [orders.data, reloadWorkspace]);

  const workspaceFailed = loadWorkspace && workspace.failed;
  const ordersFailed = Boolean(readableConfig && orders.failed);
  const loading = (loadWorkspace && workspace.loading) || Boolean(readableConfig && orders.loading);
  const failed =
    (workspaceFailed || ordersFailed) && !(loadWorkspace && !workspaceFailed) && !(readableConfig && !ordersFailed);
  const archiveUnavailable = loading || (!readableConfig && (!loadWorkspace || workspaceFailed));
  const issued = readableConfig && !ordersFailed ? (orders.data?.issued ?? []) : [];
  const canInvestigate = Boolean(
    readableConfig && isLocalHemovigilance(useMockData) && userHasAccess(hemoPrivileges.bank, user),
  );
  const issuedById = new Map(issued.map((item) => [item.order.id, item]));
  const requests = loadWorkspace && !workspaceFailed ? (workspace.data?.requests ?? []) : [];
  const requestById = new Map(requests.filter((item) => item.issuedOrder).map((item) => [item.order.id, item]));
  const shownRequests = requests.filter((item) => !item.issuedOrder || issuedById.has(item.order.id));
  const recordedDeliveries = issued.flatMap(({ order }) => {
    const deliveredAt = orders.data?.delivered.get(order.id);
    return deliveredAt ? [{ order, deliveredAt }] : [];
  });
  const consentClosures = issued.flatMap(({ order }) => {
    const record = orders.data?.consents?.get(order.id);
    return record && closesTransfusion(record.decision)
      ? [
          {
            order,
            record,
            dispatched: orders.data?.delivered.has(order.id) || Boolean(requestById.get(order.id)?.deliveredAt),
          },
        ]
      : [];
  });
  const canEditOrders = Boolean(readableConfig && userHasAccess('Edit Orders', user));
  const returnOperator = transfusionOperatorName(session);
  const verifyReturn = async (dispatch: TransfusionBookEntry, mustBeUnused: boolean) => {
    const order = issuedById.get(dispatch.requestId)?.order;
    if (!order || !paperConsent || !verifyDelivery || !canEditOrders) throw new Error('TRANSFUSION_RETURN_CONTEXT');
    const [[latest], cases] = await Promise.all([
      listConsent(paperConsent, recipientConsentSubject(order)),
      listHemovigilance([order]),
    ]);
    const unit = cases.find(
      ({ dispatch: delivered }) =>
        delivered.unitCode === dispatch.unitCode &&
        delivered.component === dispatch.component &&
        Date.parse(delivered.deliveredAt) === Date.parse(dispatch.at),
    );
    if (!unit || !latest || !closesTransfusion(latest.decision)) throw new Error('TRANSFUSION_RETURN_CONTEXT');
    if (mustBeUnused && (unit.sections.conduction?.fields.startTime || unit.sections.report))
      throw new Error('TRANSFUSION_RETURN_STARTED');
    return latest;
  };
  const receiveReturnedUnit = api.receiveReturnedUnit;
  const inspectReturnedUnit = api.inspectReturnedUnit;
  const returnActions: ReturnActions | undefined =
    canEditOrders && verifyDelivery && paperConsent && returnOperator && receiveReturnedUnit && inspectReturnedUnit
      ? {
          operator: returnOperator,
          async receive(dispatch, receipt) {
            const latest = await verifyReturn(dispatch, receipt.administration === 'unused');
            const saved = await receiveReturnedUnit(dispatch.id, latest.uuid, receipt);
            workspace.reload();
            return saved;
          },
          async inspect(dispatch, inspection) {
            await verifyReturn(dispatch, inspection.decision === 'approved');
            const saved = await inspectReturnedUnit(dispatch.id, inspection);
            workspace.reload();
            return saved;
          },
        }
      : undefined;
  const rows: InboxRow[] = [
    ...requests
      .filter((request) => !request.issuedOrder)
      .map((request) => ({ order: request.order, statusKey: transfusionStatusKeys[request.status], request })),
    ...issued
      .filter((item) => !orders.data?.delivered.has(item.order.id))
      .map((item) => {
        const existing = requestById.get(item.order.id);
        const currentConsent = orders.data?.consents?.get(item.order.id);
        const closed = closesTransfusion(currentConsent?.decision);
        const pendingConsent =
          orders.data?.consents?.has(item.order.id) &&
          !currentConsent &&
          item.order.priority !== 'veryUrgent' &&
          !item.stopped &&
          (!item.fulfillerStatus || item.fulfillerStatus === 'RECEIVED');
        const canCheckConsent =
          !paperConsent || !isClinicalUuid(item.order.id) || Boolean(orders.data?.consents?.has(item.order.id));
        const canReceive = canEditOrders && canCheckConsent && !closed && !item.stopped && !item.fulfillerStatus;
        const canPrepare = Boolean(
          useMockData &&
            canCheckConsent &&
            !closed &&
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
          statusKey: closed
            ? currentConsent?.decision === 'declined'
              ? 'txCancelledDeclined'
              : 'txCancelledRevoked'
            : pendingConsent
              ? 'txConsentPending'
              : request && request.status !== 'pending'
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
    ...(readableConfig
      ? [
          'fr08Sent',
          ...Object.values(issuedOrderStatusKeys),
          'fr08Cancelled',
          'txConsentPending',
          'txCancelledDeclined',
        ]
      : []),
  ]);
  const activeCard = statusCards.find((card) => card.filter === status);
  const inbox = rows.filter((item) => item.request?.status !== 'delivered' && item.statusKey !== 'txCancelledRevoked');
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
    if (!item.request && (!item.canPrepare || !api.prepareIssuedRequest)) {
      setSelected({ order: item.order, issued: Boolean(item.issued), attend: Boolean(item.canReceive) });
      return;
    }
    if (preparingRequest.current) return;
    preparingRequest.current = true;
    setPreparing(true);
    setPrepareFailed('');
    try {
      if (item.issued && verifyDelivery && (await listRecordedDeliveries([item.order])).has(item.order.id)) {
        setPrepareFailed('txAlreadyDelivered');
        reloadOrders();
        return;
      }
      if (item.issued && paperConsent && isClinicalUuid(item.order.id)) {
        const [record] = await listConsent(paperConsent, recipientConsentSubject(item.order));
        if (record && closesTransfusion(record.decision)) {
          reloadOrders();
          setSelected({ order: item.order, issued: true, attend: false });
          return;
        }
      }
      if (item.request) setActive(item.request);
      else if (api.prepareIssuedRequest) setActive(await api.prepareIssuedRequest(item.order));
    } catch {
      setPrepareFailed('txSaveFailed');
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
          {canInvestigate && (
            <Button
              kind="tertiary"
              renderIcon={Report}
              disabled={loading || ordersFailed}
              onClick={() => setReactionQueue(true)}
            >
              {t('txReactionQueue')}
            </Button>
          )}
          <Button
            kind="tertiary"
            renderIcon={Book}
            disabled={loading || !loadWorkspace || workspaceFailed}
            onClick={() => setArchive('book')}
          >
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
        {prepareFailed && <InlineNotification hideCloseButton kind="error" title={t(prepareFailed)} />}
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
                {t(item.order.priority === 'veryUrgent' ? 'txVeryUrgentShort' : priorityKeys[item.order.priority])}
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
          beforeDelivery={
            verifyDelivery
              ? async (order) => {
                  if ((await listRecordedDeliveries([order])).has(order.id))
                    throw new Error('TRANSFUSION_ALREADY_DELIVERED');
                }
              : undefined
          }
          onDelivered={verifyDelivery ? recordDemoDispatch : undefined}
          onSaved={() => {
            workspace.reload();
            if (verifyDelivery) reloadOrders();
          }}
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
      {archive === 'history' && (
        <TransfusionHistory
          requests={shownRequests}
          recordedDeliveries={recordedDeliveries}
          consentClosures={consentClosures}
          returnDispatches={workspace.data?.bookEntries}
          returnRecords={workspace.data?.returns}
          returnActions={returnActions}
          onClose={() => setArchive(null)}
          t={t}
        />
      )}
      {reactionQueue && canInvestigate && (
        <BankHemovigilance orders={issued.map(({ order }) => order)} onClose={() => setReactionQueue(false)} />
      )}
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
