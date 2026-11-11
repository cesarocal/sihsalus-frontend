import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
} from '@carbon/react';
import { ArrowRight } from '@carbon/react/icons';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { bloodBankPrivileges as p } from '../../access/blood-bank-privileges';
import type { BloodBankApi } from '../../api';
import { useProcessingTranslation } from '../../shared/processing-page.component';
import { componentDefinitions, eligibleSource } from '../laboratory/fractionation/fractionation-rules';
import { screeningCategory, screeningOriginLabel } from '../laboratory/screening/screening-rules';
import { screeningQueueStatus } from '../laboratory/screening/screening-repeat-rules';
import { comparePriority } from '../transfusions/transfusions-rules';
import { dashboardLink } from './dashboard-shortcuts';
import { AuthorizedHomeSource, HomeSummary, type HomeSourceState } from './home-overview.component';
import styles from './dashboard.scss';

type Filter = 'all' | 'screening' | 'compatibility' | 'fractionation';
const filterKeys: Record<Filter, string> = {
  all: 'allLaboratoryPending',
  screening: 'screeningProcess',
  compatibility: 'compatibilityProcess',
  fractionation: 'fractionationProcess',
};
function ready<TData>(source: HomeSourceState<TData> | null) {
  return source && !source.loading && !source.failed ? source.data : null;
}

export function LaboratoryHomeOverview({ api, t }: { api: BloodBankApi; t: (key: string) => string }) {
  const processingT = useProcessingTranslation();
  const [filter, setFilter] = useState<Filter>('all');
  return (
    <AuthorizedHomeSource privilege={p.screening} load={api.screening.listScreenings}>
      {(screenings) => (
        <AuthorizedHomeSource privilege={p.compatibility} load={api.transfusions.list}>
          {(compatibility) => (
            <AuthorizedHomeSource privilege={p.fractionation} load={api.fractionation.list}>
              {(fractionation) => {
                const samples = (ready(screenings) ?? [])
                  .filter(
                    (record) => screeningQueueStatus(record) !== 'validated' && screeningCategory(record) !== null,
                  )
                  .sort((a, b) => a.collectedOn.localeCompare(b.collectedOn));
                const donors = samples.filter((record) => screeningCategory(record) === 'donors');
                const followUps = samples.filter((record) => screeningCategory(record) === 'followUps');
                const rounds = (ready(compatibility)?.requests ?? [])
                  .flatMap((request) => request.rounds.map((round) => ({ request, round })))
                  .filter(({ round }) => !round.completedAt)
                  .sort((a, b) =>
                    comparePriority(
                      { priority: a.request.order.priority, date: a.round.createdAt },
                      { priority: b.request.order.priority, date: b.round.createdAt },
                    ),
                  );
                const units = (ready(fractionation)?.units ?? [])
                  .filter(eligibleSource)
                  .sort((a, b) => a.collectedAt.localeCompare(b.collectedAt) || a.code.localeCompare(b.code));
                const sources = { screening: screenings, compatibility, fractionation };
                const current = filter !== 'all' && !sources[filter] ? 'all' : filter;
                const relevant = current === 'all' ? Object.values(sources) : [sources[current]];
                const loading = relevant.some((source) => source?.loading);
                const failed = relevant.some((source) => source?.failed);
                const rows = [
                  ...samples.map((record) => ({
                    id: `screening-${record.id}`,
                    code: record.sampleCode,
                    origin: processingT(screeningOriginLabel(record)),
                    category: 'screening' as const,
                    action:
                      screeningQueueStatus(record) === 'screeningRepeatPending'
                        ? processingT('screeningRepeatRegister')
                        : t('screeningAction'),
                    to: dashboardLink('/laboratory/screening', {
                      category: screeningCategory(record) ?? 'donors',
                      screening: record.id,
                    }),
                  })),
                  ...rounds.map(({ request, round }) => ({
                    id: `compatibility-${round.id}`,
                    code: round.sample.code,
                    origin: `${t('requestReference')} ${request.order.number}`,
                    category: 'compatibility' as const,
                    action: t('compatibilityAction'),
                    to: dashboardLink('/laboratory/compatibility', { round: round.id }),
                  })),
                  ...units.map((unit) => ({
                    id: `fractionation-${unit.id}`,
                    code: unit.code,
                    origin: processingT(componentDefinitions[unit.component].key),
                    category: 'fractionation' as const,
                    action: t('fractionationAction'),
                    to: dashboardLink('/laboratory/fractionation', { category: 'eligible', unit: unit.id }),
                  })),
                ].filter((row) => current === 'all' || current === row.category);
                return (
                  <div className={styles.selectionOverview}>
                    <div className={`${styles.selectionSummaries} ${styles.laboratorySummaries}`}>
                      <HomeSummary
                        source={screenings}
                        count={donors.length}
                        title={t('donorSamples')}
                        help={t('donorSamplesSummary')}
                        action={t('viewSamples')}
                        to={dashboardLink('/laboratory/screening', { category: 'donors' })}
                        t={t}
                      />
                      <HomeSummary
                        source={screenings}
                        count={followUps.length}
                        title={t('followUpSamples')}
                        help={t('followUpSamplesSummary')}
                        action={t('viewSamples')}
                        to={dashboardLink('/laboratory/screening', { category: 'followUps' })}
                        t={t}
                      />
                      <HomeSummary
                        source={compatibility}
                        count={rounds.length}
                        title={t('compatibility')}
                        help={t('compatibilitySummary')}
                        action={t('viewGroups')}
                        to="/laboratory/compatibility"
                        t={t}
                      />
                      <HomeSummary
                        source={fractionation}
                        count={units.length}
                        title={t('fractionation')}
                        help={t('fractionationSummary')}
                        action={t('viewUnits')}
                        to={dashboardLink('/laboratory/fractionation', { category: 'eligible' })}
                        t={t}
                      />
                    </div>
                    <div className={styles.pendingFilters} role="group" aria-label={t('laboratoryFilter')}>
                      {(['all', 'screening', 'compatibility', 'fractionation'] as const)
                        .filter((value) => value === 'all' || sources[value])
                        .map((value) => (
                          <Button
                            key={value}
                            size="sm"
                            kind={current === value ? 'primary' : 'tertiary'}
                            aria-pressed={current === value}
                            onClick={() => setFilter(value)}
                          >
                            {t(filterKeys[value])}
                          </Button>
                        ))}
                    </div>
                    <TableContainer title={t('laboratoryPendingTitle')} className={styles.pendingTable}>
                      <Table aria-label={t('laboratoryPendingTitle')} size="md">
                        <TableHead>
                          <TableRow>
                            {['pendingCode', 'pendingOrigin', 'pendingProcess', 'pendingActions'].map((key) => (
                              <TableHeader key={key}>{t(key)}</TableHeader>
                            ))}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {rows.slice(0, 6).map((row) => (
                            <TableRow key={row.id}>
                              <TableCell>{row.code}</TableCell>
                              <TableCell>{row.origin}</TableCell>
                              <TableCell>
                                <Tag type="gray">{t(filterKeys[row.category])}</Tag>
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
                                {t(loading ? 'loading' : failed ? 'loadFailed' : 'noLaboratoryPending')}
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                    {!!rows.length && (loading || failed) && (
                      <p className={styles.previewHelp} role="status">
                        {t(loading ? 'loading' : 'loadFailed')}
                      </p>
                    )}
                    {rows.length > 6 && <p className={styles.previewHelp}>{t('moreLaboratoryPending')}</p>}
                  </div>
                );
              }}
            </AuthorizedHomeSource>
          )}
        </AuthorizedHomeSource>
      )}
    </AuthorizedHomeSource>
  );
}
