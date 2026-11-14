import {
  Button,
  Search,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
} from '@carbon/react';
import { ArrowLeft, ArrowRight, Clean } from '@carbon/react/icons';
import { useState } from 'react';
import { formatListDate } from '../../shared/format-list-date';
import { normalizeSearch, type ProcessingTranslate } from '../../shared/processing-page.component';
import { componentDefinitions } from '../laboratory/fractionation/fractionation-rules';
import type { ComponentType } from '../laboratory/fractionation/fractionation.types';
import type { TransferUnit } from '../transfers/transfers.types';
import { transfusionBloodGroupLabel } from './transfusion-blood-group';
import { TransfusionComponentCards } from './transfusion-component-cards.component';
import styles from './transfusions.scss';
import type { TransfusionRequest } from './transfusions.types';
import { lockedAssignments, transfusionCandidate } from './transfusions-rules';

export function TransfusionUnitPicker({
  request,
  units,
  busy,
  onChange,
  t,
}: {
  request: TransfusionRequest;
  units: TransferUnit[];
  busy: boolean;
  onChange: (ids: string[]) => void;
  t: ProcessingTranslate;
}) {
  const [search, setSearch] = useState('');
  const [component, setComponent] = useState<ComponentType>();
  const selected = request.draft.selectedUnitIds;
  const locked = lockedAssignments(request).map((item) => item.unit);
  const assigned = [...locked, ...units.filter((unit) => selected.includes(unit.id))];
  const normalizedSearch = normalizeSearch(search.trim());
  const recipientGroup = request.order.bloodGroup.replace('−', '-');
  const groupPreference = (unit: TransferUnit) => {
    const group = unit.bloodGroup.replace('−', '-');
    return group === recipientGroup ? 0 : group.slice(0, -1) === recipientGroup.slice(0, -1) ? 1 : 2;
  };
  const available = units
    .filter(
      (unit) =>
        transfusionCandidate(unit, request) &&
        !selected.includes(unit.id) &&
        (!component || unit.componentType === component) &&
        normalizeSearch(
          `${unit.id} ${unit.component} ${unit.bloodGroup} ${transfusionBloodGroupLabel(unit.bloodGroup, t)}`,
        ).includes(normalizedSearch),
    )
    .sort((a, b) => groupPreference(a) - groupPreference(b));
  const table = (side: 'left' | 'right') => {
    const incoming = side === 'left';
    const list = incoming ? available : assigned;
    const title = t(incoming ? 'txCandidates' : 'txAssigned');
    const unitColumns = ['inventoryUnitNumber', 'fractionationComponent', 'bloodGroupShort', 'inventoryExpiration'];
    const columns = incoming ? [...unitColumns, 'txAction'] : ['txAction', ...unitColumns];
    return (
      <TableContainer className={styles.unitTableScroll} role="region" aria-label={title} tabIndex={0}>
        <Table useZebraStyles size="sm" aria-label={title}>
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableHeader key={column} className={column === 'txAction' ? styles.actionColumn : undefined}>
                  {t(column)}
                </TableHeader>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {list.map((unit) => {
              const isLocked = locked.some((item) => item.id === unit.id);
              const requirement = request.order.items.find((item) => item.component === unit.componentType);
              const quantityMet =
                !!requirement &&
                assigned.filter((item) => item.componentType === unit.componentType).length >= requirement.quantity;
              const action = t(incoming ? 'txAddUnit' : 'txReturnUnit', { unit: unit.id });
              const actionCell = (
                <TableCell>
                  <Button
                    kind="ghost"
                    size="sm"
                    renderIcon={incoming ? ArrowRight : ArrowLeft}
                    hasIconOnly
                    iconDescription={action}
                    aria-label={action}
                    disabled={busy || (incoming ? quantityMet : isLocked)}
                    onClick={() =>
                      onChange(incoming ? [...selected, unit.id] : selected.filter((id) => id !== unit.id))
                    }
                  />
                </TableCell>
              );
              return (
                <TableRow key={unit.id}>
                  {!incoming && actionCell}
                  <TableCell>
                    <span>
                      {unit.id}
                      {isLocked && <Tag type="purple">{t('txLocked')}</Tag>}
                    </span>
                  </TableCell>
                  <TableCell>
                    {unit.componentType ? t(componentDefinitions[unit.componentType].key) : unit.component}
                  </TableCell>
                  <TableCell>{transfusionBloodGroupLabel(unit.bloodGroup, t)}</TableCell>
                  <TableCell>{formatListDate(unit.expiresAt)}</TableCell>
                  {incoming && actionCell}
                </TableRow>
              );
            })}
            {!list.length && (
              <TableRow>
                <TableCell colSpan={columns.length}>{t(side === 'left' ? 'txNoCandidates' : 'txNoAssigned')}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };
  return (
    <>
      <p className={styles.notice}>{t('txCandidateHelp')}</p>
      <TransfusionComponentCards
        order={request.order}
        assigned={assigned}
        selectedComponent={component}
        onSelectComponent={setComponent}
        t={t}
      />
      <div className={styles.picker}>
        <section className={`${styles.panel} ${styles.pickerPanel}`}>
          <div className={styles.pickerHeader}>
            <div className={styles.pickerHeading}>
              <h4>{t('txCandidates')}</h4>
              <Button
                kind="ghost"
                size="sm"
                renderIcon={Clean}
                disabled={!search && !component}
                onClick={() => {
                  setSearch('');
                  setComponent(undefined);
                }}
              >
                {t('clearFilters')}
              </Button>
            </div>
            <Search
              size="md"
              id="tx-candidate-search"
              labelText={t('txSearchUnits')}
              placeholder={t('txSearchUnits')}
              value={search}
              closeButtonLabelText={t('clearSearch')}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          {table('left')}
        </section>
        <section className={`${styles.panel} ${styles.pickerPanel}`}>
          <div className={styles.pickerHeader}>
            <h4>{t('txAssigned')}</h4>
            {locked.length > 0 && <p>{t('txLockedHelp')}</p>}
          </div>
          {table('right')}
        </section>
      </div>
    </>
  );
}
