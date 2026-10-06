import { Button, Checkbox, Search, Select, SelectItem, Tag } from '@carbon/react';
import { useState, type ReactNode } from 'react';
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
}) {
  const [search, setSearch] = useState('');
  const [component, setComponent] = useState('');
  const [status, setStatus] = useState('');
  const [group, setGroup] = useState('');
  const unavailable = busy || loading || failed;
  const filtered = units.filter(
    (unit) =>
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
          onChange={(event) => setSearch(event.target.value)}
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
        filterKey={`${search}:${component}:${group}:${status}`}
        t={t}
      />
    </>
  );
}
