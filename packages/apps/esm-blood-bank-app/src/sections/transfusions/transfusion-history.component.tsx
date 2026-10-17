import {
  Button,
  ComposedModal,
  InlineNotification,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Search,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  TextInput,
} from '@carbon/react';
import { ArrowLeft, Printer } from '@carbon/react/icons';
import { formatDatetime } from '@openmrs/esm-framework';
import { useState } from 'react';
import { printDocument } from '../../shared/print-document';
import { normalizeSearch, ProcessingTable, type ProcessingTranslate } from '../../shared/processing-page.component';
import { TransfusionDetails } from './transfusion-details.component';
import { CompatibilityReport } from './transfusion-print.component';
import styles from './transfusions.scss';
import type { TransfusionBookEntry, TransfusionRequest } from './transfusions.types';
import { priorityKeys, transfusionLocalDay, transfusionStatusKeys } from './transfusions-rules';

export function TransfusionHistory({
  requests,
  entries,
  onClose,
  t,
  compatibility = false,
}: {
  requests: TransfusionRequest[];
  entries: TransfusionBookEntry[];
  onClose: () => void;
  t: ProcessingTranslate;
  compatibility?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [detail, setDetail] = useState<TransfusionRequest | null>(null);
  const [failed, setFailed] = useState(false);
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
  const filtered = requests
    .filter(
      (item) =>
        (compatibility ? item.rounds.some((round) => !!round.completedAt) : item.status === 'delivered') &&
        range(historyDate(item)) &&
        matches(`${item.order.number} ${item.order.patientName} ${item.order.historyNumber}`),
    )
    .sort((a, b) => historyDate(b).localeCompare(historyDate(a)));
  const book = entries
    .filter(
      (item) =>
        range(item.at) && matches(`${item.unitCode} ${item.orderNumber} ${item.patientName} ${item.historyNumber}`),
    )
    .sort((a, b) => b.at.localeCompare(a.at));
  const print = () => {
    if (!detail) return;
    setFailed(false);
    try {
      printDocument(<CompatibilityReport request={detail} t={t} print />, t('txCompatibilityReport'), () =>
        setFailed(true),
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
      aria-label={t(compatibility ? 'txCompatibilityHistory' : 'txHistory')}
    >
      <ModalHeader
        title={t(compatibility ? 'txCompatibilityHistory' : 'txHistory')}
        iconDescription={t('close')}
        closeModal={onClose}
      />
      <ModalBody>
        {failed && <InlineNotification kind="error" hideCloseButton title={t('printFailed')} />}
        {detail ? (
          <>
            <Button
              kind="ghost"
              size="sm"
              renderIcon={ArrowLeft}
              onClick={() => {
                setDetail(null);
                setFailed(false);
              }}
            >
              {t('txBackHistory')}
            </Button>
            <TransfusionDetails request={detail} t={t} />
            <CompatibilityReport request={detail} t={t} />
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
        ) : (
          <>
            <div className={styles.toolbar}>
              <Search
                id="tx-history-search"
                labelText={t('txSearch')}
                placeholder={t('txSearch')}
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
            ) : (
              <Tabs>
                <TabList aria-label={t('txHistory')}>
                  <Tab>{t('txRequests')}</Tab>
                  {!compatibility && <Tab>{t('txBook')}</Tab>}
                </TabList>
                <TabPanels>
                  <TabPanel>
                    <ProcessingTable
                      title={t('txHistory')}
                      columns={[
                        'txNumber',
                        'txPatient',
                        'txHistoryNumber',
                        'txPriority',
                        'status',
                        compatibility ? 'txResultAt' : 'txDeliveredAt',
                        'actions',
                      ]}
                      rows={filtered.map((item) => ({
                        id: item.id,
                        cells: [
                          item.order.number,
                          item.order.patientName,
                          item.order.historyNumber,
                          t(priorityKeys[item.order.priority]),
                          t(transfusionStatusKeys[item.status]),
                          formatDatetime(new Date(historyDate(item)), { noToday: true }),
                          <Button key="detail" kind="ghost" size="sm" onClick={() => setDetail(item)}>
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
                  </TabPanel>
                  {!compatibility && (
                    <TabPanel>
                      <p>{t('txBookHelp')}</p>
                      <ProcessingTable
                        title={t('txBook')}
                        columns={[
                          'inventoryUnitNumber',
                          'txSeal',
                          'txPatient',
                          'txService',
                          'txHistoryNumber',
                          'txDoctor',
                          'txDoctorLicense',
                          'txDeliveredBy',
                          'txDeliveredAt',
                        ]}
                        rows={book.map((item) => ({
                          id: item.id,
                          cells: [
                            item.unitCode,
                            item.seal,
                            item.patientName,
                            item.service,
                            item.historyNumber,
                            item.doctor,
                            item.doctorLicense || '—',
                            item.attendedBy,
                            formatDatetime(new Date(item.at), { noToday: true }),
                          ],
                        }))}
                        loading={false}
                        failed={false}
                        reload={() => {}}
                        emptyHelp={t('txEmptyHistory')}
                        filterKey={`${search}:${from}:${to}`}
                        t={t}
                      />
                    </TabPanel>
                  )}
                </TabPanels>
              </Tabs>
            )}
          </>
        )}
      </ModalBody>
      {detail && (
        <ModalFooter className={styles.printFooter}>
          <div>
            <Button kind="tertiary" className={styles.printButton} size="sm" renderIcon={Printer} onClick={print}>
              {t('txPrintResults')}
            </Button>
          </div>
        </ModalFooter>
      )}
    </ComposedModal>
  );
}
