import { Button, InlineLoading } from '@carbon/react';
import { ArrowRight } from '@carbon/react/icons';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { BloodBankPrivilege } from '../../access/blood-bank-privileges';
import { useProcessingData } from '../../shared/processing-page.component';
import styles from './dashboard.scss';

export type HomeSourceState<TData> = ReturnType<typeof useProcessingData<TData>>;

function SourceData<TData>({
  load,
  children,
}: {
  load: () => Promise<TData>;
  children: (source: HomeSourceState<TData>) => ReactNode;
}) {
  return children(useProcessingData(load));
}

/** Mount each read only under its operational privilege; share it with the summary and preview. */
export function AuthorizedHomeSource<TData>({
  privilege,
  load,
  children,
}: {
  privilege: BloodBankPrivilege;
  load: () => Promise<TData>;
  children: (source: HomeSourceState<TData> | null) => ReactNode;
}) {
  return (
    <RequirePrivilege privilege={privilege} fallback={children(null)}>
      <SourceData load={load}>{children}</SourceData>
    </RequirePrivilege>
  );
}

export function HomeSummary<TData>({
  source,
  count,
  title,
  help,
  to,
  action,
  t,
}: {
  source: HomeSourceState<TData> | null;
  count: number;
  title: string;
  help: string;
  to: string;
  action: string;
  t: (key: string) => string;
}) {
  if (!source) return null;
  if (source.loading)
    return (
      <div className={styles.selectionSummary}>
        <InlineLoading description={t('loading')} />
      </div>
    );
  if (source.failed || !source.data)
    return (
      <div className={styles.selectionSummary} role="alert">
        <p>{t('loadFailed')}</p>
        <Button kind="ghost" size="sm" onClick={source.reload}>
          {t('retry')}
        </Button>
      </div>
    );
  return (
    <Link className={styles.selectionSummary} to={to} aria-label={`${title}: ${count}`}>
      <strong>{count}</strong>
      <span>
        <span className={styles.selectionSummaryTitle}>{title}</span>
        <span className={styles.selectionSummaryHelp}>{help}</span>
        <span className={styles.selectionSummaryAction}>
          {action}
          <ArrowRight size={16} aria-hidden="true" />
        </span>
      </span>
    </Link>
  );
}
