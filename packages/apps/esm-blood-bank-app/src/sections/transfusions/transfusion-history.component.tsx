import { Button, ComposedModal, InlineNotification, ModalBody, ModalHeader, Search, TextInput } from '@carbon/react';
import { ArrowLeft, Printer } from '@carbon/react/icons';
import { formatDatetime } from '@openmrs/esm-framework';
import { useState } from 'react';
import { printDocument } from '../../shared/print-document';
import { normalizeSearch, ProcessingTable, type ProcessingTranslate } from '../../shared/processing-page.component';
import { componentDefinitions } from '../laboratory/fractionation/fractionation-rules';
import { PaperConsentHistory, PaperConsentSummary, usePaperConsent } from '../consents/paper-consent.component';
import { type ConsentRecord, recipientConsentSubject } from '../consents/paper-consent.resource';
import { Fr08Document } from './fr08-document.component';
import { TransfusionDetails } from './transfusion-details.component';
import { CompatibilityReport, compatibilityReportPrintCss } from './transfusion-print.component';
import { type ReturnActions, TransfusionReturns } from './transfusion-returns.component';
import styles from './transfusions.scss';
import type {
  TransfusionBookEntry,
  TransfusionOrder,
  TransfusionRequest,
  TransfusionReturnView,
} from './transfusions.types';
import {
  compatibilityReportReady,
  priorityKeys,
  transfusionLocalDay,
  transfusionStatusKeys,
} from './transfusions-rules';

type ConsentClosure = { order: TransfusionOrder; record: ConsentRecord; dispatched: boolean };

function ConsentClosureDetail({ closure, t }: { closure: ConsentClosure; t: ProcessingTranslate }) {
  const subject = recipientConsentSubject(closure.order);
  const query = usePaperConsent(subject);
  return (
    <>
      <PaperConsentSummary query={query} subject={subject} />
      <PaperConsentHistory records={query.records} />
      {closure.dispatched && <InlineNotification kind="warning" hideCloseButton title={t('txConsentReturn')} />}
    </>
  );
}

export function TransfusionHistory({
  requests = [],
  bookEntries,
  recordedDeliveries = [],
  consentClosures = [],
  returnDispatches = [],
  returnRecords = [],
  returnActions,
  onClose,
  t,
  compatibility = false,
}: { onClose: () => void; t: ProcessingTranslate } & (
  | {
      requests: TransfusionRequest[];
      compatibility?: boolean;
      bookEntries?: never;
      recordedDeliveries?: { order: TransfusionOrder; deliveredAt: string }[];
      consentClosures?: ConsentClosure[];
      returnDispatches?: TransfusionBookEntry[];
      returnRecords?: TransfusionReturnView[];
      returnActions?: ReturnActions;
    }
  | {
      bookEntries: TransfusionBookEntry[];
      requests?: never;
      compatibility?: never;
      recordedDeliveries?: never;
      consentClosures?: never;
      returnDispatches?: never;
      returnRecords?: never;
      returnActions?: never;
    }
)) {
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [detail, setDetail] = useState<TransfusionRequest | null>(null);
  const [closureDetail, setClosureDetail] = useState<ConsentClosure>();
  const [recordedDetail, setRecordedDetail] = useState<{ order: TransfusionOrder; closure?: ConsentClosure }>();
  const reportReady = detail && compatibilityReportReady(detail);
  const [failed, setFailed] = useState(false);
  const title = t(bookEntries ? 'txBook' : compatibility ? 'txCompatibilityHistory' : 'txHistory');
  const searchLabel = t(bookEntries ? 'txBookSearch' : 'txSearch');
  const matches = (text: string) => normalizeSearch(text).includes(normalizeSearch(search));
  const range = (at: string) => {
    const day = transfusionLocalDay(at);
    return !!day && (!from || day >= from) && (!to || day <= to);
  };
  const historyDate = (item: TransfusionRequest) =>
    compatibility
      ? (item.rounds.filter((round) => !!round.completedAt).at(-1)?.completedAt ?? item.order.requestedAt)
      : (item.deliveredAt ?? item.order.requestedAt);
  const invalid = !!from && !!to && from > to;
  const hasPostDispatchResults = bookEntries?.some((item) => item.compatibilityPendingAtDispatch);
  const localHistory = requests.filter((item) =>
    compatibility ? item.rounds.some((round) => !!round.completedAt) : item.status === 'delivered',
  );
  const localIds = new Set(localHistory.map((request) => request.order.id));
  const filtered: {
    id: string;
    order: TransfusionOrder;
    at: string;
    statusKey: string;
    request?: TransfusionRequest;
    closure?: ConsentClosure;
  }[] = [
    ...localHistory.map((request) => ({
      id: request.id,
      order: request.order,
      at: historyDate(request),
      statusKey: transfusionStatusKeys[request.status],
      request,
    })),
    ...recordedDeliveries
      .filter(({ order }) => !localIds.has(order.id))
      .map(({ order, deliveredAt }) => ({
        id: order.id,
        order,
        at: deliveredAt,
        statusKey: transfusionStatusKeys.delivered,
        request: undefined,
      })),
    ...consentClosures.map((closure) => ({
      id: `${closure.order.id}/${closure.record.uuid}`,
      order: closure.order,
      at: closure.record.decidedAt,
      statusKey: closure.record.decision === 'declined' ? 'txCancelledDeclined' : 'txCancelledRevoked',
      ...(closure.dispatched ? {} : { request: requests.find((request) => request.order.id === closure.order.id) }),
      closure,
    })),
  ];
  const filteredRows = filtered
    .filter(({ order, at }) => range(at) && matches(`${order.number} ${order.patientName} ${order.historyNumber}`))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const book = bookEntries
    ?.map((item) => {
      const component = componentDefinitions[item.component];
      return { ...item, componentLabel: component ? t(component.key) : '—' };
    })
    .filter(
      (item) =>
        range(item.at) &&
        matches(
          `${item.unitCode} ${item.seal} ${item.componentLabel} ${item.orderNumber} ${item.patientName} ${item.historyNumber}`,
        ),
    )
    .sort((a, b) => b.at.localeCompare(a.at));
  const print = () => {
    if (!detail || !reportReady) return;
    setFailed(false);
    try {
      printDocument(
        <CompatibilityReport request={detail} t={t} print history />,
        t('txCompatibilityReport'),
        () => setFailed(true),
        compatibilityReportPrintCss,
      );
    } catch {
      setFailed(true);
    }
  };
  return (
    <ComposedModal
      open
      size="lg"
      className={styles.modal}
      preventCloseOnClickOutside
      onClose={onClose}
      aria-label={title}
    >
      <ModalHeader title={title} iconDescription={t('close')} closeModal={onClose} />
      <ModalBody>
        {failed && <InlineNotification kind="error" hideCloseButton title={t('printFailed')} />}
        {detail ? (
          <>
            <div className={styles.historyDetailActions}>
              <Button
                kind="ghost"
                size="sm"
                renderIcon={ArrowLeft}
                onClick={() => {
                  setDetail(null);
                  setClosureDetail(undefined);
                  setFailed(false);
                }}
              >
                {t('txBackHistory')}
              </Button>
              <Button
                kind="tertiary"
                className={styles.printButton}
                size="sm"
                renderIcon={Printer}
                disabled={!reportReady}
                onClick={print}
              >
                {t('txPrintResults')}
              </Button>
            </div>
            <TransfusionDetails request={detail} t={t} />
            {closureDetail && <ConsentClosureDetail closure={closureDetail} t={t} />}
            <CompatibilityReport request={detail} t={t} history />
            <section className={styles.panel}>
              <h4>{t('txStateHistory')}</h4>
              {detail.events.map((event) => (
                <p key={event.id ?? `${event.at}/${event.status}`}>
                  {formatDatetime(new Date(event.at), { noToday: true })} · {t(transfusionStatusKeys[event.status])} ·{' '}
                  {event.actor}
                </p>
              ))}
            </section>
          </>
        ) : recordedDetail ? (
          <>
            <Button kind="ghost" size="sm" renderIcon={ArrowLeft} onClick={() => setRecordedDetail(undefined)}>
              {t('txBackHistory')}
            </Button>
            {!recordedDetail.closure?.dispatched && <Fr08Document order={recordedDetail.order} t={t} />}
            {recordedDetail.closure && <ConsentClosureDetail closure={recordedDetail.closure} t={t} />}
            {recordedDetail.closure?.dispatched && (
              <>
                <TransfusionReturns
                  dispatches={returnDispatches.filter((entry) => entry.requestId === recordedDetail.order.id)}
                  records={returnRecords}
                  actions={returnActions}
                  t={t}
                />
                <Fr08Document order={recordedDetail.order} t={t} />
              </>
            )}
          </>
        ) : (
          <>
            <div className={styles.toolbar}>
              <Search
                id="tx-history-search"
                labelText={searchLabel}
                placeholder={searchLabel}
                closeButtonLabelText={t('clearSearch')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className={styles.fields}>
              <TextInput
                type="date"
                id="tx-history-from"
                labelText={t('txDateFrom')}
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
              <TextInput
                type="date"
                id="tx-history-to"
                labelText={t('txDateTo')}
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            {invalid ? (
              <InlineNotification kind="warning" hideCloseButton title={t('txInvalidRange')} />
            ) : book ? (
              <>
                <p>{t('txBookHelp')}</p>
                <ProcessingTable
                  title={title}
                  columns={[
                    'inventoryUnitNumber',
                    'fractionationComponent',
                    'txSeal',
                    'txPatient',
                    'txService',
                    'txHistoryNumber',
                    'txDoctor',
                    'txDoctorLicense',
                    'txDeliveredBy',
                    'txDeliveredAt',
                    ...(hasPostDispatchResults ? ['txCompatibilityAtDispatch', 'txPostDispatchResult'] : []),
                  ]}
                  rows={book.map((item) => ({
                    id: item.id,
                    cells: [
                      item.unitCode,
                      item.componentLabel,
                      item.seal,
                      item.patientName,
                      item.service,
                      item.historyNumber,
                      item.doctor,
                      item.doctorLicense || '—',
                      item.attendedBy,
                      formatDatetime(new Date(item.at), { noToday: true }),
                      ...(hasPostDispatchResults
                        ? [
                            item.compatibilityPendingAtDispatch ? t('txResultPending') : '—',
                            item.compatibilityAfterDispatch
                              ? `${t(item.compatibilityAfterDispatch.result === 'compatible' ? 'txCompatible' : 'txIncompatible')} · ${formatDatetime(new Date(item.compatibilityAfterDispatch.at), { noToday: true })}`
                              : '—',
                          ]
                        : []),
                    ],
                  }))}
                  loading={false}
                  failed={false}
                  reload={() => {}}
                  emptyHelp={t('txEmptyHistory')}
                  filterKey={`${search}:${from}:${to}`}
                  t={t}
                />
              </>
            ) : (
              <ProcessingTable
                title={title}
                columns={[
                  'txNumber',
                  'txPatient',
                  'txHistoryNumber',
                  'txPriority',
                  'status',
                  compatibility ? 'txResultAt' : consentClosures.length ? 'txHistoryEventAt' : 'txDeliveredAt',
                  'actions',
                ]}
                rows={filteredRows.map((item) => ({
                  id: item.id,
                  cells: [
                    item.order.number,
                    item.order.patientName,
                    item.order.historyNumber,
                    t(item.order.priority === 'veryUrgent' ? 'txVeryUrgentShort' : priorityKeys[item.order.priority]),
                    t(item.statusKey),
                    formatDatetime(new Date(item.at), { noToday: true }),
                    <Button
                      key="detail"
                      kind="ghost"
                      size="sm"
                      onClick={() => {
                        if (item.request) {
                          setDetail(item.request);
                          setClosureDetail(item.closure);
                        } else {
                          setRecordedDetail({ order: item.order, closure: item.closure });
                        }
                      }}
                    >
                      {t('txViewDetail')}
                    </Button>,
                  ],
                }))}
                loading={false}
                failed={false}
                reload={() => {}}
                emptyHelp={t('txEmptyHistory')}
                filterKey={`${search}:${from}:${to}`}
                t={t}
              />
            )}
          </>
        )}
      </ModalBody>
    </ComposedModal>
  );
}
