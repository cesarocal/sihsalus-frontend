import {
  DataTableSkeleton,
  InlineNotification,
  Button,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  Tile,
} from '@carbon/react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import spanish from '../../translations/es.json';
import { moduleName } from '../constants';
import styles from '../sections/applicant-selection/selection.scss';
import { BloodBankPageIllustration, type BloodBankIllustration } from './blood-bank-page-illustration.component';
import { BloodBankPageHeader } from './blood-bank-page-header.component';

export type ProcessingTranslate = (key: string) => string;
export function useProcessingTranslation() {
  const { t } = useTranslation(moduleName);
  return useCallback(
    (key: string) => String(t(`processing.${key}`, (spanish.processing as Record<string, string>)[key] ?? key)),
    [t],
  );
}
export function useProcessingData<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((value) => value + 1), []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: version is an explicit retry/refresh trigger.
  useEffect(() => {
    let current = true;
    setLoading(true);
    setFailed(false);
    void load()
      .then((value) => {
        if (current) setData(value);
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
  }, [load, version]);
  return { data, loading, failed, reload };
}
export function ProcessingPage({
  title,
  counts,
  children,
  illustration,
}: {
  title: string;
  counts: { label: string; description: string; value: number | string }[];
  children: ReactNode;
  illustration: BloodBankIllustration;
}) {
  return (
    <div className={styles.page}>
      <h1 className="cds--visually-hidden">{title}</h1>
      <BloodBankPageHeader illustration={<BloodBankPageIllustration section={illustration} />} title={title} />
      <div className={styles.content}>
        <section className={styles.summary} aria-label={title}>
          {counts.map((count) => (
            <Tile className={styles.summaryTile} key={count.label}>
              <p>{count.label}</p>
              <small>{count.description}</small>
              <span>{count.value}</span>
            </Tile>
          ))}
        </section>
        {children}
      </div>
    </div>
  );
}
export function ProcessingTable({
  title,
  columns,
  rows,
  loading,
  failed,
  reload,
  emptyHelp,
  filterKey,
  t,
}: {
  title: string;
  columns: string[];
  rows: { id: string; cells: ReactNode[] }[];
  loading: boolean;
  failed: boolean;
  reload: () => void;
  emptyHelp: string;
  filterKey?: string;
  t: ProcessingTranslate;
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  // biome-ignore lint/correctness/useExhaustiveDependencies: filterKey explicitly resets the page, not the chosen page size.
  useEffect(() => setPage(1), [filterKey]);
  const activePage = Math.min(page, Math.max(1, Math.ceil(rows.length / pageSize)));
  if (loading)
    return <DataTableSkeleton columnCount={columns.length} rowCount={5} showHeader={false} showToolbar={false} />;
  if (failed)
    return (
      <div className={styles.empty}>
        <InlineNotification hideCloseButton kind="error" title={t('loadFailed')} subtitle={t('loadFailedHelp')} />
        <Button kind="tertiary" onClick={reload}>
          {t('retry')}
        </Button>
      </div>
    );
  return (
    <>
      <div className={styles.tableScroll}>
        <TableContainer>
          <Table useZebraStyles size="lg" aria-label={title}>
            <TableHead>
              <TableRow>
                {columns.map((column) => (
                  <TableHeader key={column}>{t(column)}</TableHeader>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.slice((activePage - 1) * pageSize, activePage * pageSize).map((row) => (
                <TableRow key={row.id}>
                  {row.cells.map((cell, index) => (
                    <TableCell key={columns[index]}>{cell}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </div>
      {!rows.length && (
        <div className={styles.empty}>
          <Tile>
            <h3>{t('empty')}</h3>
            <p>{emptyHelp}</p>
          </Tile>
        </div>
      )}
      <Pagination
        page={activePage}
        pageSize={pageSize}
        pageSizes={[10, 20, 50]}
        totalItems={rows.length}
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
  );
}
export const normalizeSearch = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase();
