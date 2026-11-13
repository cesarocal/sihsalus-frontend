import { Button, InlineLoading } from '@carbon/react';
import {
  ArrowRight,
  Chemistry,
  InventoryManagement,
  Renew,
  TaskComplete,
  UserFollow,
  WarningAlt,
} from '@carbon/react/icons';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import { type ReactNode, useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import spanish from '../../../translations/es.json';
import { bloodBankPrivileges as p } from '../../access/blood-bank-privileges';
import { ProtectedSection } from '../../access/protected-section.component';
import { RequireAnyPrivilege } from '../../access/require-any-privilege.component';
import type { BloodBankApi } from '../../api';
import { moduleName } from '../../constants';
import { ProcessingPage, useProcessingData } from '../../shared/processing-page.component';
import type { InventoryUnit } from '../inventory/inventory.types';
import { inventoryDisplayDate } from '../inventory/inventory-rules';
import { eligibleSource } from '../laboratory/fractionation/fractionation-rules';
import { screeningCategory } from '../laboratory/screening/screening-rules';
import { screeningQueueStatus } from '../laboratory/screening/screening-repeat-rules';
import { transferDirection } from '../transfers/transfers-rules';
import { dashboardLink, expiresSoon } from './dashboard-shortcuts';
import styles from './dashboard.scss';
import { SelectionHomeOverview } from './selection-home-overview.component';
import { LaboratoryHomeOverview } from './laboratory-home-overview.component';

type T = (key: string) => string;
/** Mount data sources only after both view and destination privileges are granted. */
function HomeAccess({
  children,
  t,
  privileges = [p.homeSelection, p.homeLaboratory, p.homeInventory, p.homeSupervisor],
  fallback = <p className={styles.empty}>{t('noViews')}</p>,
}: {
  children: ReactNode;
  t: T;
  privileges?: string[];
  fallback?: ReactNode;
}) {
  const [first, ...rest] = privileges;
  if (!first) return fallback;
  return (
    <RequirePrivilege
      privilege={first}
      fallback={
        <HomeAccess t={t} privileges={rest} fallback={fallback}>
          {children}
        </HomeAccess>
      }
    >
      {children}
    </RequirePrivilege>
  );
}
/** Count distinct Home privileges through the same guards used by the content. */
function HomeLayout({
  children,
  privileges = [p.homeSelection, p.homeLaboratory, p.homeInventory, p.homeSupervisor],
  count = 0,
  supervisor = false,
}: {
  children: (mode: 'focused' | 'mosaic') => ReactNode;
  privileges?: string[];
  count?: number;
  supervisor?: boolean;
}) {
  const [first, ...rest] = privileges;
  if (!first) {
    const mode = supervisor || count >= 2 ? 'mosaic' : 'focused';
    return (
      <div className={`${styles.home} ${styles[mode]}`} data-home-layout={mode}>
        {children(mode)}
      </div>
    );
  }
  return (
    <RequirePrivilege
      privilege={first}
      fallback={
        <HomeLayout privileges={rest} count={count} supervisor={supervisor}>
          {children}
        </HomeLayout>
      }
    >
      <HomeLayout privileges={rest} count={count + 1} supervisor={supervisor || first === p.homeSupervisor}>
        {children}
      </HomeLayout>
    </RequirePrivilege>
  );
}
function Card({
  count,
  label,
  description,
  to,
  t,
}: {
  count: number;
  label: string;
  description: string;
  to: string;
  t: T;
}) {
  return (
    <Link className={styles.card} to={to} aria-label={`${label}: ${count}`}>
      <strong>{count}</strong>
      <span className={styles.cardLabel}>{label}</span>
      <span className={styles.cardDescription}>{description}</span>
      <small className={styles.cardAction}>
        <span>{t('openTask')}</span>
        <ArrowRight size={16} aria-hidden="true" />
      </small>
    </Link>
  );
}
function Source<TData>({
  load,
  children,
  t,
}: {
  load: () => Promise<TData>;
  children: (data: TData) => ReactNode;
  t: T;
}) {
  return (
    <SourceContent source={useProcessingData(load)} t={t}>
      {children}
    </SourceContent>
  );
}
function SourceContent<TData>({
  source,
  children,
  t,
}: {
  source: ReturnType<typeof useProcessingData<TData>>;
  children: (data: TData) => ReactNode;
  t: T;
}) {
  const { data, loading, failed, reload } = source;
  if (loading) return <InlineLoading description={t('loading')} />;
  if (failed || !data)
    return (
      <div role="alert">
        <p>{t('loadFailed')}</p>
        <Button kind="ghost" size="sm" onClick={reload}>
          {t('retry')}
        </Button>
      </div>
    );
  return <div className={styles.source}>{children(data)}</div>;
}
type InventorySource = ReturnType<typeof useProcessingData<{ units: InventoryUnit[] }>>;
function InventoryData({ api, children }: { api: BloodBankApi; children: (source: InventorySource) => ReactNode }) {
  const load = useCallback(() => api.inventory.list(), [api]);
  return children(useProcessingData(load));
}
/** Share one authorized inventory read between the summary and the final alerts. */
function HomeInventoryData({
  api,
  t,
  children,
}: {
  api: BloodBankApi;
  t: T;
  children: (source: InventorySource | null) => ReactNode;
}) {
  const withoutInventory = children(null);
  return (
    <RequirePrivilege privilege={p.inventory} fallback={withoutInventory}>
      <HomeAccess t={t} privileges={[p.homeInventory, p.homeSupervisor]} fallback={withoutInventory}>
        <InventoryData api={api}>{children}</InventoryData>
      </HomeAccess>
    </RequirePrivilege>
  );
}
function InventoryCards({ source, days, t }: { source: InventorySource | null; days: number; t: T }) {
  if (!source) return null;
  return (
    <SourceContent source={source} t={t}>
      {({ units }) => {
        const soon = units
          .filter((u) => expiresSoon(u.expiresAt, days))
          .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
        return (
          <>
            <Card
              label={t('suitableUnits')}
              description={t('suitableUnitsHelp')}
              count={units.filter((u) => u.status === 'APTO').length}
              to={dashboardLink('/inventory', { status: 'APTO' })}
              t={t}
            />
            <Card
              label={t('sealPending')}
              description={t('sealPendingHelp')}
              count={units.filter((unit) => unit.status === 'Sello pendiente').length}
              to={dashboardLink('/inventory', { category: 'seal' })}
              t={t}
            />
            <Card
              label={t('expiringUnits')}
              description={t('expiringUnitsHelp')}
              count={soon.length}
              to={dashboardLink('/inventory', { expires: days })}
              t={t}
            />
          </>
        );
      }}
    </SourceContent>
  );
}
function InventoryAlerts({ source, days, t }: { source: InventorySource | null; days: number; t: T }) {
  if (!source?.data || source.loading || source.failed) return null;
  const soon = source.data.units
    .filter((u) => expiresSoon(u.expiresAt, days))
    .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
  return (
    <div className={styles.alerts} role="region" aria-label={t('expiryAlerts')}>
      <h2>
        <WarningAlt size={20} aria-hidden="true" />
        {t('expiryAlerts')} · {days} {t('days')}
      </h2>
      {soon.length ? (
        <div className={styles.alertList}>
          {soon.slice(0, 5).map((u) => (
            <Link className={styles.alert} to={dashboardLink('/inventory', { unit: u.id })} key={u.id}>
              <span>
                <strong>{u.id}</strong>
                <span>
                  {u.component} · {inventoryDisplayDate(u.expiresAt)}
                </span>
              </span>
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          ))}
        </div>
      ) : (
        <p>{t('noExpiryAlerts')}</p>
      )}
      {soon.length > 5 && (
        <Link className={styles.seeAll} to={dashboardLink('/inventory', { expires: days })}>
          {t('seeAll')}
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
export function DashboardPage({ api, expiryWarningDays = 7 }: { api: BloodBankApi; expiryWarningDays?: number }) {
  const { t: translate } = useTranslation(moduleName);
  const t = (key: string) =>
    String(translate(`dashboard.${key}`, (spanish.dashboard as Record<string, string>)[key] ?? key));
  const [version, setVersion] = useState(0);
  const days =
    Number.isInteger(expiryWarningDays) && expiryWarningDays >= 1 && expiryWarningDays <= 365 ? expiryWarningDays : 7;
  const group = (
    key: 'selectionGroup' | 'laboratoryGroup' | 'inventoryGroup' | 'supervisorGroup',
    children: ReactNode,
    action?: ReactNode,
  ) => {
    const required = {
      selectionGroup: [p.applicantSelection, p.collection],
      laboratoryGroup: [p.screening, p.compatibility, p.fractionation],
      inventoryGroup: [p.inventory],
      supervisorGroup: [p.transfusions, p.transfers, p.donorFollowUp, p.recipientFollowUp],
    };
    const Icon = {
      selectionGroup: UserFollow,
      laboratoryGroup: Chemistry,
      inventoryGroup: InventoryManagement,
      supervisorGroup: TaskComplete,
    }[key];
    return (
      <RequireAnyPrivilege privileges={required[key]}>
        <section className={styles.group} aria-label={t(key)} data-area={key}>
          <div className={styles.groupHeader}>
            <h2>
              <Icon size={20} aria-hidden="true" />
              {t(key)}
            </h2>
            {action}
          </div>
          <div className={styles.cards}>{children}</div>
        </section>
      </RequireAnyPrivilege>
    );
  };
  return (
    <ProcessingPage title={t('home')} illustration="dashboard" counts={[]}>
      <HomeAccess t={t}>
        <HomeLayout>
          {(mode) => (
            <>
              <div className={styles.intro}>
                <p>{t('intro')}</p>
                <Button kind="tertiary" size="sm" renderIcon={Renew} onClick={() => setVersion((v) => v + 1)}>
                  {t('refresh')}
                </Button>
              </div>
              <HomeInventoryData key={version} api={api} t={t}>
                {(inventory) => (
                  <div className={styles.groups} role="region" aria-label={t('summary')}>
                    <RequireAnyPrivilege privileges={[p.homeSelection, p.homeSupervisor]}>
                      {group(
                        'selectionGroup',
                        mode === 'focused' ? (
                          <SelectionHomeOverview api={api} t={t} />
                        ) : (
                          <>
                            <ProtectedSection privilege={p.applicantSelection} hideUnauthorized>
                              <Source load={api.selection.listApplications} t={t}>
                                {(rows) => (
                                  <Card
                                    label={t('interviews')}
                                    description={t('interviewsHelp')}
                                    count={rows.filter((r) => r.status === 'awaitingInterview').length}
                                    to={dashboardLink('/applicant-selection', { status: 'awaitingInterview' })}
                                    t={t}
                                  />
                                )}
                              </Source>
                            </ProtectedSection>
                            <ProtectedSection privilege={p.collection} hideUnauthorized>
                              <Source load={api.collection.listCollections} t={t}>
                                {(rows) => (
                                  <Card
                                    label={t('collectionQueue')}
                                    description={t('collectionQueueHelp')}
                                    count={rows.filter((r) => r.status !== 'completed').length}
                                    to="/collection"
                                    t={t}
                                  />
                                )}
                              </Source>
                            </ProtectedSection>
                          </>
                        ),
                        <ProtectedSection privilege={p.applicantSelection} hideUnauthorized>
                          <Link
                            className={styles.quickAction}
                            to={dashboardLink('/applicant-selection', { action: 'newApplication' })}
                          >
                            {t('newApplication')} <ArrowRight size={16} aria-hidden="true" />
                          </Link>
                        </ProtectedSection>,
                      )}
                    </RequireAnyPrivilege>
                    <RequireAnyPrivilege privileges={[p.homeLaboratory, p.homeSupervisor]}>
                      {group(
                        'laboratoryGroup',
                        mode === 'focused' ? (
                          <LaboratoryHomeOverview api={api} t={t} />
                        ) : (
                          <>
                            <ProtectedSection privilege={p.screening} hideUnauthorized>
                              <Source load={api.screening.listScreenings} t={t}>
                                {(rows) => (
                                  <>
                                    <Card
                                      label={t('donorSamples')}
                                      description={t('donorSamplesHelp')}
                                      count={
                                        rows.filter(
                                          (r) =>
                                            screeningCategory(r) === 'donors' &&
                                            screeningQueueStatus(r) !== 'validated',
                                        ).length
                                      }
                                      to={dashboardLink('/laboratory/screening', { category: 'donors' })}
                                      t={t}
                                    />
                                    <Card
                                      label={t('followUpSamples')}
                                      description={t('followUpSamplesHelp')}
                                      count={
                                        rows.filter(
                                          (r) =>
                                            screeningCategory(r) === 'followUps' &&
                                            screeningQueueStatus(r) !== 'validated',
                                        ).length
                                      }
                                      to={dashboardLink('/laboratory/screening', { category: 'followUps' })}
                                      t={t}
                                    />
                                  </>
                                )}
                              </Source>
                            </ProtectedSection>
                            <ProtectedSection privilege={p.compatibility} hideUnauthorized>
                              <Source load={api.transfusions.list} t={t}>
                                {({ requests }) => (
                                  <Card
                                    label={t('compatibility')}
                                    description={t('compatibilityHelp')}
                                    count={requests.flatMap((r) => r.rounds).filter((r) => !r.completedAt).length}
                                    to="/laboratory/compatibility"
                                    t={t}
                                  />
                                )}
                              </Source>
                            </ProtectedSection>
                            <ProtectedSection privilege={p.fractionation} hideUnauthorized>
                              <Source load={api.fractionation.list} t={t}>
                                {({ units }) => (
                                  <Card
                                    label={t('fractionation')}
                                    description={t('fractionationHelp')}
                                    count={units.filter(eligibleSource).length}
                                    to={dashboardLink('/laboratory/fractionation', { category: 'eligible' })}
                                    t={t}
                                  />
                                )}
                              </Source>
                            </ProtectedSection>
                          </>
                        ),
                      )}
                    </RequireAnyPrivilege>
                    <RequireAnyPrivilege privileges={[p.homeInventory, p.homeSupervisor]}>
                      {group(
                        'inventoryGroup',
                        <ProtectedSection privilege={p.inventory} hideUnauthorized>
                          <InventoryCards source={inventory} days={days} t={t} />
                        </ProtectedSection>,
                      )}
                    </RequireAnyPrivilege>
                    <ProtectedSection privilege={p.homeSupervisor} hideUnauthorized>
                      {group(
                        'supervisorGroup',
                        <>
                          <ProtectedSection privilege={p.transfusions} hideUnauthorized>
                            <Source load={api.transfusions.list} t={t}>
                              {({ requests }) => (
                                <Card
                                  label={t('transfusions')}
                                  description={t('transfusionsHelp')}
                                  count={requests.filter((r) => r.status !== 'delivered').length}
                                  to="/transfusions"
                                  t={t}
                                />
                              )}
                            </Source>
                          </ProtectedSection>
                          <ProtectedSection privilege={p.transfers} hideUnauthorized>
                            <Source load={api.transfers.list} t={t}>
                              {({ requests }) => (
                                <Card
                                  label={t('transfers')}
                                  description={t('transfersHelp')}
                                  count={
                                    requests.filter(
                                      (r) =>
                                        transferDirection(r) === 'incoming' &&
                                        ['received', 'prepared', 'draft'].includes(r.status),
                                    ).length
                                  }
                                  to="/transfers"
                                  t={t}
                                />
                              )}
                            </Source>
                          </ProtectedSection>
                          <ProtectedSection privilege={p.donorFollowUp} hideUnauthorized>
                            <FollowUpCard api={api} kind="donor" t={t} />
                          </ProtectedSection>
                          <ProtectedSection privilege={p.recipientFollowUp} hideUnauthorized>
                            <FollowUpCard api={api} kind="recipient" t={t} />
                          </ProtectedSection>
                        </>,
                      )}
                    </ProtectedSection>
                    <InventoryAlerts source={inventory} days={days} t={t} />
                  </div>
                )}
              </HomeInventoryData>
            </>
          )}
        </HomeLayout>
      </HomeAccess>
    </ProcessingPage>
  );
}
function FollowUpCard({ api, kind, t }: { api: BloodBankApi; kind: 'donor' | 'recipient'; t: T }) {
  const load = useCallback(() => api.followUp.list(kind), [api, kind]);
  return (
    <Source load={load} t={t}>
      {({ cases }) => (
        <Card
          label={t(kind === 'donor' ? 'donorFollowUp' : 'recipientFollowUp')}
          description={t(kind === 'donor' ? 'donorFollowUpHelp' : 'recipientFollowUpHelp')}
          count={cases.filter((c) => c.status === 'open').length}
          to={`/follow-up/${kind}`}
          t={t}
        />
      )}
    </Source>
  );
}
