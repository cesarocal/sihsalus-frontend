import { Button, Checkbox, InlineNotification, Search, Select, SelectItem, Tag } from '@carbon/react';
import { Fork, RecentlyViewed } from '@carbon/react/icons';
import { useCallback, useState } from 'react';
import type { FractionationApi } from '../../../api/fractionation.api';
import { notifySuccess } from '../../../shared/notify-success';
import {
  normalizeSearch,
  ProcessingPage,
  ProcessingTable,
  useProcessingData,
  useProcessingTranslation,
} from '../../../shared/processing-page.component';
import { componentDefinitions, eligibleSource } from './fractionation-rules';
import type { FractionationBatch } from './fractionation.types';
import { FractionationWorkflow } from './fractionation-workflow.component';
import { FractionationHistory } from './fractionation-history.component';
import shared from '../../applicant-selection/selection.scss';
import styles from './fractionation.scss';

export function FractionationPage({ api }: { api: FractionationApi }) {
  const t = useProcessingTranslation();
  const load = useCallback(() => api.list(), [api]);
  const { data, loading, failed, reload } = useProcessingData(load);
  const [search, setSearch] = useState('');
  const [component, setComponent] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [active, setActive] = useState<FractionationBatch | null>(null);
  const [history, setHistory] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startFailed, setStartFailed] = useState(false);
  const queue = (data?.units ?? []).filter(
    (unit) => ['wholeBlood', 'freshFrozenPlasma'].includes(unit.component) && unit.state !== 'fractionated',
  );
  const filtered = queue.filter(
    (unit) =>
      (!component || unit.component === component) &&
      (!status || unit.state === status) &&
      normalizeSearch(
        `${unit.code} ${unit.originalWholeBloodCode} ${t(componentDefinitions[unit.component].key)}`,
      ).includes(normalizeSearch(search)),
  );
  const selection = queue.filter((unit) => selected.includes(unit.id) && eligibleSource(unit));
  const valid =
    selection.length > 0 &&
    selection.length === selected.length &&
    new Set(selection.map((unit) => unit.component)).size === 1;
  const resetSelection = () => {
    setSelected([]);
    setStartFailed(false);
  };
  const startFractionation = async (sourceIds: string[]) => {
    if (loading || failed || starting || !sourceIds.length) return;
    setStarting(true);
    setStartFailed(false);
    try {
      const batch = await api.start(sourceIds);
      setActive(batch);
      resetSelection();
      reload();
      notifySuccess(t('fractionationStarted'));
    } catch {
      setStartFailed(true);
      reload();
    } finally {
      setStarting(false);
    }
  };
  return (
    <ProcessingPage
      title={t('fractionationTitle')}
      illustration="fractionation"
      counts={[
        {
          label: t('fractionationAvailable'),
          description: t('fractionationUnits'),
          value: queue.filter(eligibleSource).length,
        },
        {
          label: t('fractionationInLab'),
          description: t('fractionationUnits'),
          value: queue.filter((unit) => unit.state === 'inLaboratory').length,
        },
        {
          label: t('fractionationFinished'),
          description: t('fractionationProcesses'),
          value: data?.batches.filter((batch) => batch.status === 'completed').length ?? 0,
        },
      ]}
    >
      <section className={shared.list}>
        <div className={styles.toolbar}>
          <Search
            id="fractionation-search"
            labelText={t('search')}
            placeholder={t('fractionationSearch')}
            value={search}
            closeButtonLabelText={t('clearSearch')}
            onChange={(event) => {
              setSearch(event.target.value);
              resetSelection();
            }}
          />
        </div>
        <div className={styles.filters}>
          <Select
            id="fractionation-component"
            labelText={t('fractionationComponent')}
            value={component}
            onChange={(event) => {
              setComponent(event.target.value);
              resetSelection();
            }}
          >
            <SelectItem value="" text={t('fractionationAllComponents')} />
            {(['wholeBlood', 'freshFrozenPlasma'] as const).map((value) => (
              <SelectItem key={value} value={value} text={t(componentDefinitions[value].key)} />
            ))}
          </Select>
          <Select
            id="fractionation-status"
            labelText={t('status')}
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              resetSelection();
            }}
          >
            <SelectItem value="" text={t('allStatuses')} />
            <SelectItem value="quarantine" text={t('quarantine')} />
            <SelectItem value="available" text={t('fractionationAvailable')} />
            <SelectItem value="inLaboratory" text={t('fractionationInLab')} />
          </Select>
          {!!selected.length && (
            <Button kind="ghost" size="sm" onClick={resetSelection}>
              {t('fractionationDeselect')}
            </Button>
          )}
          <Button kind="tertiary" renderIcon={RecentlyViewed} disabled={starting} onClick={() => setHistory(true)}>
            {t('fractionationHistory')}
          </Button>
          <Button
            renderIcon={Fork}
            disabled={loading || failed || starting || !valid}
            onClick={() => {
              if (valid) void startFractionation(selected);
            }}
          >
            {starting ? t('saving') : t('fractionate')}
          </Button>
        </div>
        <p className={styles.help}>{t('fractionationBatchHelp')}</p>
        {startFailed && <InlineNotification hideCloseButton kind="error" title={t('fractionationStartFailed')} />}
        <ProcessingTable
          title={t('fractionationQueue')}
          columns={[
            'fractionationSelect',
            'fractionationCode',
            'fractionationComponent',
            'bloodGroup',
            'fractionationVolume',
            'fractionationCollected',
            'fractionationLocation',
            'status',
            'actions',
          ]}
          rows={filtered.map((unit) => ({
            id: unit.id,
            cells: [
              <Checkbox
                key="select"
                id={`fractionation-select-${unit.id}`}
                hideLabel
                labelText={`${t('fractionationSelect')} ${unit.code}`}
                checked={selected.includes(unit.id)}
                disabled={
                  starting ||
                  !eligibleSource(unit) ||
                  (selection.length > 0 && selection[0].component !== unit.component)
                }
                onChange={(_event, { checked }) =>
                  setSelected((previous) =>
                    checked ? [...previous, unit.id] : previous.filter((id) => id !== unit.id),
                  )
                }
              />,
              unit.code,
              t(componentDefinitions[unit.component].key),
              unit.label.bloodGroup || '—',
              unit.volume,
              unit.collectedAt,
              unit.location,
              <Tag key="state" type={unit.state === 'inLaboratory' ? 'blue' : 'gray'}>
                {t(
                  unit.state === 'inLaboratory'
                    ? 'fractionationInLab'
                    : unit.state === 'available'
                      ? 'fractionationAvailable'
                      : 'quarantine',
                )}
              </Tag>,
              eligibleSource(unit) ? (
                <Button
                  key="fractionate"
                  kind="ghost"
                  size="sm"
                  renderIcon={Fork}
                  aria-label={`${t('fractionate')} — ${unit.code}`}
                  disabled={loading || failed || starting}
                  onClick={() => void startFractionation([unit.id])}
                >
                  {t('fractionate')}
                </Button>
              ) : (
                unit.state === 'inLaboratory' && (
                  <Button
                    key="resume"
                    kind="ghost"
                    size="sm"
                    onClick={() => {
                      const batch = data?.batches.find(
                        (item) => item.id === unit.batchId && item.status === 'inProgress',
                      );
                      if (batch) setActive(batch);
                      else {
                        setStartFailed(true);
                        reload();
                      }
                    }}
                  >
                    {t('fractionationResume')}
                  </Button>
                )
              ),
            ],
          }))}
          loading={loading}
          failed={failed}
          reload={reload}
          emptyHelp={t('fractionationEmpty')}
          filterKey={`${search}:${component}:${status}`}
          t={t}
        />
      </section>
      {active && (
        <FractionationWorkflow
          initial={active}
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
        <FractionationHistory
          batches={data?.batches ?? []}
          loading={loading}
          failed={failed}
          reload={reload}
          onClose={() => setHistory(false)}
          t={t}
        />
      )}
    </ProcessingPage>
  );
}
