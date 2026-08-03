import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { DefinicionIndicadorForm, DiagnosticoOption } from '../api/types';
import { useResolvedDiagnosticos, useResolvedLocations, useResolvedOrdenes } from '../features/indicadores/hooks';
import styles from '../indicators-dashboard.module.scss';

export interface ResolvedDefinitionNames {
  locationNames: Map<string, string>;
  diagnosticoNames: Map<string, DiagnosticoOption>;
  ordenNames: Map<string, string>;
}

interface DefinicionViewProps {
  definicion: DefinicionIndicadorForm;
  /**
   * Pre-resolved uuid → name maps (e.g. provided by the detail page for all
   * version definitions at once). When present, no resolve hooks run and no
   * additional network requests are made for this view.
   */
  resolved?: ResolvedDefinitionNames;
}

const DefinicionView: React.FC<DefinicionViewProps> = ({ definicion, resolved }) => {
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

  // With pre-resolved maps the hooks receive an empty list, so their SWR
  // keys stay null and no requests are issued.
  const { displayMap } = useResolvedLocations(resolved ? [] : locationUuids);
  const { resolveMap } = useResolvedDiagnosticos(resolved ? [] : diagnosticoUuids);
  const { data: ordenesData } = useResolvedOrdenes(resolved ? [] : ordenUuids);

  const locationNames = resolved?.locationNames ?? displayMap;
  const diagnosticoNames = resolved?.diagnosticoNames ?? resolveMap;
  // Order names arrive as a Record from the hook but as a Map when
  // pre-resolved; normalize to a Map so the render path is uniform.
  const ordenNames = useMemo(
    () => resolved?.ordenNames ?? (ordenesData ? new Map(Object.entries(ordenesData)) : new Map<string, string>()),
    [resolved, ordenesData],
  );

  return (
    <div className={styles.definitionList}>
      <div>
        <strong>{t('definitionType', 'Tipo:')}</strong> 
            {definicion.tipo === 'conteo_atenciones' ? t('countEncounters', 'Conteo de atenciones') : t('countPatients', 'Conteo de pacientes')}
      </div>
      <div>
        <strong>{t('definitionLocations', 'Servicios:')}</strong>{' '}
        {locationUuids.length ? locationUuids.map((uuid) => locationNames.get(uuid) ?? uuid).join(', ') : t('all', 'Todos')}
      </div>
      <div>
        <strong>{t('definitionMinOccurrences', 'Mínimo de ocurrencias:')}</strong> {definicion.evento?.minimo_ocurrencias ?? 1}
      </div>
      <div>
        <strong>{t('definitionDiagnostics', 'Diagnósticos:')}</strong>{' '}
        {definicion.evento?.diagnosticos?.length
          ? definicion.evento.diagnosticos
              .map((item) => item.concepto_uuids.map((uuid) => diagnosticoNames.get(uuid)?.nombre ?? uuid).join(', '))
              .join(', ')
          : t('noFilter', 'Sin filtro')}
      </div>
      <div>
        <strong>{t('definitionOrders', 'Órdenes:')}</strong>{' '}
        {definicion.evento?.ordenes?.length
          ? definicion.evento.ordenes.map((item) => ordenNames.get(item.concepto_uuid) ?? item.concepto_uuid).join(', ')
          : t('noFilter', 'Sin filtro')}
      </div>
      <div>
        <strong>{t('definitionSex', 'Sexo:')}</strong> {definicion.poblacion?.sexo ?? t('noFilter', 'Sin filtro')}
      </div>
      <div>
        <strong>{t('definitionAge', 'Edad:')}</strong> {t('ageRangeValue', 'min {{min}} años / max {{max}} años', { min: definicion.poblacion?.min_anios ?? '-', max: definicion.poblacion?.max_anios_excl ?? '-' })}
      </div>
    </div>
  );
};

export default DefinicionView;
