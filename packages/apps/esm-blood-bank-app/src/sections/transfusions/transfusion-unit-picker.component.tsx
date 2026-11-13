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
import { ArrowLeft, ArrowRight } from '@carbon/react/icons';
import { useState } from 'react';
import { formatListDate } from '../../shared/format-list-date';
import { normalizeSearch, type ProcessingTranslate } from '../../shared/processing-page.component';
import { componentDefinitions } from '../laboratory/fractionation/fractionation-rules';
import type { TransferUnit } from '../transfers/transfers.types';
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
  const selected = request.draft.selectedUnitIds;
  const locked = lockedAssignments(request).map((item) => item.unit);
  const assigned = [...locked, ...units.filter((unit) => selected.includes(unit.id))];
  const candidates = units.filter((unit) => transfusionCandidate(unit, request));
  const available = candidates.filter(
    (unit) =>
      !selected.includes(unit.id) &&
      normalizeSearch(`${unit.id} ${unit.component} ${unit.bloodGroup}`).includes(normalizeSearch(search)),
  );
  const table = (side: 'left' | 'right') => {
    const incoming = side === 'left';
    const list = incoming ? available : assigned;
    const title = t(incoming ? 'txCandidates' : 'txAssigned');
    const columns = [
      'inventoryUnitNumber',
      'fractionationComponent',
      'bloodGroupShort',
      'inventoryExpiration',
      'actions',
    ];
    return (
      <TableContainer className={styles.unitTableScroll} role="region" aria-label={title} tabIndex={0}>
        <Table useZebraStyles size="md" aria-label={title}>
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableHeader key={column}>{t(column)}</TableHeader>
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
              const group = /^(AB|A|B|O)\s*([+−-])$/.exec(unit.bloodGroup);
              return (
                <TableRow key={unit.id}>
                  <TableCell>
                    <span>
                      {unit.id}
                      {isLocked && <Tag type="purple">{t('txLocked')}</Tag>}
                    </span>
                  </TableCell>
                  <TableCell>
                    {unit.componentType ? t(componentDefinitions[unit.componentType].key) : unit.component}
                  </TableCell>
                  <TableCell>
                    {group
                      ? `${group[1]} ${t(group[2] === '+' ? 'labelRhPositive' : 'labelRhNegative')} (${group[2] === '+' ? '+' : '-'})`
                      : unit.bloodGroup}
                  </TableCell>
                  <TableCell>{formatListDate(unit.expiresAt)}</TableCell>
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
      <TransfusionComponentCards order={request.order} assigned={assigned} t={t} />
      <div className={styles.picker}>
        <section className={`${styles.panel} ${styles.pickerPanel}`}>
          <div className={styles.pickerHeader}>
            <h4>{t('txCandidates')}</h4>
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
