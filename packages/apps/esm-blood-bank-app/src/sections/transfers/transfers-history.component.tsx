import {
  Button,
  ComposedModal,
  InlineNotification,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Search,
  Select,
  SelectItem,
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
import shared from '../applicant-selection/selection.scss';
import { inventoryDisplayDate } from '../inventory/inventory-rules';
import { componentDefinitions } from '../laboratory/fractionation/fractionation-rules';
import styles from './transfers.scss';
import type { TransferBookEntry, TransferDirection, TransferRequest } from './transfers.types';
import { TransferCertificate, TransferRequestDocument } from './transfers-documents.component';
import { transferDirection, transferStatusKeys } from './transfers-rules';

export function TransfersHistory({
  requests,
  entries,
  onClose,
  t,
  direction = 'incoming',
  initialDetail,
}: {
  requests: TransferRequest[];
  entries: TransferBookEntry[];
  onClose: () => void;
  t: ProcessingTranslate;
  direction?: TransferDirection;
  initialDetail?: TransferRequest;
}) {
  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [detail, setDetail] = useState<TransferRequest | null>(initialDetail ?? null);
  const outgoing = direction === 'outgoing';
  const [failed, setFailed] = useState(false);
  const invalid = !!from && !!to && from > to;
  const range = (date: string) => (!from || date.slice(0, 10) >= from) && (!to || date.slice(0, 10) <= to);
  const matches = (text: string) => normalizeSearch(text).includes(normalizeSearch(search));
  const filteredRequests = requests
    .filter(
      (item) =>
        transferDirection(item) === direction &&
        range(item.data.date) &&
        (!status || item.status === status) &&
        matches(
          `${item.id} ${item.data.office} ${item.data.patientName} ${item.data.patientHistory} ${outgoing ? item.data.destinationInstitution : item.data.requestingInstitution} ${item.preparation.certificateOffice}`,
        ),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const filteredEntries = entries
    .filter(
      (item) =>
        range(item.date) &&
        matches(
          `${item.requestOffice} ${item.certificateOffice} ${item.patientName} ${item.patientHistory} ${item.unitCode} ${item.requestingInstitution}`,
        ),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const print = () => {
    if (!detail) return;
    setFailed(false);
    try {
      printDocument(
        detail.certificateUnits.length ? (
          <TransferCertificate request={detail} t={t} print />
        ) : (
          <TransferRequestDocument request={detail} t={t} print />
        ),
        t(detail.certificateUnits.length ? 'transferCertificate' : 'transferRequestDocument'),
        () => setFailed(true),
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
      aria-label={t('transferHistory')}
    >
      <ModalHeader title={t('transferHistory')} iconDescription={t('close')} closeModal={onClose} />
      <ModalBody>
        {failed && <InlineNotification hideCloseButton kind="error" title={t('printFailed')} />}
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
              {t('transferBackToHistory')}
            </Button>
            {detail.rejectionReason && (
              <p className={styles.notice}>
                {t('transferRejectionReason')}: {detail.rejectionReason}
              </p>
            )}
            {detail.certificateUnits.length ? (
              <TransferCertificate request={detail} t={t} />
            ) : (
              <TransferRequestDocument request={detail} t={t} />
            )}
          </>
        ) : (
          <>
            <div className={styles.toolbar}>
              <Search
                id="transfer-history-search"
                labelText={t('transferSearchHistory')}
                placeholder={t('transferSearchHistory')}
                value={search}
                closeButtonLabelText={t('clearSearch')}
                onChange={(event) => setSearch(event.target.value)}
              />
              {tab === 0 && (
                <Select
                  id="transfer-history-status"
                  labelText={t('status')}
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                >
                  <SelectItem value="" text={t('allStatuses')} />
                  {Object.entries(transferStatusKeys)
                    .filter(([key]) => (outgoing ? ['draft', 'issued'].includes(key) : key !== 'issued'))
                    .map(([key, label]) => (
                      <SelectItem key={key} value={key} text={t(label)} />
                    ))}
                </Select>
              )}
            </div>
            <div className={styles.filters}>
              <TextInput
                id="transfer-history-from"
                type="date"
                labelText={t('transferDateFrom')}
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
              <TextInput
                id="transfer-history-to"
                type="date"
                labelText={t('transferDateTo')}
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </div>
            {invalid && <InlineNotification hideCloseButton kind="warning" title={t('transferDateRangeInvalid')} />}
            <Tabs selectedIndex={tab} onChange={({ selectedIndex }) => setTab(selectedIndex)}>
              <TabList aria-label={t('transferHistory')}>
                <Tab>{t('transferRequests')}</Tab>
                {!outgoing && <Tab>{t('transferBook')}</Tab>}
              </TabList>
              <TabPanels>
                <TabPanel>
                  {!invalid && (
                    <ProcessingTable
                      title={t('transferHistory')}
                      columns={[
                        'transferRequestOffice',
                        'transferRequestDate',
                        outgoing ? 'transferDestinationInstitution' : 'transferRequestingInstitution',
                        'transferPatientName',
                        'status',
                        'actions',
                      ]}
                      rows={filteredRequests.map((item) => ({
                        id: item.id,
                        cells: [
                          item.data.office || item.id,
                          inventoryDisplayDate(item.data.date),
                          outgoing ? item.data.destinationInstitution : item.data.requestingInstitution,
                          item.data.patientName,
                          t(transferStatusKeys[item.status]),
                          <Button key="detail" size="sm" kind="ghost" onClick={() => setDetail(item)}>
                            {t('transferViewDetail')}
                          </Button>,
                        ],
                      }))}
                      loading={false}
                      failed={false}
                      reload={() => {}}
                      emptyHelp={t('transferEmptyHistory')}
                      filterKey={`${search}:${status}:${from}:${to}`}
                      t={t}
                    />
                  )}
                </TabPanel>
                {!outgoing && (
                  <TabPanel>
                    <p className={styles.notice}>{t('transferBookHelp')}</p>
                    {!invalid && (
                      <div className={shared.surface}>
                        <ProcessingTable
                          title={t('transferBook')}
                          columns={[
                            'inventoryUnitNumber',
                            'transferSeal',
                            'fractionationComponent',
                            'transferPatientName',
                            'transferWard',
                            'transferHistoryNumber',
                            'transferDoctor',
                            'transferDoctorLicense',
                            'transferAttendedBy',
                            'transferDischargeDate',
                            'actions',
                          ]}
                          rows={filteredEntries.map((item) => ({
                            id: item.id,
                            cells: [
                              item.unitCode,
                              item.seal,
                              t(componentDefinitions[item.component].key),
                              item.patientName,
                              item.service || '—',
                              item.patientHistory,
                              item.requestingDoctor || t('transferNotRecorded'),
                              item.requestingDoctorLicense || t('transferNotRecorded'),
                              item.deliveredBy,
                              formatDatetime(new Date(item.date), { noToday: true }),
                              <Button
                                key="detail"
                                size="sm"
                                kind="ghost"
                                onClick={() =>
                                  setDetail(requests.find((request) => request.id === item.requestId) ?? null)
                                }
                              >
                                {t('transferViewDetail')}
                              </Button>,
                            ],
                          }))}
                          loading={false}
                          failed={false}
                          reload={() => {}}
                          emptyHelp={t('transferEmptyBook')}
                          filterKey={`${search}:${from}:${to}`}
                          t={t}
                        />
                      </div>
                    )}
                  </TabPanel>
                )}
              </TabPanels>
            </Tabs>
          </>
        )}
      </ModalBody>
      {detail && (
        <ModalFooter className={`${shared.footer} ${styles.printFooter}`}>
          <div>
            <Button kind="ghost" size="sm" renderIcon={Printer} onClick={print}>
              {t(detail.certificateUnits.length ? 'transferPrintCertificate' : 'transferPrintRequest')}
            </Button>
          </div>
        </ModalFooter>
      )}
    </ComposedModal>
  );
}
