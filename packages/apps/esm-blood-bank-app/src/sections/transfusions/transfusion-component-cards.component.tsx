import type { ProcessingTranslate } from '../../shared/processing-page.component';
import { componentDefinitions } from '../laboratory/fractionation/fractionation-rules';
import { ComponentBag } from '../laboratory/fractionation/fractionation-tree.component';
import type { ComponentType } from '../laboratory/fractionation/fractionation.types';
import type { TransferUnit } from '../transfers/transfers.types';
import { transfusionBloodGroupLabel } from './transfusion-blood-group';
import styles from './transfusions.scss';
import type { TransfusionOrder } from './transfusions.types';

export function TransfusionComponentCards({
  order,
  assigned,
  selectedComponent,
  onSelectComponent,
  t,
}: {
  order: TransfusionOrder;
  assigned?: TransferUnit[];
  selectedComponent?: ComponentType;
  onSelectComponent?: (component: ComponentType) => void;
  t: ProcessingTranslate;
}) {
  return (
    <section className={styles.panel} aria-label={t('txRequirement')}>
      <h4>{t('txRequirement')}</h4>
      <ul className={styles.componentCards}>
        {order.items.map(({ component, quantity }) => {
          const count = assigned?.filter((unit) => unit.componentType === component).length ?? 0;
          const complete = !!assigned && count === quantity;
          const content = (
            <>
              <ComponentBag component={component} />
              <span className={styles.componentCardText}>
                <strong>{t(componentDefinitions[component].key)}</strong>
                <span className={styles.componentQuantity}>×{assigned ? Math.max(0, quantity - count) : quantity}</span>
                <small>
                  {assigned
                    ? t(complete ? 'txComponentComplete' : 'txComponentPending', { count: String(quantity) })
                    : transfusionBloodGroupLabel(order.bloodGroup, t)}
                </small>
              </span>
            </>
          );
          return (
            <li key={component} data-complete={complete || undefined}>
              {onSelectComponent ? (
                <label className={styles.componentFilter}>
                  <input
                    className="cds--visually-hidden"
                    type="radio"
                    name="tx-component-filter"
                    checked={selectedComponent === component}
                    onChange={() => onSelectComponent(component)}
                  />
                  <span className={styles.componentCard}>{content}</span>
                </label>
              ) : (
                <div className={styles.componentCard}>{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
