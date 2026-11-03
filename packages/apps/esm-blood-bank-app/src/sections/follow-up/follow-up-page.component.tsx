import {
  Button,
  ComposedModal,
  ModalBody,
  ModalHeader,
  Search,
  Select,
  SelectItem,
  Tag,
  TextInput,
} from '@carbon/react';
import { Add, RecentlyViewed } from '@carbon/react/icons';
import { useCallback, useState } from 'react';
import type { FollowUpApi } from '../../api/follow-up.api';
import {
  normalizeSearch,
  ProcessingPage,
  ProcessingTable,
  useProcessingData,
} from '../../shared/processing-page.component';
import shared from '../applicant-selection/selection.scss';
import { newFollowUp } from './follow-up-rules';
import { followUpStages, type FollowUpCase, type FollowUpKind } from './follow-up.types';
import { FollowUpWorkflow } from './follow-up-workflow.component';
import { useFollowUpTranslation } from './use-follow-up-translation';
import styles from './follow-up.scss';

export function FollowUpPage({ kind, api }: { kind: FollowUpKind; api: FollowUpApi }) {
  const t = useFollowUpTranslation();
  const load = useCallback(() => api.list(kind), [api, kind]);
  const { data, loading, failed, reload } = useProcessingData(load);
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState('');
  const [history, setHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [active, setActive] = useState<FollowUpCase | null>(null);
  const [returnToHistory, setReturnToHistory] = useState(false);
  const cases = data?.cases ?? [];
  const matching = (c: FollowUpCase, query: string) =>
    normalizeSearch(
      `${c.id} ${c.detection.person.name} ${c.detection.person.document} ${c.detection.person.history} ${c.detection.test}`,
    ).includes(normalizeSearch(query.trim()));
  const open = cases.filter((c) => c.status === 'open');
  const queue = open
    .filter((c) => matching(c, search) && (!stage || String(c.stage) === stage))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const invalidRange = !!from && !!to && from > to;
  const historic = cases
    .filter(
      (c) =>
        matching(c, historySearch) &&
        (!status || c.status === status) &&
        (!from || c.createdAt.slice(0, 10) >= from) &&
        (!to || c.createdAt.slice(0, 10) <= to),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const title = t(kind === 'donor' ? 'donorTitle' : 'recipientTitle');
  const table = (records: FollowUpCase[], historicTable = false) => (
    <ProcessingTable
      title={t(historicTable ? 'history' : 'openCases')}
      columns={['caseCode', 'createdOn', 'originName', 'test', 'affectedPeople', 'currentStage', 'status', 'actions']}
      rows={records.map((c) => ({
        id: c.id,
        cells: [
          c.id,
          c.createdAt.slice(0, 10).split('-').reverse().join('/'),
          c.detection.person.name || t('draftCase'),
          c.detection.test || '—',
          c.subjects.length,
          t(followUpStages[c.stage]),
          <Tag key="status" type={c.status === 'closed' ? 'gray' : 'blue'}>
            {t(c.status)}
          </Tag>,
          <Button
            key="action"
            kind="ghost"
            size="sm"
            onClick={() => {
              setReturnToHistory(historicTable);
              setHistory(false);
              setActive(c);
            }}
          >
            {t('viewCase')}
          </Button>,
        ],
      }))}
      loading={loading}
      failed={failed}
      reload={reload}
      emptyHelp={t('emptyHelp')}
      filterKey={`${historicTable ? historySearch : search}:${stage}:${status}:${from}:${to}`}
      t={t}
    />
  );
  return (
    <ProcessingPage
      title={title}
      illustration={kind === 'donor' ? 'donorFollowUp' : 'recipientFollowUp'}
      counts={[
        {
          label: t('openCases'),
          description: t('casesUnit'),
          value: open.length,
        },
        {
          label: t('testing'),
          description: t('casesUnit'),
          value: open.filter((c) => c.stage === 3).length,
        },
        {
          label: t('closedCases'),
          description: t('reportsUnit'),
          value: cases.filter((c) => c.status === 'closed').length,
        },
      ]}
    >
      <section className={shared.surface} aria-label={t('openCases')}>
        <div className={styles.toolbar}>
          <Search
            id={`follow-up-${kind}-search`}
            labelText={t('searchCases')}
            placeholder={t('searchCases')}
            value={search}
            closeButtonLabelText={t('clearSearch')}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            id={`follow-up-${kind}-stage`}
            labelText={t('currentStage')}
            value={stage}
            onChange={(e) => setStage(e.target.value)}
          >
            <SelectItem value="" text={t('allStages')} />
            {followUpStages.map((key, i) => (
              <SelectItem key={key} value={String(i)} text={t(key)} />
            ))}
          </Select>
          <Button
            kind="tertiary"
            renderIcon={RecentlyViewed}
            disabled={loading || failed}
            onClick={() => setHistory(true)}
          >
            {t('history')}
          </Button>
          <Button
            renderIcon={Add}
            disabled={loading || failed}
            onClick={() => {
              setReturnToHistory(false);
              setActive(newFollowUp(kind));
            }}
          >
            {t('newCase')}
          </Button>
        </div>
        {table(queue)}
      </section>
      {history && (
        <ComposedModal
          open
          size="lg"
          className={styles.modal}
          preventCloseOnClickOutside
          onClose={() => setHistory(false)}
          aria-label={t('history')}
        >
          <ModalHeader title={t('history')} iconDescription={t('close')} closeModal={() => setHistory(false)} />
          <ModalBody>
            <div className={styles.toolbar}>
              <Search
                id="follow-up-history-search"
                labelText={t('searchCases')}
                placeholder={t('searchCases')}
                value={historySearch}
                closeButtonLabelText={t('clearSearch')}
                onChange={(e) => setHistorySearch(e.target.value)}
              />
              <Select
                id="follow-up-history-status"
                labelText={t('status')}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {['', 'open', 'closed'].map((key) => (
                  <SelectItem key={key} value={key} text={t(key || 'allStatuses')} />
                ))}
              </Select>
            </div>
            <div className={styles.fields}>
              <TextInput
                id="follow-up-from"
                type="date"
                labelText={t('from')}
                value={from}
                invalid={invalidRange}
                invalidText={t('invalidRange')}
                onChange={(e) => setFrom(e.target.value)}
              />
              <TextInput
                id="follow-up-to"
                type="date"
                labelText={t('to')}
                value={to}
                invalid={invalidRange}
                invalidText={t('invalidRange')}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            {!invalidRange && table(historic, true)}
          </ModalBody>
        </ComposedModal>
      )}
      {active && data && (
        <FollowUpWorkflow
          key={active.id || 'new'}
          initial={active}
          workspace={data}
          api={api}
          t={t}
          onSaved={reload}
          onClose={() => {
            setActive(null);
            if (returnToHistory) setHistory(true);
          }}
        />
      )}
    </ProcessingPage>
  );
}
