import { Button } from '@carbon/react';
import { CertificateCheck, RecentlyViewed, TrashCan } from '@carbon/react/icons';
import { useCallback, useState } from 'react';
import type { BloodBankApi } from '../../api';
import { ProcessingPage, useProcessingData, useProcessingTranslation } from '../../shared/processing-page.component';
import type { InventorySummary } from '../../types/blood-bank.types';
import shared from '../applicant-selection/selection.scss';
import type { DashboardShortcut } from '../dashboard/dashboard-shortcuts';
import { componentTypes } from '../laboratory/fractionation/fractionation-rules';
import type { ComponentType } from '../laboratory/fractionation/fractionation.types';
import type { StockMinimums } from '../settings/blood-bank-settings';
import type { InventoryOperation } from './inventory.types';
import { InventoryHistory } from './inventory-history.component';
import { canSeal, newInventoryOperation } from './inventory-rules';
import { InventorySelector } from './inventory-selector.component';
import { InventoryWorkflow } from './inventory-workflow.component';
import styles from './inventory.scss';

export function InventoryPage({
  api,
  shortcut,
  expiryWarningDays,
  stockMinimums = {},
  inventoryCardComponents = componentTypes,
}: {
  api: BloodBankApi;
  shortcut?: DashboardShortcut;
  expiryWarningDays?: number;
  stockMinimums?: StockMinimums;
  inventoryCardComponents?: readonly ComponentType[];
}) {
  const t = useProcessingTranslation();
  const load = useCallback(() => api.inventory.list(), [api]);
  const { data, loading, failed, reload } = useProcessingData(load);
  const [selected, setSelected] = useState<InventorySummary[]>([]);
  const [active, setActive] = useState<InventoryOperation | null>(null);
  const [history, setHistory] = useState(false);
  const [openReprint, setOpenReprint] = useState(false);
  const units = data?.units ?? [];
  const unavailable = loading || failed;
  const totals = [
    { label: 'inventoryStock', count: units.length },
    { label: 'quarantine', count: units.filter((unit) => unit.status === 'Cuarentena').length },
    { label: 'inventorySuitableUnits', count: units.filter((unit) => unit.status === 'APTO').length },
  ];
  const open = (kind: InventoryOperation['kind']) => {
    if (unavailable) return;
    const candidates = units.filter(
      (unit) =>
        selected.some((item) => item.id === unit.id) && (kind === 'qualitySeal' ? canSeal(unit) : unit.canDispose),
    );
    setActive(newInventoryOperation(kind, candidates));
  };
  return (
    <ProcessingPage
      title={t('inventoryTitle')}
      illustration="inventory"
      headerSummary={
        <dl className={styles.inventoryHeaderTotals} aria-label={t('inventorySummary')}>
          {totals.map(({ label, count }) => (
            <div key={label}>
              <dt>{t(label)}</dt>
              <dd>{unavailable ? '—' : count}</dd>
            </div>
          ))}
        </dl>
      }
    >
      <section className={shared.list}>
        <InventorySelector
          shortcut={shortcut}
          expiryWarningDays={expiryWarningDays}
          stockMinimums={stockMinimums}
          inventoryCardComponents={inventoryCardComponents}
          units={units}
          selected={selected}
          onChange={setSelected}
          busy={false}
          showSelectFiltered={false}
          prefix="inventory"
          loading={loading}
          failed={failed}
          reload={reload}
          t={t}
          actions={
            <>
              <Button
                kind="tertiary"
                size="lg"
                renderIcon={RecentlyViewed}
                disabled={unavailable}
                onClick={() => setHistory(true)}
              >
                {t('inventoryHistory')}
              </Button>
              <Button
                kind="tertiary"
                size="lg"
                renderIcon={CertificateCheck}
                disabled={unavailable}
                onClick={() => open('qualitySeal')}
              >
                {t('inventoryQualitySeal')}
              </Button>
              <Button
                kind="danger--tertiary"
                size="lg"
                aria-label={t('inventoryDispose')}
                dangerDescription={t('inventoryDangerDescription')}
                renderIcon={TrashCan}
                disabled={unavailable}
                onClick={() => open('disposal')}
              >
                {t('inventoryDispose')}
              </Button>
            </>
          }
        />
      </section>
      {active && (
        <InventoryWorkflow
          initial={active}
          units={units}
          api={api.inventory}
          openReprint={openReprint}
          t={t}
          onSaved={() => {
            setSelected([]);
            reload();
          }}
          onClose={() => {
            setActive(null);
            setOpenReprint(false);
            setSelected([]);
            reload();
          }}
        />
      )}
      {history && (
        <InventoryHistory
          operations={data?.operations ?? []}
          t={t}
          onClose={() => setHistory(false)}
          onResume={(operation, reprint = false) => {
            setHistory(false);
            setOpenReprint(reprint);
            setActive(operation);
          }}
        />
      )}
    </ProcessingPage>
  );
}
