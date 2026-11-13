import type { ProcessingTranslate } from '../../shared/processing-page.component';
import { componentDefinitions } from '../laboratory/fractionation/fractionation-rules';
import { ComponentBag } from '../laboratory/fractionation/fractionation-tree.component';
import type { TransferUnit } from '../transfers/transfers.types';
import styles from './transfusions.scss';
import type { TransfusionOrder } from './transfusions.types';

export function TransfusionComponentCards({
  order,
  assigned,
  t,
}: {
  order: TransfusionOrder;
  assigned?: TransferUnit[];
  t: ProcessingTranslate;
}) {
  return (
    <section className={styles.panel} aria-label={t('txRequirement')}>
      <h4>{t('txRequirement')}</h4>
      <ul className={styles.componentCards}>
        {order.items.map(({ component, quantity }) => {
          const count = assigned?.filter((unit) => unit.componentType === component).length ?? 0;
          const complete = !!assigned && count === quantity;
          return (
            <li key={component} className={styles.componentCard} data-complete={complete || undefined}>
              <ComponentBag component={component} />
              <div>
                <strong>{t(componentDefinitions[component].key)}</strong>
                <p className={styles.componentQuantity}>×{assigned ? Math.max(0, quantity - count) : quantity}</p>
                <small>
                  {assigned
                    ? t(complete ? 'txComponentComplete' : 'txComponentPending', { count: String(quantity) })
                    : `${t('bloodGroupShort')} ${order.bloodGroup}`}
                </small>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
