import { ChevronDown } from '@carbon/react/icons';
import type { CSSProperties } from 'react';
import type { ProcessingTranslate } from '../../shared/processing-page.component';
import { componentDefinitions } from '../laboratory/fractionation/fractionation-rules';
import { ComponentBag } from '../laboratory/fractionation/fractionation-tree.component';
import type { ComponentType } from '../laboratory/fractionation/fractionation.types';
import { localDateTime } from '../laboratory/screening/screening-rules';
import type { StockMinimums } from '../settings/blood-bank-settings';
import { inventoryExpiry } from './inventory-rules';
import styles from './inventory.scss';
import type { InventoryUnit } from './inventory.types';

export function InventoryStockCards({
  units,
  unitComponent,
  stockMinimums = {},
  visibleComponents,
  expanded,
  onExpandedChange,
  selectedComponent,
  onSelectComponent,
  t,
}: {
  units: InventoryUnit[];
  unitComponent: (unit: InventoryUnit) => string;
  stockMinimums?: StockMinimums;
  visibleComponents: readonly ComponentType[];
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  selectedComponent: string;
  onSelectComponent: (component: string) => void;
  t: ProcessingTranslate;
}) {
  const now = new Date();
  const today = localDateTime(now).slice(0, 10);
  const counts = new Map<string, { total: number; available: number }>();
  for (const unit of units) {
    const component = unitComponent(unit);
    const count = counts.get(component) ?? { total: 0, available: 0 };
    count.total++;
    if (unit.status === 'APTO') {
      const expiry = inventoryExpiry(unit.expiresAt);
      if (expiry >= today && (!unit.expiresAt.includes('T') || Date.parse(unit.expiresAt) > now.getTime())) {
        count.available++;
      }
    }
    counts.set(component, count);
  }

  const stock = visibleComponents.map((component) => {
    const { total, available } = counts.get(component) ?? { total: 0, available: 0 };
    const minimum = stockMinimums[component];
    return { component, total, available, minimum, low: minimum !== undefined && available < minimum };
  });
  const lowStockCount = stock.filter(({ low }) => low).length;
  const columns = stock.length <= 6 ? stock.length : Math.ceil(stock.length / 2);
  const rows = [stock.slice(0, columns), stock.slice(columns)].filter((row) => row.length);

  return (
    <details
      className={styles.stockDetails}
      open={expanded}
      onToggle={(event) => onExpandedChange(event.currentTarget.open)}
    >
      <summary className={styles.stockDetailsSummary}>
        <strong>{t('inventoryStockByComponent')}</strong>
        <span className={styles.stockComponentCount}>
          {stock.length} {t(stock.length === 1 ? 'inventoryStockComponent' : 'inventoryStockComponents')}
        </span>
        <span className={styles.stockDetailsActions}>
          {lowStockCount > 0 && (
            <span className={styles.lowStockSummary}>
              {lowStockCount} {t('inventoryStockCountLow')}
            </span>
          )}
          <ChevronDown size={16} aria-hidden="true" />
        </span>
      </summary>
      <section
        className={styles.stockCardRows}
        aria-label={t('inventoryStockByComponent')}
        style={{ '--stock-card-columns': columns } as CSSProperties}
      >
        {rows.map((row) => (
          <ul className={styles.stockCards} key={row[0].component}>
            {row.map(({ component, total, available, minimum, low }) => {
              const selected = selectedComponent === component;
              const label = t(componentDefinitions[component].key);
              return (
                <li key={component}>
                  <button
                    type="button"
                    className={styles.stockCard}
                    aria-pressed={selected}
                    data-low-stock={low || undefined}
                    onClick={() => onSelectComponent(selected ? '' : component)}
                  >
                    <span className={styles.stockCardTitle}>
                      <ComponentBag component={component} />
                      <strong title={label}>{label}</strong>
                    </span>
                    <span className={styles.stockTotal}>
                      <strong>{total}</strong> {t('inventoryUnitsInStock')}
                    </span>
                    <span className={styles.stockAvailable}>{t('inventoryStockAvailable')} {available}</span>
                    {minimum !== undefined && (
                      <span className={styles.stockMinimum}>
                        <span>{t('inventoryStockMinimum')} {minimum}</span>
                        {low && <strong className={styles.stockWarning}>{t('inventoryLowStock')}</strong>}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        ))}
      </section>
    </details>
  );
}
