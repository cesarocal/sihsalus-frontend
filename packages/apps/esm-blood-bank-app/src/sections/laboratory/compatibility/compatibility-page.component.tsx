import { Button, Search } from '@carbon/react';
import { RecentlyViewed } from '@carbon/react/icons';
import { formatDatetime } from '@openmrs/esm-framework';
import { useCallback, useState } from 'react';
import type { TransfusionsApi } from '../../../api/transfusions.api';
import {
  normalizeSearch,
  ProcessingPage,
  ProcessingTable,
  useProcessingData,
} from '../../../shared/processing-page.component';
import shared from '../../applicant-selection/selection.scss';
import { TransfusionHistory } from '../../transfusions/transfusion-history.component';
import styles from '../../transfusions/transfusions.scss';
import type { CompatibilityRound, TransfusionRequest } from '../../transfusions/transfusions.types';
import { comparePriority, priorityKeys } from '../../transfusions/transfusions-rules';
import { useTransfusionsTranslation } from '../../transfusions/use-transfusions-translation';
import { CompatibilityWorkflow } from './compatibility-workflow.component';

export function CompatibilityPage({ api }: { api: TransfusionsApi }) {
  const t = useTransfusionsTranslation();
  const load = useCallback(() => api.list(), [api]);
  const { data, loading, failed, reload } = useProcessingData(load);
  const [search, setSearch] = useState('');
  const [history, setHistory] = useState(false);
  const [active, setActive] = useState<{ request: TransfusionRequest; round: CompatibilityRound } | null>(null);
  const all = (data?.requests ?? []).flatMap((request) => request.rounds.map((round) => ({ request, round })));
  const queue = all
    .filter(
      (item) =>
        !item.round.completedAt &&
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
          value: loading || failed ? '—' : all.filter((item) => !item.round.completedAt).length,
        },
        {
          label: t('txCompletedTests'),
          description: t('txGroups'),
          value: loading || failed ? '—' : all.filter((item) => !!item.round.completedAt).length,
        },
      ]}
    >
      <div className={`${shared.surface} ${styles.responsive}`}>
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
            'actions',
          ]}
          rows={queue.map(({ request, round }) => ({
            id: round.id,
            cells: [
              request.order.number,
              t(priorityKeys[request.order.priority]),
              request.order.patientName,
              round.sample.code,
              formatDatetime(new Date(round.createdAt), { noToday: true }),
              Object.keys(round.results).length,
              <Button key="process" kind="ghost" size="sm" onClick={() => setActive({ request, round })}>
                {t('txProcessTests')}
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
        <TransfusionHistory
          requests={data?.requests ?? []}
          entries={[]}
          compatibility
          onClose={() => setHistory(false)}
          t={t}
        />
      )}
    </ProcessingPage>
  );
}
