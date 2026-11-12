import { Button, Checkbox, Search, Select, SelectItem, Tag } from '@carbon/react';
import { Clean } from '@carbon/react/icons';
import { useEffect, useState, type ReactNode } from 'react';
import { expiresSoon, type DashboardShortcut } from '../dashboard/dashboard-shortcuts';
import { normalizeSearch, ProcessingTable, type ProcessingTranslate } from '../../shared/processing-page.component';
import { canSeal, inventoryDisplayDate, inventoryStatusKey } from './inventory-rules';
import type { InventoryOperation, InventoryUnit } from './inventory.types';
import type { InventorySummary } from '../../types/blood-bank.types';
import styles from './inventory.scss';

export function InventorySelector({
  units,
  selected,
  kind,
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
}: {
  units: InventoryUnit[];
  selected: InventorySummary[];
  kind?: InventoryOperation['kind'];
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
  const filtered = units.filter(
    (unit) =>
      (!exactUnit || unit.id === exactUnit) &&
      (!expiryDays || expiresSoon(unit.expiresAt, expiryDays)) &&
      (!sealOnly || canSeal(unit)) &&
      (kind !== 'qualitySeal' || unit.screeningResult === 'nonReactive') &&
      (!component || unit.component === component) &&
      (!status || unit.status === status) &&
      (!group || unit.bloodGroup === group) &&
      normalizeSearch(`${unit.id} ${unit.originalCode} ${unit.component} ${unit.location}`).includes(
        normalizeSearch(search),
      ),
  );
  const eligible = (unit: InventoryUnit) => (kind === 'qualitySeal' ? canSeal(unit) : unit.canDispose);
  const visibleEligible = filtered.filter(eligible);
  return (
    <>
      <div className={styles.toolbar}>
        <Search
          id={`${prefix}-search`}
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
      <div className={styles.filters}>
        <Select
          id={`${prefix}-component`}
          labelText={t('fractionationComponent')}
          value={component}
          onChange={(event) => setComponent(event.target.value)}
        >
          <SelectItem value="" text={t('fractionationAllComponents')} />
          {[...new Set(units.map((unit) => unit.component))].sort().map((value) => (
            <SelectItem key={value} value={value} text={value} />
          ))}
        </Select>
        <Select
          id={`${prefix}-group`}
          labelText={t('bloodGroup')}
          value={group}
          onChange={(event) => setGroup(event.target.value)}
        >
          <SelectItem value="" text={t('inventoryAllGroups')} />
          {[...new Set(units.map((unit) => unit.bloodGroup))]
            .filter(Boolean)
            .sort()
            .map((value) => (
              <SelectItem key={value} value={value} text={value} />
            ))}
        </Select>
        <Select
          id={`${prefix}-status`}
          labelText={t('status')}
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <SelectItem value="" text={t('allStatuses')} />
          {[...new Set(units.map((unit) => unit.status))].map((value) => (
            <SelectItem key={value} value={value} text={t(inventoryStatusKey[value])} />
          ))}
        </Select>
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
          'fractionationLocation',
          'status',
          'inventoryScreeningResult',
        ]}
        rows={filtered.map((unit) => ({
          id: unit.id,
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
            inventoryDisplayDate(unit.expiresAt),
            unit.location,
            <Tag
              key="status"
              type={
                ['Disponible', 'APTO'].includes(unit.status)
                  ? 'green'
                  : unit.status === 'En laboratorio'
                    ? 'blue'
                    : 'gray'
              }
            >
              {t(inventoryStatusKey[unit.status])}
            </Tag>,
            <Tag
              key="screening"
              type={
                unit.screeningResult === 'nonReactive' ? 'green' : unit.screeningResult === 'reactive' ? 'red' : 'gray'
              }
            >
              {t(`inventoryResult_${unit.screeningResult}`)}
            </Tag>,
          ],
        }))}
        loading={loading}
        failed={failed}
        reload={reload}
        emptyHelp={t(kind === 'qualitySeal' ? 'inventorySealEmpty' : 'inventoryEmpty')}
        filterKey={`${search}:${component}:${group}:${status}:${exactUnit}:${expiryDays}:${sealOnly}`}
        t={t}
      />
    </>
  );
}
