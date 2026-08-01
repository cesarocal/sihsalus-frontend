import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { DefinicionIndicadorForm } from '../api/types';
import { useResolvedDiagnosticos, useResolvedLocations, useResolvedOrdenes } from '../features/indicadores/hooks';
import styles from '../indicators-dashboard.module.scss';

interface DefinicionViewProps {
  definicion: DefinicionIndicadorForm;
}

const DefinicionView: React.FC<DefinicionViewProps> = ({ definicion }) => {
  const { t } = useTranslation();
  const locationUuids = useMemo(() => definicion.evento?.location_uuids ?? [], [definicion.evento?.location_uuids]);
  const diagnosticoUuids = useMemo(
    () => definicion.evento?.diagnosticos?.flatMap((item) => item.concepto_uuids) ?? [],
    [definicion.evento?.diagnosticos],
  );
  const ordenUuids = useMemo(
    () => definicion.evento?.ordenes?.map((item) => item.concepto_uuid) ?? [],
    [definicion.evento?.ordenes],
  );

  const { displayMap } = useResolvedLocations(locationUuids);
  const { resolveMap } = useResolvedDiagnosticos(diagnosticoUuids);
  const { data: ordenesData } = useResolvedOrdenes(ordenUuids);

  return (
    <div className={styles.definitionList}>
      <div>
        <strong>{t('definitionType', 'Tipo:')}</strong> 
            {definicion.tipo === 'conteo_atenciones' ? t('countEncounters', 'Conteo de atenciones') : t('countPatients', 'Conteo de pacientes')}
      </div>
      <div>
        <strong>{t('definitionLocations', 'Servicios:')}</strong>{' '}
        {locationUuids.length ? locationUuids.map((uuid) => displayMap.get(uuid) ?? uuid).join(', ') : t('all', 'Todos')}
      </div>
      <div>
        <strong>{t('definitionMinOccurrences', 'Mínimo de ocurrencias:')}</strong> {definicion.evento?.minimo_ocurrencias ?? 1}
      </div>
      <div>
        <strong>{t('definitionDiagnostics', 'Diagnósticos:')}</strong>{' '}
        {definicion.evento?.diagnosticos?.length
          ? definicion.evento.diagnosticos
              .map((item) => item.concepto_uuids.map((uuid) => resolveMap.get(uuid)?.nombre ?? uuid).join(', '))
              .join(', ')
          : t('noFilter', 'Sin filtro')}
      </div>
      <div>
        <strong>{t('definitionOrders', 'Órdenes:')}</strong>{' '}
        {definicion.evento?.ordenes?.length
          ? definicion.evento.ordenes.map((item) => ordenesData?.[item.concepto_uuid] ?? item.concepto_uuid).join(', ')
          : t('noFilter', 'Sin filtro')}
      </div>
      <div>
        <strong>{t('definitionSex', 'Sexo:')}</strong> {definicion.poblacion?.sexo ?? 'Sin filtro'}
      </div>
      <div>
        <strong>{t('definitionAge', 'Edad:')}</strong> {t('ageRangeValue', 'min {{min}} años / max {{max}} años', { min: definicion.poblacion?.min_anios ?? '-', max: definicion.poblacion?.max_anios_excl ?? '-' })}
      </div>
    </div>
  );
};

export default DefinicionView;
