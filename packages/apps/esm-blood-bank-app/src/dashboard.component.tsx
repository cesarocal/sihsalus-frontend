import { Button, Tag, Tile } from '@carbon/react';
import { useTranslation } from 'react-i18next';

import { moduleName } from './constants';
import { worklist } from './prototype-data';
import { RecordList } from './record-list.component';
import type { PrototypeView } from './types';
import styles from './root.scss';

interface DashboardProps {
  onNavigate: (view: PrototypeView) => void;
}

const metrics = [
  { key: 'pendingSelections', fallback: 'Selecciones pendientes', value: '7', tone: 'blue' as const },
  { key: 'availableUnits', fallback: 'Unidades disponibles', value: '124', tone: 'green' as const },
  { key: 'reservedUnits', fallback: 'Unidades reservadas', value: '9', tone: 'purple' as const },
  { key: 'alertsToday', fallback: 'Alertas del día', value: '3', tone: 'red' as const },
];

export function Dashboard({ onNavigate }: DashboardProps) {
  const { t } = useTranslation(moduleName);

  return (
    <div className={styles.pageStack}>
      <section className={styles.metricGrid} aria-label={t('operationalSummary', 'Resumen operativo')}>
        {metrics.map((metric) => (
          <Tile className={styles.metric} key={metric.key}>
            <Tag size="sm" type={metric.tone}>
              {t(metric.key, metric.fallback)}
            </Tag>
            <strong>{metric.value}</strong>
          </Tile>
        ))}
      </section>

      <section className={styles.sectionCard}>
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>{t('today', 'Hoy')}</p>
            <h2>{t('operationalWorklist', 'Bandeja operativa')}</h2>
          </div>
          <Button kind="primary" size="sm" onClick={() => onNavigate('selection')}>
            {t('newApplicant', 'Nuevo postulante')}
          </Button>
        </div>
        <RecordList records={worklist} emptyLabel={t('noWork', 'No hay actividades pendientes.')} />
      </section>

      <section className={styles.actionGrid}>
        <button type="button" onClick={() => onNavigate('collection')}>
          <strong>{t('registerCollection', 'Registrar extracción')}</strong>
          <span>{t('collectionShortcut', 'Sangre total o aféresis')}</span>
        </button>
        <button type="button" onClick={() => onNavigate('inventory')}>
          <strong>{t('reviewInventory', 'Revisar inventario')}</strong>
          <span>{t('inventoryShortcut', 'Disponibilidad, reservas y alertas')}</span>
        </button>
        <button type="button" onClick={() => onNavigate('transfusion')}>
          <strong>{t('attendRequest', 'Atender solicitud')}</strong>
          <span>{t('requestShortcut', 'Compatibilidad, reserva y entrega')}</span>
        </button>
        <button type="button" onClick={() => onNavigate('reactions')}>
          <strong>{t('reportReaction', 'Reportar reacción')}</strong>
          <span>{t('reactionShortcut', 'Registro inicial y seguimiento')}</span>
        </button>
      </section>
    </div>
  );
}
