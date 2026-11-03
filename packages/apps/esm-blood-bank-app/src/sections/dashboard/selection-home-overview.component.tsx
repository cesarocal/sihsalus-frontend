import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow, Tag } from '@carbon/react';
import { ArrowRight } from '@carbon/react/icons';
import { Link } from 'react-router-dom';
import { bloodBankPrivileges as p } from '../../access/blood-bank-privileges';
import type { BloodBankApi } from '../../api';
import { dashboardLink } from './dashboard-shortcuts';
import styles from './dashboard.scss';
import { AuthorizedHomeSource, HomeSummary } from './home-overview.component';

type T = (key: string) => string;
export function SelectionHomeOverview({ api, t }: { api: BloodBankApi; t: T }) {
  return (
    <AuthorizedHomeSource privilege={p.applicantSelection} load={api.selection.listApplications}>
      {(applications) => (
        <AuthorizedHomeSource privilege={p.collection} load={api.collection.listCollections}>
          {(collections) => {
            const interviews =
              applications && !applications.loading && !applications.failed
                ? (applications.data ?? []).filter((a) => a.status === 'awaitingInterview')
                : [];
            const queue =
              collections && !collections.loading && !collections.failed
                ? (collections.data ?? []).filter((c) => c.status !== 'completed')
                : [];
            const rows = [
              ...interviews.map((a) => ({
                id: `interview-${a.id}`,
                number: a.number,
                process: t('interviewProcess'),
                status: t('interviewPendingStatus'),
                color: 'cyan' as const,
                action: t('interviewAction'),
                to: dashboardLink('/applicant-selection', { application: a.id }),
              })),
              ...queue.map((c) => ({
                id: `collection-${c.id}`,
                number: c.application.number,
                process: t('collectionProcess'),
                status: t(c.status === 'inProgress' ? 'collectionInProgressStatus' : 'collectionPendingStatus'),
                color: c.status === 'inProgress' ? ('blue' as const) : ('gray' as const),
                action: t('continueCollectionAction'),
                to: dashboardLink('/collection', { collection: c.id }),
              })),
            ].sort(
              (a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }) || a.id.localeCompare(b.id),
            );
            const loading = applications?.loading || collections?.loading;
            const failed = applications?.failed || collections?.failed;
            return (
              <div className={styles.selectionOverview}>
                <div className={styles.selectionSummaries}>
                  <HomeSummary
                    source={applications}
                    count={interviews.length}
                    title={t('interviews')}
                    help={t('interviewsHelp')}
                    to={dashboardLink('/applicant-selection', { status: 'awaitingInterview' })}
                    action={t('viewInterviews')}
                    t={t}
                  />
                  <HomeSummary
                    source={collections}
                    count={queue.length}
                    title={t('collectionQueue')}
                    help={t('collectionQueueHelp')}
                    to="/collection"
                    action={t('viewCollectionQueue')}
                    t={t}
                  />
                </div>
                <TableContainer title={t('selectionPendingTitle')} className={styles.pendingTable}>
                  <Table aria-label={t('selectionPendingTitle')} size="md">
                    <TableHead>
                      <TableRow>
                        {['pendingNumber', 'pendingProcess', 'pendingStatus', 'pendingActions'].map((key) => (
                          <TableHeader key={key}>{t(key)}</TableHeader>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rows.slice(0, 6).map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{row.number}</TableCell>
                          <TableCell>{row.process}</TableCell>
                          <TableCell>
                            <Tag type={row.color}>{row.status}</Tag>
                          </TableCell>
                          <TableCell>
                            <Link className={styles.pendingAction} to={row.to}>
                              {row.action}
                              <ArrowRight size={16} aria-hidden="true" />
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                      {!rows.length && (
                        <TableRow>
                          <TableCell colSpan={4}>
                            {t(loading ? 'loading' : failed ? 'loadFailed' : 'noSelectionPending')}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
                {rows.length > 6 && <p className={styles.previewHelp}>{t('moreSelectionPending')}</p>}
              </div>
            );
          }}
        </AuthorizedHomeSource>
      )}
    </AuthorizedHomeSource>
  );
}
