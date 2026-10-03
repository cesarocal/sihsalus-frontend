import {
  Button,
  DataTableSkeleton,
  InlineNotification,
  Pagination,
  Search,
  Select,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
  Tile,
} from '@carbon/react';
import { Add } from '@carbon/react/icons';
import { BloodBankPictogram, PageHeader } from '@openmrs/esm-framework';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ApplicantSelectionApi } from '../../api/applicant-selection.api';
import { moduleName } from '../../constants';
import { selectionMessages } from './selection-messages';
import { isFinal, newApplication } from './selection-rules';
import { SelectionWorkflow } from './selection-workflow.component';
import type { ApplicationStatus, SelectionApplication } from './selection.types';
import styles from './selection.scss';

export const applicationStatuses: ApplicationStatus[] = [
  'draft',
  'admitted',
  'awaitingInterview',
  'awaitingQualification',
  'inInterview',
  'selected',
  'deferred',
  'excluded',
];
const statusColors = {
  draft: 'gray',
  admitted: 'blue',
  awaitingInterview: 'cyan',
  awaitingQualification: 'teal',
  inInterview: 'purple',
  selected: 'green',
  deferred: 'magenta',
  excluded: 'red',
} as const;

export function ApplicantSelectionPage({ api }: { api: ApplicantSelectionApi }) {
  const { t: translate } = useTranslation(moduleName);
  const t = useCallback(
    (key: string) => String(translate(`selection.${key}`, selectionMessages[key]?.es ?? key)),
    [translate],
  );
  const [applications, setApplications] = useState<SelectionApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [modality, setModality] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [active, setActive] = useState<SelectionApplication | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [message, setMessage] = useState('');

  // biome-ignore lint/correctness/useExhaustiveDependencies: refresh is an explicit reload trigger after saving or retrying.
  useEffect(() => {
    let current = true;
    setLoading(true);
    setFailed(false);
    void api
      .listApplications()
      .then((rows) => {
        if (current) setApplications(rows);
      })
      .catch(() => {
        if (current) setFailed(true);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [api, refresh]);

  const normalize = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase();
  const filtered = applications.filter(
    (a) =>
      (!status || a.status === status) &&
      (!modality || a.admission.modality === modality) &&
      normalize(
        `${a.number} ${a.admission.documentNumber} ${a.admission.donorCode} ${a.personal.givenName} ${a.personal.familyName}`,
      ).includes(normalize(search.trim())),
  );
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / pageSize)));
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const changeFilter = (set: (value: string) => void, value: string) => {
    set(value);
    setPage(1);
  };
  const saved = (key: string) => {
    setActive(null);
    setMessage(key);
    setRefresh((value) => value + 1);
  };

  return (
    <div className={styles.page}>
      <h1 className="cds--visually-hidden">{t('title')}</h1>
      <PageHeader illustration={<BloodBankPictogram />} title={t('title')} className={styles.pageHeader} />
      <div className={styles.content}>
        <section className={styles.summary} aria-label={t('summary')}>
          {['applications', 'awaitingInterview', 'selected'].map((key) => (
            <Tile key={key} className={styles.summaryTile}>
              <p>{t(key)}</p>
              <span>
                {loading || failed
                  ? '—'
                  : key === 'applications'
                    ? applications.length
                    : applications.filter((a) => a.status === key).length}
              </span>
            </Tile>
          ))}
        </section>
        {message && <InlineNotification kind="success" title={t(message)} onCloseButtonClick={() => setMessage('')} />}
        <div className={styles.listHeading}>
          <h2>{t('applicationList')}</h2>
          <Button
            type="button"
            renderIcon={Add}
            disabled={loading || failed}
            onClick={() => {
              setMessage('');
              setActive(newApplication());
            }}
          >
            {t('newApplication')}
          </Button>
        </div>
        <p className={styles.help}>{t('mockNotice')}</p>
        <div className={styles.surface}>
          <div className={styles.filters}>
            <Select
              id="selection-status-filter"
              labelText={t('status')}
              value={status}
              onChange={(event) => changeFilter(setStatus, event.target.value)}
            >
              <SelectItem value="" text={t('allStatuses')} />
              {applicationStatuses.map((value) => (
                <SelectItem key={value} value={value} text={t(value)} />
              ))}
            </Select>
            <Select
              id="selection-modality-filter"
              labelText={t('modality')}
              value={modality}
              onChange={(event) => changeFilter(setModality, event.target.value)}
            >
              <SelectItem value="" text={t('allModalities')} />
              <SelectItem value="wholeBlood" text={t('wholeBlood')} />
              <SelectItem value="apheresis" text={t('apheresis')} />
            </Select>
            <Search
              id="selection-search"
              labelText={t('searchApplicants')}
              placeholder={t('searchPlaceholder')}
              value={search}
              onChange={(event) => changeFilter(setSearch, event.target.value)}
              closeButtonLabelText={t('clearSearch')}
            />
          </div>
          {loading ? (
            <DataTableSkeleton columnCount={8} rowCount={5} showHeader={false} showToolbar={false} />
          ) : failed ? (
            <div className={styles.empty}>
              <InlineNotification hideCloseButton kind="error" title={t('loadFailed')} subtitle={t('loadFailedHelp')} />
              <Button type="button" kind="tertiary" onClick={() => setRefresh((value) => value + 1)}>
                {t('retry')}
              </Button>
            </div>
          ) : (
            <>
              <div className={styles.tableScroll}>
                <TableContainer>
                  <Table size="lg" useZebraStyles aria-label={t('applicationList')}>
                    <TableHead>
                      <TableRow>
                        {[
                          'number',
                          'date',
                          'applicant',
                          'documentNumber',
                          'donationType',
                          'modality',
                          'status',
                          'actions',
                        ].map((key) => (
                          <TableHeader key={key}>{t(key)}</TableHeader>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {visible.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell>{a.number}</TableCell>
                          <TableCell>{a.admission.date}</TableCell>
                          <TableCell>
                            {`${a.personal.familyName}, ${a.personal.givenName}`.replace(/^,\s*/, '') ||
                              t('personalPending')}
                          </TableCell>
                          <TableCell>
                            {a.admission.documentType} {a.admission.documentNumber}
                          </TableCell>
                          <TableCell>{a.admission.donationType ? t(a.admission.donationType) : '—'}</TableCell>
                          <TableCell>{a.admission.modality ? t(a.admission.modality) : '—'}</TableCell>
                          <TableCell>
                            <Tag type={statusColors[a.status]}>{t(a.status)}</Tag>
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              kind="ghost"
                              size="sm"
                              onClick={() => {
                                setMessage('');
                                setActive(a);
                              }}
                            >
                              {a.status === 'awaitingInterview'
                                ? t('interviewAction')
                                : isFinal(a)
                                  ? t('viewApplication')
                                  : t('resume')}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </div>
              {!filtered.length && (
                <div className={styles.empty}>
                  <Tile>
                    <h3>{t('emptyList')}</h3>
                    <p>{t('emptyListHelp')}</p>
                  </Tile>
                </div>
              )}
              <Pagination
                page={currentPage}
                pageSize={pageSize}
                pageSizes={[10, 20, 50]}
                totalItems={filtered.length}
                itemsPerPageText={t('itemsPerPage')}
                pageNumberText={t('page')}
                itemRangeText={(min, max, total) => `${min}–${max} ${t('of')} ${total} ${t('items')}`}
                pageRangeText={(_current, total) => `${t('of')} ${total} ${t('pages')}`}
                pageSelectLabelText={() => t('choosePage')}
                backwardText={t('previousPage')}
                forwardText={t('nextPage')}
                onChange={({ page: next, pageSize: size }) => {
                  setPage(next);
                  setPageSize(size);
                }}
              />
            </>
          )}
        </div>
      </div>
      {active && (
        <SelectionWorkflow application={active} api={api} t={t} onClose={() => setActive(null)} onSaved={saved} />
      )}
    </div>
  );
}
