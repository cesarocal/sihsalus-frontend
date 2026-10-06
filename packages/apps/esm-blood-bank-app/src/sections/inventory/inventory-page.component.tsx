import { Button } from '@carbon/react';
import { CertificateCheck, RecentlyViewed, TrashCan } from '@carbon/react/icons';
import { useCallback, useState } from 'react';
import type { BloodBankApi } from '../../api';
import { ProcessingPage, useProcessingData, useProcessingTranslation } from '../../shared/processing-page.component';
import { newInventoryOperation } from './inventory-rules';
import { InventorySelector } from './inventory-selector.component';
import { InventoryHistory } from './inventory-history.component';
import { InventoryWorkflow } from './inventory-workflow.component';
import type { InventoryOperation } from './inventory.types';
import type { InventorySummary } from '../../types/blood-bank.types';
import shared from '../applicant-selection/selection.scss';

export function InventoryPage({ api }: { api: BloodBankApi }) {
  const t = useProcessingTranslation();
  const load = useCallback(() => api.inventory.list(), [api]);
  const { data, loading, failed, reload } = useProcessingData(load);
  const [selected, setSelected] = useState<InventorySummary[]>([]);
  const [active, setActive] = useState<InventoryOperation | null>(null);
  const [history, setHistory] = useState(false);
  const units = data?.units ?? [];
  const unavailable = loading || failed;
  const open = (kind: InventoryOperation['kind']) => {
    if (unavailable) return;
    const candidates = units.filter(
      (unit) =>
        selected.some((item) => item.id === unit.id) &&
        (kind !== 'qualitySeal' || unit.screeningResult === 'nonReactive'),
    );
    setActive(newInventoryOperation(kind, candidates));
  };
  return (
    <ProcessingPage
      title={t('inventoryTitle')}
      illustration="inventory"
      counts={[
        {
          label: t('inventoryStock'),
          description: t('fractionationUnits'),
          value: units.length,
        },
        {
          label: t('quarantine'),
          description: t('fractionationUnits'),
          value: units.filter((unit) => unit.status === 'Cuarentena').length,
        },
        {
          label: t('inventorySuitable'),
          description: t('fractionationUnits'),
          value: units.filter((unit) => unit.status === 'APTO').length,
        },
      ]}
    >
      <section className={shared.list}>
        <InventorySelector
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
                renderIcon={RecentlyViewed}
                disabled={unavailable}
                onClick={() => setHistory(true)}
              >
                {t('inventoryHistory')}
              </Button>
              <Button
                kind="tertiary"
                renderIcon={CertificateCheck}
                disabled={unavailable}
                onClick={() => open('qualitySeal')}
              >
                {t('inventoryQualitySeal')}
              </Button>
              <Button
                kind="danger--tertiary"
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
          t={t}
          onSaved={() => {
            setSelected([]);
            reload();
          }}
          onClose={() => {
            setActive(null);
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
          onResume={(operation) => {
            setHistory(false);
            setActive(operation);
          }}
        />
      )}
    </ProcessingPage>
  );
}
