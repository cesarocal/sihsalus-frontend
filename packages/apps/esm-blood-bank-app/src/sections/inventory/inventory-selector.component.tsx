import { Button, Checkbox, Search, Select, SelectItem, Tag } from '@carbon/react';
import { Clean, WarningAlt } from '@carbon/react/icons';
import { type ReactNode, useEffect, useState } from 'react';
import spanish from '../../../translations/es.json';
import { formatListDate } from '../../shared/format-list-date';
import { normalizeSearch, ProcessingTable, type ProcessingTranslate } from '../../shared/processing-page.component';
import type { InventorySummary } from '../../types/blood-bank.types';
import { type DashboardShortcut, expiresSoon } from '../dashboard/dashboard-shortcuts';
import { componentDefinitions } from '../laboratory/fractionation/fractionation-rules';
import { screeningBloodGroups, screeningRhFactors } from '../laboratory/screening/screening.types';
import { defaultExpiryWarningDays } from '../settings/blood-bank-settings';
import styles from './inventory.scss';
import type { InventoryOperation, InventoryUnit } from './inventory.types';
import { canSeal, disposalEligibleStatuses, inventoryDisplayDate, inventoryStatusKey } from './inventory-rules';

const bloodGroups = screeningBloodGroups.flatMap((abo) => screeningRhFactors.map((rh) => `${abo}${rh}`));
const componentName = (value: string) => normalizeSearch(value.replace(/\s*\(DEMO\)$/i, '').trim());

export function InventorySelector({
  units,
  selected,
  kind,
  operationId,
  onChange,
  busy,
  loading = false,
  failed = false,
  reload = () => {},
  actions,
  showSelectFiltered = true,
  prefix,
  t,
  shortcut,
  expiryWarningDays = defaultExpiryWarningDays,
}: {
  units: InventoryUnit[];
  selected: InventorySummary[];
  kind?: InventoryOperation['kind'];
  operationId?: string;
  onChange: (units: InventorySummary[]) => void;
  busy: boolean;
  loading?: boolean;
  failed?: boolean;
  reload?: () => void;
  actions?: ReactNode;
  showSelectFiltered?: boolean;
  prefix: string;
  t: ProcessingTranslate;
  shortcut?: DashboardShortcut;
  expiryWarningDays?: number;
}) {
  const [search, setSearch] = useState(shortcut?.unit || shortcut?.q || '');
  const [exactUnit, setExactUnit] = useState(shortcut?.unit ?? '');
  const [expiryDays, setExpiryDays] = useState(shortcut?.expires ?? 0);
  const [sealOnly, setSealOnly] = useState(shortcut?.category === 'seal');
  const [component, setComponent] = useState('');
  const [status, setStatus] = useState(shortcut?.status ?? '');
  const [group, setGroup] = useState('');
  useEffect(() => {
    setSearch(shortcut?.unit || shortcut?.q || '');
    setExactUnit(shortcut?.unit ?? '');
    setStatus(shortcut?.status ?? '');
    setExpiryDays(shortcut?.expires ?? 0);
    setSealOnly(shortcut?.category === 'seal');
    setComponent('');
    setGroup('');
  }, [shortcut?.unit, shortcut?.q, shortcut?.status, shortcut?.expires, shortcut?.category]);
  const unavailable = busy || loading || failed;
  const hasFilters = !!(search || exactUnit || expiryDays || sealOnly || component || status || group);
  const clearFilters = () => {
    setExactUnit('');
    setExpiryDays(0);
    setSealOnly(false);
    setSearch('');
    setStatus('');
    setComponent('');
    setGroup('');
  };
  const sealWorkflow = kind === 'qualitySeal';
  const components = Object.entries(componentDefinitions).map(([id, { key }]) => ({
    id,
    label: t(key),
    originalLabel: (spanish.processing as Record<string, string>)[key],
  }));
  const catalogByLabel = new Map(
    components.flatMap(({ id, label, originalLabel }) => [
      [componentName(label), id] as const,
      [componentName(originalLabel), id] as const,
    ]),
  );
  const componentOptions = new Map(components.map(({ id, label }) => [id, label]));
  const unitComponent = (unit: InventoryUnit) => catalogByLabel.get(componentName(unit.component)) ?? unit.component;
  for (const unit of units) {
    if (unit.component && !componentOptions.has(unitComponent(unit)))
      componentOptions.set(unit.component, unit.component);
  }
  const statusOptions =
    kind === 'disposal'
      ? [...disposalEligibleStatuses, ...(operationId && selected.length ? ['En proceso de eliminación' as const] : [])]
      : (Object.keys(inventoryStatusKey) as InventorySummary['status'][]);
  const eligible = (unit: InventoryUnit) =>
    sealWorkflow
      ? canSeal(unit)
      : unit.canDispose || (kind === 'disposal' && !!operationId && unit.disposalOperationId === operationId);
  const candidates = units.filter((unit) =>
    sealWorkflow ? unit.status === 'Sello pendiente' : kind !== 'disposal' || eligible(unit),
  );
  const filtered = candidates.filter(
    (unit) =>
      (!exactUnit || unit.id === exactUnit) &&
      (!expiryDays || expiresSoon(unit.expiresAt, expiryDays)) &&
      (!sealOnly || unit.status === 'Sello pendiente') &&
      (!component || unitComponent(unit) === component) &&
      (!status || unit.status === status) &&
      (!group || unit.bloodGroup.replace('−', '-').trim() === group) &&
      normalizeSearch(`${unit.id} ${unit.originalCode} ${unit.component}`).includes(normalizeSearch(search)),
  );
  const visibleEligible = filtered.filter(eligible);
  const now = Date.now();
  return (
    <>
      <div className={actions ? `${styles.toolbar} ${styles.inventoryToolbar}` : styles.toolbar}>
        <Search
          id={`${prefix}-search`}
          size={actions ? 'lg' : undefined}
          labelText={t('search')}
          placeholder={t('inventorySearch')}
          value={search}
          closeButtonLabelText={t('clearSearch')}
          onChange={(event) => {
            setSearch(event.target.value);
            setExactUnit('');
          }}
        />
        {actions}
        {!!selected.length && (
          <Button size="sm" kind="ghost" disabled={unavailable} onClick={() => onChange([])}>
            {t('inventoryDeselect')}
          </Button>
        )}
        {showSelectFiltered && !!visibleEligible.length && (
          <Button
            size="sm"
            kind="ghost"
            disabled={unavailable}
            onClick={() =>
              onChange([
                ...selected,
                ...visibleEligible.filter((unit) => !selected.some((item) => item.id === unit.id)),
              ])
            }
          >
            {t('inventorySelectFiltered')}
          </Button>
        )}
      </div>
      {exactUnit && !loading && !failed && !units.some((u) => u.id === exactUnit) && (
        <p className={styles.help} role="status">
          {t('homeUnitUnavailable')}
        </p>
      )}
      <div className={`${styles.filters} ${sealWorkflow ? styles.sealFilters : ''}`}>
        <Select
          id={`${prefix}-component`}
          labelText={t('fractionationComponent')}
          value={component}
          onChange={(event) => setComponent(event.target.value)}
        >
          <SelectItem value="" text={t('fractionationAllComponents')} />
          {[...componentOptions]
            .sort(([, a], [, b]) => a.localeCompare(b))
            .map(([value, label]) => (
              <SelectItem key={value} value={value} text={label} />
            ))}
        </Select>
        <Select
          id={`${prefix}-group`}
          labelText={t('bloodGroup')}
          value={group}
          onChange={(event) => setGroup(event.target.value)}
        >
          <SelectItem value="" text={t('inventoryAllGroups')} />
          {bloodGroups.map((value) => (
            <SelectItem key={value} value={value} text={value} />
          ))}
        </Select>
        {!sealWorkflow && (
          <Select
            id={`${prefix}-status`}
            labelText={t('status')}
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <SelectItem value="" text={t('allStatuses')} />
            {statusOptions.map((value) => (
              <SelectItem key={value} value={value} text={t(inventoryStatusKey[value])} />
            ))}
          </Select>
        )}
        <Button
          kind="tertiary"
          size="md"
          hasIconOnly
          renderIcon={Clean}
          iconDescription={t('inventoryClearFilters')}
          tooltipAlignment="end"
          disabled={unavailable || !hasFilters}
          onClick={clearFilters}
        />
      </div>
      <p className={styles.help}>
        {t('inventorySelected')}: {selected.length}
      </p>
      <ProcessingTable
        title={t('inventoryUnits')}
        columns={[
          'fractionationSelect',
          'fractionationCode',
          'fractionationComponent',
          'bloodGroup',
          ...(!kind ? ['fractionationVolume'] : []),
          'inventoryExpiration',
          'status',
          'inventoryScreeningResult',
        ]}
        rows={filtered.map((unit) => {
          const expiring =
            !kind &&
            expiresSoon(unit.expiresAt, expiryWarningDays) &&
            (!unit.expiresAt.includes('T') || new Date(unit.expiresAt).getTime() > now);
          return {
            id: unit.id,
            className: expiring ? styles.expiringRow : undefined,
            cells: [
              <Checkbox
                key="select"
                id={`${prefix}-select-${unit.id}`}
                hideLabel
                labelText={`${t('fractionationSelect')} ${unit.id}`}
                checked={selected.some((item) => item.id === unit.id)}
                disabled={unavailable || (!eligible(unit) && !selected.some((item) => item.id === unit.id))}
                onChange={(_event, { checked }) =>
                  onChange(
                    checked
                      ? [...selected.filter((item) => item.id !== unit.id), unit]
                      : selected.filter((item) => item.id !== unit.id),
                  )
                }
              />,
              unit.id,
              unit.component,
              unit.bloodGroup || '—',
              ...(!kind ? [unit.volume || '—'] : []),
              <div key="expiration">
                {kind ? inventoryDisplayDate(unit.expiresAt) : formatListDate(unit.expiresAt)}
                {expiring && (
                  <span className={styles.expiryWarning}>
                    <WarningAlt size={16} aria-hidden="true" />
                    {t('inventoryExpiringSoon')}
                  </span>
                )}
              </div>,
              <Tag
                key="status"
                type={
                  unit.status === 'APTO'
                    ? 'green'
                    : unit.status === 'En fraccionamiento'
                      ? 'blue'
                      : unit.status === 'Sello pendiente'
                        ? 'warm-gray'
                        : unit.status === 'No apta'
                          ? 'red'
                          : 'gray'
                }
              >
                {t(inventoryStatusKey[unit.status])}
              </Tag>,
              <Tag
                key="screening"
                type={
                  unit.screeningResult === 'nonReactive'
                    ? 'green'
                    : unit.screeningResult === 'reactive'
                      ? 'red'
                      : unit.screeningResult === 'inProgress'
                        ? 'blue'
                        : 'gray'
                }
              >
                {t(`inventoryResult_${unit.screeningResult}`)}
              </Tag>,
            ],
          };
        })}
        loading={loading}
        failed={failed}
        reload={reload}
        emptyHelp={t(
          kind === 'qualitySeal'
            ? 'inventorySealEmpty'
            : kind === 'disposal'
              ? 'inventoryDisposalEmpty'
              : 'inventoryEmpty',
        )}
        filterKey={`${search}:${component}:${group}:${status}:${exactUnit}:${expiryDays}:${sealOnly}`}
        t={t}
      />
    </>
  );
}
