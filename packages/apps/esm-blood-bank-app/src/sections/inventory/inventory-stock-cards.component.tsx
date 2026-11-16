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
  selectedComponent,
  onSelectComponent,
  t,
}: {
  units: InventoryUnit[];
  unitComponent: (unit: InventoryUnit) => string;
  stockMinimums?: StockMinimums;
  visibleComponents: readonly ComponentType[];
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

  const columns = visibleComponents.length <= 6 ? visibleComponents.length : Math.ceil(visibleComponents.length / 2);
  const rows = [visibleComponents.slice(0, columns), visibleComponents.slice(columns)].filter((row) => row.length);

  return (
    <section
      className={styles.stockCardRows}
      aria-label={t('inventoryStockByComponent')}
      style={{ '--stock-card-columns': columns } as CSSProperties}
    >
      {rows.map((row) => (
        <ul className={styles.stockCards} key={row[0]}>
          {row.map((component) => {
            const { total, available } = counts.get(component) ?? { total: 0, available: 0 };
            const minimum = stockMinimums[component];
            const low = minimum !== undefined && available < minimum;
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
  );
}
