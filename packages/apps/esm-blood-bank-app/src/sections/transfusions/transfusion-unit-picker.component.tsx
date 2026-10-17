import {
  Button,
  Checkbox,
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
import { normalizeSearch, type ProcessingTranslate } from '../../shared/processing-page.component';
import { inventoryDisplayDate } from '../inventory/inventory-rules';
import { componentDefinitions } from '../laboratory/fractionation/fractionation-rules';
import type { TransferUnit } from '../transfers/transfers.types';
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
  const [left, setLeft] = useState<string[]>([]);
  const [right, setRight] = useState<string[]>([]);
  const selected = request.draft.selectedUnitIds;
  const locked = lockedAssignments(request).map((item) => item.unit);
  const candidates = units.filter((unit) => transfusionCandidate(unit, request));
  const table = (side: 'left' | 'right') => {
    const list =
      side === 'left'
        ? candidates.filter(
            (unit) =>
              !selected.includes(unit.id) &&
              normalizeSearch(`${unit.id} ${unit.component} ${unit.bloodGroup}`).includes(normalizeSearch(search)),
          )
        : [
            ...locked,
            ...selected
              .map((id) => units.find((unit) => unit.id === id))
              .filter((unit): unit is TransferUnit => !!unit),
          ];
    const title = t(side === 'left' ? 'txCandidates' : 'txAssigned');
    const columns = ['txSelect', 'inventoryUnitNumber', 'fractionationComponent', 'bloodGroup', 'inventoryExpiration'];
    return (
      <TableContainer className={styles.unitTableScroll} role="region" aria-label={title} tabIndex={0}>
        <Table useZebraStyles size="md" aria-label={title}>
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableHeader key={column} aria-label={column === 'txSelect' ? t(column) : undefined}>
                  {column !== 'txSelect' && t(column)}
                </TableHeader>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {list.map((unit) => (
              <TableRow key={unit.id}>
                <TableCell>
                  <Checkbox
                    key="select"
                    id={`tx-${side}-${unit.id}`}
                    hideLabel
                    labelText={`${t('txSelect')} ${unit.id}`}
                    disabled={busy || (side === 'right' && locked.some((item) => item.id === unit.id))}
                    checked={(side === 'left' ? left : right).includes(unit.id)}
                    onChange={(_event, { checked }) => {
                      const setter = side === 'left' ? setLeft : setRight;
                      setter((previous) =>
                        checked ? [...previous, unit.id] : previous.filter((id) => id !== unit.id),
                      );
                    }}
                  />
                </TableCell>
                <TableCell>
                  <span>
                    {unit.id}
                    {locked.some((item) => item.id === unit.id) && <Tag type="purple">{t('txLocked')}</Tag>}
                  </span>
                </TableCell>
                <TableCell>
                  {unit.componentType ? t(componentDefinitions[unit.componentType].key) : unit.component}
                </TableCell>
                <TableCell>{unit.bloodGroup}</TableCell>
                <TableCell>{inventoryDisplayDate(unit.expiresAt)}</TableCell>
              </TableRow>
            ))}
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
      <p>
        {t('txRequirement')}:{' '}
        {request.order.items
          .map((item) => `${item.quantity} × ${t(componentDefinitions[item.component].key)}`)
          .join('; ')}
      </p>
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
        <div className={styles.moveActions}>
          <Button
            kind="tertiary"
            size="sm"
            renderIcon={ArrowRight}
            hasIconOnly
            iconDescription={t('txAddUnits')}
            aria-label={t('txAddUnits')}
            disabled={busy || !left.length}
            onClick={() => {
              onChange([...new Set([...selected, ...left.filter((id) => candidates.some((unit) => unit.id === id))])]);
              setLeft([]);
            }}
          />
          <Button
            kind="tertiary"
            size="sm"
            renderIcon={ArrowLeft}
            hasIconOnly
            iconDescription={t('txReturnUnits')}
            aria-label={t('txReturnUnits')}
            disabled={busy || !right.length}
            onClick={() => {
              onChange(selected.filter((id) => !right.includes(id)));
              setRight([]);
            }}
          />
        </div>
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
