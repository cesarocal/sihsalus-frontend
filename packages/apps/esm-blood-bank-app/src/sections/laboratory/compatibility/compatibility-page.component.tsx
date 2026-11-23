import { Button, InlineNotification, Search } from '@carbon/react';
import { RecentlyViewed } from '@carbon/react/icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { listCompatibilityRequests, type TransfusionsApi } from '../../../api/transfusions.api';
import { formatListDate } from '../../../shared/format-list-date';
import {
  normalizeSearch,
  ProcessingPage,
  ProcessingTable,
  useProcessingData,
} from '../../../shared/processing-page.component';
import shared from '../../applicant-selection/selection.scss';
import type { DashboardShortcut } from '../../dashboard/dashboard-shortcuts';
import { TransfusionHistory } from '../../transfusions/transfusion-history.component';
import styles from '../../transfusions/transfusions.scss';
import type { CompatibilityRound, TransfusionRequest } from '../../transfusions/transfusions.types';
import {
  comparePriority,
  compatibilityNeedsCommunication,
  compatibilityPending,
  priorityKeys,
  urgentSerumSampleCode,
} from '../../transfusions/transfusions-rules';
import { useTransfusionsTranslation } from '../../transfusions/use-transfusions-translation';
import { CompatibilityWorkflow } from './compatibility-workflow.component';

export function CompatibilityPage({ api, shortcut }: { api: TransfusionsApi; shortcut?: DashboardShortcut }) {
  const t = useTransfusionsTranslation();
  const load = useCallback(() => listCompatibilityRequests(api), [api]);
  const { data, loading, failed, reload } = useProcessingData(load);
  const [search, setSearch] = useState('');
  const [history, setHistory] = useState(false);
  const [active, setActive] = useState<{ request: TransfusionRequest; round: CompatibilityRound } | null>(null);
  const handledRound = useRef('');
  const [shortcutUnavailable, setShortcutUnavailable] = useState(false);
  useEffect(() => {
    const id = shortcut?.round;
    if (!id) {
      handledRound.current = '';
      setShortcutUnavailable(false);
      return;
    }
    if (loading || failed || !data || active || history || handledRound.current === id) return;
    handledRound.current = id;
    const item = data
      .flatMap((request) => request.rounds.map((round) => ({ request, round })))
      .find(
        ({ request, round }) =>
          round.id === id &&
          !round.readOnly &&
          (compatibilityPending(request, round) || compatibilityNeedsCommunication(request, round)),
      );
    setShortcutUnavailable(!item);
    if (item) setActive(item);
  }, [shortcut?.round, data, loading, failed, active, history]);
  const all = (data ?? []).flatMap((request) => request.rounds.map((round) => ({ request, round })));
  const queue = all
    .filter(
      (item) =>
        !item.round.readOnly &&
        (compatibilityPending(item.request, item.round) || compatibilityNeedsCommunication(item.request, item.round)) &&
        normalizeSearch(
          `${item.request.order.number} ${item.request.order.patientName} ${item.round.sample.code}`,
        ).includes(normalizeSearch(search)),
    )
    .sort((a, b) =>
      comparePriority(
        { priority: a.request.order.priority, date: a.round.createdAt },
        { priority: b.request.order.priority, date: b.round.createdAt },
      ),
    );
  return (
    <ProcessingPage
      title={t('txCompatibilityTitle')}
      illustration="compatibility"
      counts={[
        {
          label: t('txPendingTests'),
          description: t('txGroups'),
          value:
            loading || failed ? '—' : all.filter(({ request, round }) => compatibilityPending(request, round)).length,
        },
        {
          label: t('txCompletedTests'),
          description: t('txGroups'),
          value: loading || failed ? '—' : all.filter((item) => !!item.round.completedAt).length,
        },
      ]}
    >
      <div className={`${shared.surface} ${styles.responsive}`}>
        {shortcutUnavailable && (
          <InlineNotification kind="warning" hideCloseButton title={t('txHomeRoundUnavailable')} />
        )}
        <div className={styles.toolbar}>
          <Search
            id="tx-lab-search"
            labelText={t('txSearchLab')}
            placeholder={t('txSearchLab')}
            closeButtonLabelText={t('clearSearch')}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Button
            kind="tertiary"
            renderIcon={RecentlyViewed}
            disabled={loading || failed}
            onClick={() => setHistory(true)}
          >
            {t('txCompatibilityHistory')}
          </Button>
        </div>
        <ProcessingTable
          title={t('txPendingTests')}
          columns={[
            'txNumber',
            'txPriority',
            'txPatient',
            'txRecipientSample',
            'txRoundDate',
            'txSampleCount',
            'status',
            'actions',
          ]}
          rows={queue.map(({ request, round }) => ({
            id: round.id,
            cells: [
              request.order.number,
              t(priorityKeys[request.order.priority]),
              request.order.patientName,
              !api.compatibility && request.order.priority === 'veryUrgent'
                ? `${round.sample.code} · ${urgentSerumSampleCode(round.sample)}`
                : round.sample.code,
              formatListDate(round.createdAt),
              Object.keys(round.results).length,
              t(
                round.completedAt
                  ? 'txCommunicationPending'
                  : request.order.priority === 'veryUrgent'
                    ? 'txPostDispatchPending'
                    : 'txResultPending',
              ),
              <Button key="process" kind="ghost" size="sm" onClick={() => setActive({ request, round })}>
                {t(round.completedAt ? 'txRegisterCommunication' : 'txProcessTests')}
              </Button>,
            ],
          }))}
          loading={loading}
          failed={failed}
          reload={reload}
          emptyHelp={t('txNoPendingTests')}
          filterKey={search}
          t={t}
        />
      </div>
      {active && (
        <CompatibilityWorkflow
          initial={active.request}
          initialRound={active.round}
          api={api}
          onSaved={reload}
          onClose={() => {
            setActive(null);
            reload();
          }}
          t={t}
        />
      )}
      {history && (
        <TransfusionHistory requests={data ?? []} compatibility onClose={() => setHistory(false)} t={t} />
      )}
    </ProcessingPage>
  );
}
