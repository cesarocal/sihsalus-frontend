import {
  Button,
  Checkbox,
  DataTable,
  InlineNotification,
  Modal,
  Select,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TableSelectAll,
  TableSelectRow,
  Tag,
  TextArea,
  TextInput,
} from '@carbon/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { moduleName } from './constants';
import { auditEvents, inventory } from './prototype-data';
import { RecordList } from './record-list.component';
import type { FractionationPlan, InventoryRecord } from './types';
import styles from './root.scss';

function PageHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className={styles.sectionHeading}>
      <div>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h2>{title}</h2>
        <p className={styles.muted}>{description}</p>
      </div>
    </div>
  );
}

const eliminationReasons = [
  ['expired', 'Unidades vencidas'],
  ['openCircuit', 'Circuito abierto'],
  ['lowVolume', 'Unidades de bajo volumen'],
  ['brokenBag', 'Bolsas rotas'],
  ['reactiveSerology', 'Unidades con serología reactiva'],
  ['irregularAntibodies', 'Unidades con anticuerpos séricos irregulares positivos'],
  ['hemolysis', 'Hemólisis'],
  ['coldChainBreak', 'Ruptura de la cadena de frío'],
] as const;

interface EliminationAct {
  id: string;
  date: string;
  units: string[];
  status: string;
  responsible: string;
  epidemiology: string;
}

interface FractionatedUnitDraft {
  id: string;
  component: string;
  volume: string;
  preparedAt: string;
  method: string;
  containerLot: string;
  expiresAt: string;
  specialConditions: string;
  location: string;
  result: string;
  rejectionReason: string;
}

const emptyFractionatedUnit: FractionatedUnitDraft = {
  id: '', component: '', volume: '', preparedAt: '2026-09-08 10:05', method: 'Fraccionamiento estándar', containerLot: 'LB-2026-0841', expiresAt: '', specialConditions: 'Ninguna', location: 'Cámara 01', result: 'Conforme', rejectionReason: '',
};

export function Collection() {
  const { t } = useTranslation(moduleName);
  const [status, setStatus] = useState('ready');

  return (
    <div className={styles.pageStack}>
      <section className={styles.sectionCard}>
        <PageHeader
          eyebrow={t('donationEpisode', 'Episodio de donación DON-01092')}
          title={t('collectionTitle', 'Extracción y aféresis')}
          description={t('collectionDescription', 'Registro del procedimiento, insumos, equipo, tiempos y resultado.')}
        />
        <div className={styles.formGrid}>
          <Select id="collection-procedure" labelText={t('procedure', 'Procedimiento')} defaultValue="whole-blood">
            <SelectItem value="whole-blood" text={t('wholeBlood', 'Sangre total')} />
            <SelectItem value="apheresis" text={t('apheresis', 'Aféresis')} />
          </Select>
          <TextInput id="bag-lot" labelText={t('bagLot', 'Lote de bolsa')} defaultValue="LB-2026-0841" />
          <TextInput id="collection-volume" labelText={t('obtainedVolume', 'Volumen obtenido (mL)')} defaultValue="450" />
          <TextInput id="collection-equipment" labelText={t('equipment', 'Equipo')} defaultValue="Balanza mezcladora 02" />
          <TextInput id="collection-start" type="time" labelText={t('startTime', 'Hora de inicio')} defaultValue="08:42" />
          <TextInput id="collection-end" type="time" labelText={t('endTime', 'Hora de finalización')} defaultValue="08:51" />
          <TextArea className={styles.fullWidth} id="collection-observations" labelText={t('observations', 'Observaciones')} />
        </div>
        <div className={styles.statusStrip}>
          <span>{t('procedureStatus', 'Estado del procedimiento')}</span>
          <Tag type={status === 'complete' ? 'green' : 'blue'}>{status === 'complete' ? t('completed', 'Completo') : t('readyToConfirm', 'Listo para confirmar')}</Tag>
          <Button size="sm" onClick={() => setStatus('complete')}>{t('confirmCollection', 'Confirmar extracción')}</Button>
        </div>
      </section>
    </div>
  );
}

const emptyPlan: FractionationPlan = {
  id: '', sourceUnitCode: '', bagType: '', initialVolume: '', plannedComponents: '', protocol: '', scheduledAt: '', responsible: '', status: 'Planificado', startedAt: '', finishedAt: '',
};

export function FractionationPlans() {
  const { t } = useTranslation(moduleName);
  const [plans, setPlans] = useState<FractionationPlan[]>([
    { id: 'PLAN-FRAC-0001', sourceUnitCode: 'BS-2026-01092', bagType: 'Triple CPD/SAGM', initialVolume: '450 mL', plannedComponents: 'GR, PFC, PQ', protocol: 'Fraccionamiento estándar', scheduledAt: '08/09/2026 09:30', responsible: 'Profesional sintético 01', status: 'Planificado', startedAt: '', finishedAt: '' },
  ]);
  const [planOpen, setPlanOpen] = useState(false);
  const [detailPlan, setDetailPlan] = useState<FractionationPlan | null>(null);
  const [draft, setDraft] = useState<FractionationPlan>({ ...emptyPlan, id: 'PLAN-FRAC-0002', sourceUnitCode: 'BS-2026-01093', bagType: 'Triple CPD/SAGM', initialVolume: '450 mL', plannedComponents: 'GR, PFC, PQ', protocol: 'Fraccionamiento estándar', scheduledAt: '08/09/2026 10:30', responsible: 'Profesional sintético 02' });
  const updateDraft = (field: keyof FractionationPlan, value: string) => setDraft((current) => ({ ...current, [field]: value }));
  const savePlan = () => {
    setPlans((current) => [...current, { ...draft, status: 'Planificado' }]);
    setPlanOpen(false);
  };
  const startPlan = (id: string) => setPlans((current) => current.map((plan) => plan.id === id ? { ...plan, status: 'En ejecución', startedAt: '08/09/2026 10:42' } : plan));
  const finishPlan = (id: string) => setPlans((current) => current.map((plan) => plan.id === id ? { ...plan, status: 'Finalizado', finishedAt: '08/09/2026 11:18' } : plan));

  return (
    <div className={styles.pageStack}>
      <section className={styles.sectionCard}>
        <PageHeader eyebrow={t('processingEyebrow', 'Producción de hemocomponentes')} title={t('processingTitle', 'Planes de fraccionamiento')} description={t('processingDescription', 'Gestione los planes y registre el inicio del fraccionamiento de cada unidad de sangre total.')} />
        <div className={styles.tableActionBar}>
          <span>{t('processingPlanHelp', 'Un plan conserva la unidad de origen, el protocolo, los componentes previstos y el responsable.')}</span>
          <Button onClick={() => setPlanOpen(true)}>{t('newFractionationPlan', 'Nuevo plan de fraccionamiento')}</Button>
        </div>
        <TableContainer className={styles.inventoryTable}>
          <Table size="sm" useZebraStyles>
            <TableHead><TableRow>{['planNumber', 'sourceUnitCode', 'plannedComponents', 'protocol', 'scheduledAt', 'productionResponsible', 'status', 'actions'].map((key) => <TableHeader key={key}>{t(key, key)}</TableHeader>)}</TableRow></TableHead>
            <TableBody>{plans.map((plan) => <TableRow key={plan.id}>
              <TableCell><strong>{plan.id}</strong></TableCell><TableCell>{plan.sourceUnitCode}</TableCell><TableCell>{plan.plannedComponents}</TableCell><TableCell>{plan.protocol}</TableCell><TableCell>{plan.scheduledAt}</TableCell><TableCell>{plan.responsible}</TableCell><TableCell><Tag type={plan.status === 'Finalizado' ? 'green' : plan.status === 'En ejecución' ? 'blue' : 'gray'}>{plan.status}</Tag></TableCell><TableCell><div className={styles.tableActionBar}><Button size="sm" kind="ghost" onClick={() => setDetailPlan(plan)}>{t('viewPlanDetail', 'Ver detalle')}</Button>{plan.status === 'Planificado' && <Button size="sm" kind="ghost" onClick={() => startPlan(plan.id)}>{t('startFractionation', 'Registrar inicio')}</Button>}{plan.status === 'En ejecución' && <Button size="sm" onClick={() => finishPlan(plan.id)}>{t('finishFractionation', 'Finalizar')}</Button>}</div></TableCell>
            </TableRow>)}</TableBody>
          </Table>
        </TableContainer>
      </section>

      {planOpen && <Modal open size="lg" modalHeading={t('newFractionationPlan', 'Nuevo plan de fraccionamiento')} primaryButtonText={t('saveFractionationPlan', 'Guardar plan')} secondaryButtonText={t('cancel', 'Cancelar')} onRequestClose={() => setPlanOpen(false)} onRequestSubmit={savePlan}>
        <div className={styles.formGrid}>
          <TextInput id="plan-id" labelText={t('planNumber', 'Número de plan')} value={draft.id} onChange={(event) => updateDraft('id', event.target.value)} />
          <TextInput id="plan-source" labelText={t('sourceUnitCode', 'Código de unidad de sangre total')} value={draft.sourceUnitCode} onChange={(event) => updateDraft('sourceUnitCode', event.target.value)} />
          <TextInput id="plan-bag" labelText={t('bagType', 'Tipo de bolsa')} value={draft.bagType} onChange={(event) => updateDraft('bagType', event.target.value)} />
          <TextInput id="plan-volume" labelText={t('initialVolume', 'Volumen inicial')} value={draft.initialVolume} onChange={(event) => updateDraft('initialVolume', event.target.value)} />
          <TextInput id="plan-components" labelText={t('plannedComponents', 'Componentes planificados')} value={draft.plannedComponents} onChange={(event) => updateDraft('plannedComponents', event.target.value)} />
          <TextInput id="plan-protocol" labelText={t('protocol', 'Método o protocolo')} value={draft.protocol} onChange={(event) => updateDraft('protocol', event.target.value)} />
          <TextInput id="plan-scheduled" labelText={t('scheduledAt', 'Fecha y hora de programación')} value={draft.scheduledAt} onChange={(event) => updateDraft('scheduledAt', event.target.value)} />
          <TextInput id="plan-responsible" labelText={t('productionResponsible', 'Responsable')} value={draft.responsible} onChange={(event) => updateDraft('responsible', event.target.value)} />
        </div>
      </Modal>}

      {detailPlan && <Modal open passiveModal size="lg" modalHeading={t('fractionationPlanDetail', 'Detalle del plan de fraccionamiento')} onRequestClose={() => setDetailPlan(null)}>
        <div className={styles.reviewGrid}>
          <div><span>{t('planNumber', 'Número de plan')}</span><strong>{detailPlan.id}</strong></div>
          <div><span>{t('sourceUnitCode', 'Unidad de origen')}</span><strong>{detailPlan.sourceUnitCode}</strong></div>
          <div><span>{t('bagType', 'Tipo de bolsa')}</span><strong>{detailPlan.bagType}</strong></div>
          <div><span>{t('initialVolume', 'Volumen inicial')}</span><strong>{detailPlan.initialVolume}</strong></div>
          <div><span>{t('plannedComponents', 'Componentes planificados')}</span><strong>{detailPlan.plannedComponents}</strong></div>
          <div><span>{t('protocol', 'Método o protocolo')}</span><strong>{detailPlan.protocol}</strong></div>
          <div><span>{t('scheduledAt', 'Programado')}</span><strong>{detailPlan.scheduledAt}</strong></div>
          <div><span>{t('productionResponsible', 'Responsable')}</span><strong>{detailPlan.responsible}</strong></div>
          <div><span>{t('status', 'Estado')}</span><strong>{detailPlan.status}</strong></div>
          <div><span>{t('startedAt', 'Hora de inicio')}</span><strong>{detailPlan.startedAt || t('notRecorded', 'No registrado')}</strong></div>
          <div><span>{t('finishedAt', 'Hora de finalización')}</span><strong>{detailPlan.finishedAt || t('notRecorded', 'No registrado')}</strong></div>
        </div>
      </Modal>}
    </div>
  );
}

export function ProductionFlow() {
  const { t } = useTranslation(moduleName);
  const [planned, setPlanned] = useState(false);
  const [recorded, setRecorded] = useState(false);

  return (
    <section className={styles.sectionCard}>
      <PageHeader
        eyebrow={t('productionEyebrow', 'Producción de hemocomponentes')}
        title={t('productionTitle', 'Fraccionamiento y registro de componentes')}
        description={t('productionDescription', 'Planifique, ejecute, etiquete y verifique el fraccionamiento desde el inventario.')}
      />
      <div className={styles.flowLine} role="list" aria-label={t('productionFlow', 'Flujo de producción')}>
        <span role="listitem" className={planned ? styles.flowComplete : undefined}>{t('productionPlanned', 'Planificado')}</span>
        <span role="listitem" className={recorded ? styles.flowComplete : undefined}>{t('productionExecuted', 'Ejecutado')}</span>
        <span role="listitem" className={recorded ? styles.flowComplete : undefined}>{t('productionLabeled', 'Etiquetado y verificado')}</span>
        <span role="listitem">{t('quarantine', 'En cuarentena')}</span>
      </div>
      <div className={styles.formGrid}>
        <TextInput id="production-source-unit" labelText={t('sourceUnitCode', 'Código de unidad de sangre total')} defaultValue="BS-2026-01092" />
        <TextInput id="production-bag-type" labelText={t('bagType', 'Tipo de bolsa')} defaultValue="Triple CPD/SAGM" />
        <TextInput id="production-initial-volume" labelText={t('initialVolume', 'Volumen inicial (mL)')} defaultValue="450" />
        <TextInput id="production-components" labelText={t('plannedComponents', 'Componentes planificados')} defaultValue="GR, PFC, PQ" />
        <TextInput id="production-protocol" labelText={t('protocol', 'Método o protocolo')} defaultValue="Fraccionamiento estándar" />
        <TextInput id="production-scheduled-at" type="datetime-local" labelText={t('scheduledAt', 'Fecha y hora de programación')} defaultValue="2026-09-08T09:30" />
        <TextInput id="production-responsible" labelText={t('productionResponsible', 'Responsable')} defaultValue="Profesional sintético 01" />
      </div>
      <div className={styles.modalSection}>
        <h3>{t('executionData', 'Datos de ejecución')}</h3>
        <div className={styles.formGrid}>
          <TextInput id="production-started-at" type="datetime-local" labelText={t('startedAt', 'Fecha y hora de inicio')} defaultValue="2026-09-08T09:42" />
          <TextInput id="production-equipment" labelText={t('centrifuge', 'Equipo / centrífuga')} defaultValue="Centrífuga 02" />
          <TextInput id="production-temperature" labelText={t('temperature', 'Temperatura')} defaultValue="22 °C" />
          <TextInput id="production-speed-time" labelText={t('centrifugationProgram', 'Velocidad y tiempo')} defaultValue="3500 rpm · 10 min" />
          <TextInput id="production-finished-at" type="datetime-local" labelText={t('finishedAt', 'Hora de finalización')} defaultValue="2026-09-08T10:05" />
          <TextArea className={styles.fullWidth} id="production-incidents" labelText={t('incidentsAndWaste', 'Incidentes, apertura del sistema y residuos descartados')} />
        </div>
      </div>
      <div className={styles.modalSection}>
        <h3>{t('componentRegistration', 'Registro de cada hemocomponente')}</h3>
        <div className={styles.formGrid}>
          <TextInput id="component-code" labelText={t('componentCode', 'Código individual del componente')} defaultValue="GR-01092-A" />
          <TextInput id="component-type" labelText={t('componentType', 'Tipo de componente')} defaultValue="Glóbulos rojos" />
          <TextInput id="component-volume" labelText={t('componentVolume', 'Volumen o peso obtenido')} defaultValue="280 mL" />
          <TextInput id="component-expiration" type="date" labelText={t('calculatedExpiration', 'Fecha de vencimiento calculada')} defaultValue="2026-10-18" />
          <TextInput id="component-supply-lot" labelText={t('supplyLot', 'Bolsa/recipiente y lote del insumo')} defaultValue="LB-2026-0841" />
          <TextInput id="component-location" labelText={t('componentLocation', 'Ubicación')} defaultValue="Cámara 01" />
          <Select id="component-result" labelText={t('componentResult', 'Resultado')} defaultValue="conforming">
            <SelectItem value="conforming" text={t('conforming', 'Conforme')} />
            <SelectItem value="non-conforming" text={t('nonConforming', 'No conforme')} />
          </Select>
          <TextInput id="component-conditions" labelText={t('specialConditions', 'Condiciones especiales')} defaultValue="Ninguna" />
        </div>
      </div>
      <div className={styles.formActions}>
        <Button kind="secondary" onClick={() => setPlanned(true)}>{t('planProduction', 'Guardar plan de fraccionamiento')}</Button>
        <Button onClick={() => { setPlanned(true); setRecorded(true); }}>{t('registerProduction', 'Registrar producción')}</Button>
      </div>
      {planned && <InlineNotification hideCloseButton kind="success" lowContrast title={recorded ? t('productionRegistered', 'Producción registrada') : t('productionPlanCreated', 'Plan de producción creado')} subtitle={t('productionQuarantineNotice', 'Los componentes quedan vinculados a la unidad de origen y en cuarentena para calificación biológica.')} />}
    </section>
  );
}

export function Inventory() {
  const { t } = useTranslation(moduleName);
  const [registeredUnits, setRegisteredUnits] = useState<InventoryRecord[]>([]);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerDraft, setRegisterDraft] = useState<InventoryRecord>({ id: 'UN-2026-01100', component: 'Glóbulos rojos', bloodGroup: 'O+', location: 'Cámara 01', expiresAt: '18/10/2026', status: 'Disponible', tone: 'green', reference: 'BS-2026-01100', preparedAt: '2026-09-08 10:05', method: 'Registro de unidad externa', containerLot: 'LB-2026-0841', specialConditions: 'Ninguna', result: 'Conforme', rejectionReason: '' });
  const [contextUnit, setContextUnit] = useState<{ id: string; x: number; y: number } | null>(null);
  const [fractionateOpen, setFractionateOpen] = useState(false);
  const [fractionSourceId, setFractionSourceId] = useState('');
  const [fractionatedUnits, setFractionatedUnits] = useState<FractionatedUnitDraft[]>([
    { ...emptyFractionatedUnit, id: 'GR-01100-A', component: 'Glóbulos rojos', volume: '280 mL', expiresAt: '18/10/2026' },
    { ...emptyFractionatedUnit, id: 'PFC-01100-B', component: 'Plasma fresco congelado', volume: '220 mL', expiresAt: '14/08/2027', location: 'Congelador 02' },
  ]);
  const [filter, setFilter] = useState('all');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [actOpen, setActOpen] = useState(false);
  const [actsOpen, setActsOpen] = useState(false);
  const [pendingUnits, setPendingUnits] = useState<typeof inventory>([]);
  const [eliminatedUnitIds, setEliminatedUnitIds] = useState<string[]>([]);
  const [eliminationActs, setEliminationActs] = useState<EliminationAct[]>([]);
  const [actNumber, setActNumber] = useState('ACT-ELIM-2026-0001');
  const [actDate, setActDate] = useState('2026-09-08');
  const [area, setArea] = useState('Área de eliminación');
  const [container, setContainer] = useState('REC-ELIM-001');
  const [wasteResponsible, setWasteResponsible] = useState('');
  const [responsibleName, setResponsibleName] = useState('');
  const [responsibleSignature, setResponsibleSignature] = useState('');
  const [epidemiologyName, setEpidemiologyName] = useState('');
  const [epidemiologySignature, setEpidemiologySignature] = useState('');
  const [reconciliationConfirmed, setReconciliationConfirmed] = useState(false);
  const [containerConfirmed, setContainerConfirmed] = useState(false);
  const [observations, setObservations] = useState('');
  const [causes, setCauses] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState(false);

  const records = [...inventory, ...registeredUnits].map((record) =>
    eliminatedUnitIds.includes(record.id)
      ? { ...record, status: 'Eliminada', tone: 'red' as const, reference: actNumber }
      : record,
  );
  const visibleRecords = filter === 'all' ? records : records.filter((record) => record.status === filter);
  const headers = [
    { key: 'id', header: t('unitCode', 'Código de unidad') },
    { key: 'component', header: t('bloodComponent', 'Hemocomponente') },
    { key: 'bloodGroup', header: t('bloodGroupRh', 'Grupo / Rh') },
    { key: 'location', header: t('storageLocation', 'Ubicación') },
    { key: 'expiresAt', header: t('expiration', 'Vencimiento') },
    { key: 'reference', header: t('relatedReference', 'Referencia') },
    { key: 'status', header: t('status', 'Estado') },
  ];
  const rows = visibleRecords.map((record) => ({
    ...record,
    status: <Tag type={record.tone}>{record.status}</Tag>,
  }));

  const updateRegisterDraft = (field: keyof InventoryRecord, value: string) => setRegisterDraft((current) => ({ ...current, [field]: value }));
  const registerUnit = () => {
    setRegisteredUnits((current) => [...current, registerDraft]);
    setRegisterOpen(false);
  };
  const openFractionation = () => {
    setFractionSourceId(contextUnit?.id ?? '');
    setContextUnit(null);
    setFractionateOpen(true);
  };
  const updateFractionatedUnit = (index: number, field: keyof FractionatedUnitDraft, value: string) => setFractionatedUnits((current) => current.map((unit, unitIndex) => unitIndex === index ? { ...unit, [field]: value } : unit));
  const saveFractionation = () => {
    setRegisteredUnits((current) => [...current, ...fractionatedUnits.map((unit) => ({
      id: unit.id,
      component: unit.component,
      bloodGroup: records.find((record) => record.id === fractionSourceId)?.bloodGroup ?? 'O+',
      location: unit.location,
      expiresAt: unit.expiresAt,
      status: 'En cuarentena',
      tone: 'warm-gray' as const,
      reference: fractionSourceId,
      preparedAt: unit.preparedAt,
      method: unit.method,
      containerLot: unit.containerLot,
      specialConditions: unit.specialConditions,
      result: unit.result,
      rejectionReason: unit.rejectionReason,
    }))]);
    setFractionateOpen(false);
  };

  const openEliminationPrompt = (selectedRows: Array<{ id: string }>) => {
    const selected = selectedRows
      .map((row) => records.find((record) => record.id === row.id))
      .filter((record): record is (typeof records)[number] => Boolean(record) && record.status !== 'Eliminada');
    setPendingUnits(selected);
    setConfirmOpen(selected.length > 0);
  };

  const startAct = () => {
    setCauses(Object.fromEntries(pendingUnits.map((unit) => [unit.id, ''])));
    setFormError(false);
    setConfirmOpen(false);
    setActOpen(true);
  };

  const generateAct = () => {
    const allCausesProvided = pendingUnits.every((unit) => Boolean(causes[unit.id]));
    const signaturesProvided = Boolean(responsibleName && responsibleSignature && epidemiologyName && epidemiologySignature);
    if (!allCausesProvided || !signaturesProvided || !wasteResponsible || !reconciliationConfirmed || !containerConfirmed) {
      setFormError(true);
      return;
    }

    setEliminationActs((current) => [
      ...current,
      {
        id: actNumber,
        date: actDate,
        units: pendingUnits.map((unit) => unit.id),
        status: 'Firmada',
        responsible: responsibleName,
        epidemiology: epidemiologyName,
      },
    ]);
    setEliminatedUnitIds((current) => [...new Set([...current, ...pendingUnits.map((unit) => unit.id)])]);
    setActOpen(false);
  };

  return (
    <div className={styles.pageStack}>
      <section className={styles.sectionCard}>
        <PageHeader
          eyebrow={t('traceableInventory', 'Inventario trazable')}
          title={t('inventoryTitle', 'Unidades y hemocomponentes')}
          description={t('inventoryDescription', 'Disponibilidad, ubicación, vencimiento, reserva, segregación y causal de bloqueo.')}
        />
        <div className={styles.toolbar}>
          <Select id="inventory-filter" labelText={t('filterByStatus', 'Filtrar por estado')} value={filter} onChange={(event) => setFilter(event.target.value)}>
            <SelectItem value="all" text={t('allStatuses', 'Todos los estados')} />
            <SelectItem value="Disponible" text={t('available', 'Disponible')} />
            <SelectItem value="Reservado" text={t('reserved', 'Reservado')} />
            <SelectItem value="Segregado" text={t('segregated', 'Segregado')} />
            <SelectItem value="Próximo a vencer" text={t('nearExpiration', 'Próximo a vencer')} />
            <SelectItem value="Eliminada" text={t('eliminated', 'Eliminada')} />
          </Select>
          <Button kind="secondary" size="sm" onClick={() => setRegisterOpen(true)}>{t('registerUnit', 'Registrar unidad')}</Button>
          <Button kind="secondary" size="sm" onClick={() => setActsOpen(true)}>{t('viewEliminationActs', 'Ver actas de eliminación')}</Button>
        </div>
        <DataTable rows={rows} headers={headers} size="sm" useZebraStyles isSortable>
          {({ rows: tableRows, headers: tableHeaders, getHeaderProps, getRowProps, getTableProps, getSelectionProps, selectedRows }) => (
            <TableContainer className={styles.inventoryTable}>
              <div className={styles.tableActionBar}>
                <span>{selectedRows.length > 0 ? t('selectedUnits', '{{count}} unidad(es) seleccionada(s)', { count: selectedRows.length }) : t('selectUnitsForElimination', 'Seleccione una o más unidades para generar un acta')}</span>
                <Button kind="danger" size="sm" disabled={selectedRows.length === 0} onClick={() => openEliminationPrompt(selectedRows)}>
                  {t('addUnitsToElimination', 'Agregar unidades a eliminar')}
                </Button>
              </div>
              <Table {...getTableProps()} aria-label={t('inventoryTitle', 'Unidades y hemocomponentes')}>
                <TableHead>
                  <TableRow>
                    <TableSelectAll {...getSelectionProps()} />
                    {tableHeaders.map((header) => (
                      <TableHeader {...getHeaderProps({ header })} key={header.key}>
                        {header.header}
                      </TableHeader>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tableRows.map((row) => (
                    <TableRow {...getRowProps({ row })} key={row.id} onContextMenu={(event) => { event.preventDefault(); setContextUnit({ id: row.id, x: event.clientX, y: event.clientY }); }}>
                      <TableSelectRow {...getSelectionProps({ row })} disabled={eliminatedUnitIds.includes(row.id)} />
                      {row.cells.map((cell) => <TableCell key={cell.id}>{cell.value}</TableCell>)}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DataTable>
        {rows.length === 0 && <p className={styles.emptyTable}>{t('noUnitsForFilter', 'No hay unidades para este filtro.')}</p>}
      </section>

      {contextUnit && <div className={styles.contextMenu} role="menu" style={{ left: contextUnit.x, top: contextUnit.y }}>
        <Button kind="ghost" size="sm" onClick={openFractionation}>{t('fractionateUnit', 'Fraccionar unidad')}</Button>
      </div>}

      {registerOpen && <Modal open size="lg" modalHeading={t('registerUnit', 'Registrar unidad')} primaryButtonText={t('saveUnit', 'Guardar unidad')} secondaryButtonText={t('cancel', 'Cancelar')} onRequestClose={() => setRegisterOpen(false)} onRequestSubmit={registerUnit}>
        <div className={styles.formGrid}>
          <TextInput id="register-unit-code" labelText={t('unitCode', 'Código de unidad')} value={registerDraft.id} onChange={(event) => updateRegisterDraft('id', event.target.value)} />
          <TextInput id="register-component" labelText={t('bloodComponent', 'Hemocomponente')} value={registerDraft.component} onChange={(event) => updateRegisterDraft('component', event.target.value)} />
          <TextInput id="register-group" labelText={t('bloodGroupRh', 'Grupo / Rh')} value={registerDraft.bloodGroup} onChange={(event) => updateRegisterDraft('bloodGroup', event.target.value)} />
          <TextInput id="register-location" labelText={t('storageLocation', 'Ubicación')} value={registerDraft.location} onChange={(event) => updateRegisterDraft('location', event.target.value)} />
          <TextInput id="register-expiration" labelText={t('expiration', 'Vencimiento')} value={registerDraft.expiresAt} onChange={(event) => updateRegisterDraft('expiresAt', event.target.value)} />
          <TextInput id="register-reference" labelText={t('relatedReference', 'Referencia')} value={registerDraft.reference} onChange={(event) => updateRegisterDraft('reference', event.target.value)} />
          <TextInput id="register-prepared" labelText={t('preparedAt', 'Fecha y hora de preparación')} value={registerDraft.preparedAt ?? ''} onChange={(event) => updateRegisterDraft('preparedAt', event.target.value)} />
          <TextInput id="register-method" labelText={t('methodUsed', 'Método utilizado')} value={registerDraft.method ?? ''} onChange={(event) => updateRegisterDraft('method', event.target.value)} />
          <TextInput id="register-lot" labelText={t('supplyLot', 'Bolsa/recipiente y lote del insumo')} value={registerDraft.containerLot ?? ''} onChange={(event) => updateRegisterDraft('containerLot', event.target.value)} />
          <TextInput id="register-conditions" labelText={t('specialConditions', 'Condiciones especiales')} value={registerDraft.specialConditions ?? ''} onChange={(event) => updateRegisterDraft('specialConditions', event.target.value)} />
          <Select id="register-result" labelText={t('componentResult', 'Resultado')} value={registerDraft.result ?? 'Conforme'} onChange={(event) => updateRegisterDraft('result', event.target.value)}><SelectItem value="Conforme" text={t('conforming', 'Conforme')} /><SelectItem value="No conforme" text={t('nonConforming', 'No conforme')} /></Select>
          <TextInput id="register-rejection" labelText={t('rejectionReason', 'Motivo de rechazo, si corresponde')} value={registerDraft.rejectionReason ?? ''} onChange={(event) => updateRegisterDraft('rejectionReason', event.target.value)} />
          <Select id="register-status" labelText={t('status', 'Estado')} value={registerDraft.status} onChange={(event) => updateRegisterDraft('status', event.target.value)}>
            <SelectItem value="Disponible" text={t('available', 'Disponible')} /><SelectItem value="Cuarentena" text={t('quarantine', 'En cuarentena')} /><SelectItem value="Reservado" text={t('reserved', 'Reservado')} />
          </Select>
        </div>
      </Modal>}

      {fractionateOpen && <Modal open size="lg" modalHeading={t('fractionateUnit', 'Fraccionar unidad')} primaryButtonText={t('saveFractionatedUnits', 'Guardar unidades fraccionadas')} secondaryButtonText={t('cancel', 'Cancelar')} onRequestClose={() => setFractionateOpen(false)} onRequestSubmit={saveFractionation}>
        <InlineNotification hideCloseButton lowContrast kind="info" title={t('fractionationContext', 'Registro de fraccionamiento')} subtitle={t('fractionationContextHelp', 'Registre dos o más componentes, etiquételos y verifique que cada código corresponda a la unidad de origen. Quedarán en cuarentena.')} />
        <p><strong>{t('sourceUnitCode', 'Unidad de origen')}:</strong> {fractionSourceId}</p>
        {fractionatedUnits.map((unit, index) => <div className={styles.modalSection} key={unit.id}>
          <div className={styles.tableActionBar}><h3>{t('componentUnit', 'Componente')} {index + 1}</h3><Button kind="ghost" size="sm" disabled={fractionatedUnits.length <= 2} onClick={() => setFractionatedUnits((current) => current.filter((_item, itemIndex) => itemIndex !== index))}>{t('removeComponent', 'Quitar')}</Button></div>
          <div className={styles.formGrid}>
            <TextInput id={`fraction-id-${index}`} labelText={t('componentCode', 'Código individual del componente')} value={unit.id} onChange={(event) => updateFractionatedUnit(index, 'id', event.target.value)} />
            <TextInput id={`fraction-type-${index}`} labelText={t('componentType', 'Tipo de componente')} value={unit.component} onChange={(event) => updateFractionatedUnit(index, 'component', event.target.value)} />
            <TextInput id={`fraction-volume-${index}`} labelText={t('componentVolume', 'Volumen o peso obtenido')} value={unit.volume} onChange={(event) => updateFractionatedUnit(index, 'volume', event.target.value)} />
            <TextInput id={`fraction-prepared-${index}`} labelText={t('preparedAt', 'Fecha y hora de preparación')} value={unit.preparedAt} onChange={(event) => updateFractionatedUnit(index, 'preparedAt', event.target.value)} />
            <TextInput id={`fraction-method-${index}`} labelText={t('methodUsed', 'Método utilizado')} value={unit.method} onChange={(event) => updateFractionatedUnit(index, 'method', event.target.value)} />
            <TextInput id={`fraction-lot-${index}`} labelText={t('supplyLot', 'Bolsa/recipiente y lote del insumo')} value={unit.containerLot} onChange={(event) => updateFractionatedUnit(index, 'containerLot', event.target.value)} />
            <TextInput id={`fraction-expires-${index}`} labelText={t('calculatedExpiration', 'Fecha de vencimiento calculada')} value={unit.expiresAt} onChange={(event) => updateFractionatedUnit(index, 'expiresAt', event.target.value)} />
            <TextInput id={`fraction-location-${index}`} labelText={t('componentLocation', 'Ubicación')} value={unit.location} onChange={(event) => updateFractionatedUnit(index, 'location', event.target.value)} />
            <TextInput id={`fraction-conditions-${index}`} labelText={t('specialConditions', 'Condiciones especiales')} value={unit.specialConditions} onChange={(event) => updateFractionatedUnit(index, 'specialConditions', event.target.value)} />
            <Select id={`fraction-result-${index}`} labelText={t('componentResult', 'Resultado')} value={unit.result} onChange={(event) => updateFractionatedUnit(index, 'result', event.target.value)}><SelectItem value="Conforme" text={t('conforming', 'Conforme')} /><SelectItem value="No conforme" text={t('nonConforming', 'No conforme')} /></Select>
            <TextInput id={`fraction-rejection-${index}`} labelText={t('rejectionReason', 'Motivo de rechazo, si corresponde')} value={unit.rejectionReason} onChange={(event) => updateFractionatedUnit(index, 'rejectionReason', event.target.value)} />
          </div>
        </div>)}
        <Button kind="tertiary" onClick={() => setFractionatedUnits((current) => [...current, { ...emptyFractionatedUnit, id: `COMP-${current.length + 1}` }])}>{t('addComponent', 'Agregar componente')}</Button>
      </Modal>}

      {confirmOpen && <Modal
        open={confirmOpen}
        modalHeading={t('confirmUnitsForElimination', 'Agregar unidades al acta de eliminación')}
        primaryButtonText={t('continueToEliminationAct', 'Continuar con el acta')}
        secondaryButtonText={t('cancel', 'Cancelar')}
        onRequestClose={() => setConfirmOpen(false)}
        onRequestSubmit={startAct}
      >
        <p>{t('confirmUnitsForEliminationHelp', 'Se agregarán {{count}} unidad(es). Primero verifique los datos físicos contra el registro; luego deberá indicar una causa por unidad y completar las firmas.', { count: pendingUnits.length })}</p>
        <ul className={styles.modalList}>
          {pendingUnits.map((unit) => <li key={unit.id}><strong>{unit.id}</strong> · {unit.component} · {unit.bloodGroup}</li>)}
        </ul>
      </Modal>}

      {actOpen && <Modal
        open={actOpen}
        size="lg"
        modalHeading={t('eliminationActTitle', 'Acta de Eliminación de Unidades')}
        primaryButtonText={t('generateEliminationAct', 'Generar y firmar acta')}
        secondaryButtonText={t('cancel', 'Cancelar')}
        onRequestClose={() => setActOpen(false)}
        onRequestSubmit={generateAct}
      >
        <div className={styles.modalStack}>
          <InlineNotification
            hideCloseButton
            lowContrast
            kind="info"
            title={t('eliminationFlowNotice', 'Flujo EG10-PC01')}
            subtitle={t('eliminationFlowNoticeHelp', 'Verificación física, acta, recipiente cerrado y rotulado, conciliación, área de eliminación y firma digital.')}
          />
          {formError && <InlineNotification hideCloseButton lowContrast kind="error" title={t('eliminationActIncomplete', 'Acta incompleta')} subtitle={t('eliminationActIncompleteHelp', 'Complete una causa por unidad, ambas firmas, el responsable de residuos y las verificaciones obligatorias.')} />}
          <div className={styles.formGrid}>
            <TextInput id="elimination-act-number" labelText={t('eliminationActNumber', 'Número de acta')} value={actNumber} onChange={(event) => setActNumber(event.target.value)} />
            <TextInput id="elimination-act-date" type="date" labelText={t('eliminationActDate', 'Fecha del acta')} value={actDate} onChange={(event) => setActDate(event.target.value)} />
            <TextInput id="elimination-area" labelText={t('eliminationArea', 'Área de eliminación')} value={area} onChange={(event) => setArea(event.target.value)} />
            <TextInput id="elimination-container" labelText={t('eliminationContainer', 'Recipiente cerrado y rotulado')} value={container} onChange={(event) => setContainer(event.target.value)} />
          </div>
          <div className={styles.modalSection}>
            <h3>{t('unitsAndReasons', 'Unidades y causas')}</h3>
            <div className={styles.modalUnitTable}>
              <Table size="sm" useZebraStyles>
                <TableHead><TableRow><TableHeader>{t('unitCode', 'Código de unidad')}</TableHeader><TableHeader>{t('bloodComponent', 'Hemocomponente')}</TableHeader><TableHeader>{t('bloodGroupRh', 'Grupo / Rh')}</TableHeader><TableHeader>{t('eliminationReason', 'Causa de eliminación')}</TableHeader></TableRow></TableHead>
                <TableBody>
                  {pendingUnits.map((unit) => (
                    <TableRow key={unit.id}>
                      <TableCell>{unit.id}</TableCell><TableCell>{unit.component}</TableCell><TableCell>{unit.bloodGroup}</TableCell>
                      <TableCell>
                        <Select id={`reason-${unit.id}`} labelText={t('eliminationReason', 'Causa de eliminación')} hideLabel value={causes[unit.id] ?? ''} invalid={formError && !causes[unit.id]} invalidText={t('requiredField', 'Campo obligatorio')} onChange={(event) => setCauses((current) => ({ ...current, [unit.id]: event.target.value }))}>
                          <SelectItem value="" text={t('selectReason', 'Seleccione una causa')} />
                          {eliminationReasons.map(([value, label]) => <SelectItem key={value} value={value} text={t(`eliminationReason_${value}`, label)} />)}
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <div className={styles.formGrid}>
            <TextInput id="waste-responsible" labelText={t('wasteResponsible', 'Responsable de eliminación de residuos')} value={wasteResponsible} onChange={(event) => setWasteResponsible(event.target.value)} invalid={formError && !wasteResponsible} invalidText={t('requiredField', 'Campo obligatorio')} />
            <TextArea className={styles.fullWidth} id="elimination-observations" labelText={t('eliminationObservations', 'Observaciones')} value={observations} onChange={(event) => setObservations(event.target.value)} />
          </div>
          <div className={styles.modalSection}>
            <h3>{t('responsibleSignatures', 'Firmas de responsables')}</h3>
            <div className={styles.formGrid}>
              <TextInput id="responsible-name" labelText={t('bloodBankResponsible', 'Responsable del Centro de Hemoterapia o Banco de Sangre')} value={responsibleName} onChange={(event) => setResponsibleName(event.target.value)} invalid={formError && !responsibleName} invalidText={t('requiredField', 'Campo obligatorio')} />
              <TextInput id="responsible-signature" labelText={t('digitalSignature', 'Firma digital del responsable')} value={responsibleSignature} onChange={(event) => setResponsibleSignature(event.target.value)} invalid={formError && !responsibleSignature} invalidText={t('requiredField', 'Campo obligatorio')} />
              <TextInput id="epidemiology-name" labelText={t('epidemiologyRepresentative', 'Representante de Epidemiología')} value={epidemiologyName} onChange={(event) => setEpidemiologyName(event.target.value)} invalid={formError && !epidemiologyName} invalidText={t('requiredField', 'Campo obligatorio')} />
              <TextInput id="epidemiology-signature" labelText={t('epidemiologySignature', 'Firma digital de Epidemiología')} value={epidemiologySignature} onChange={(event) => setEpidemiologySignature(event.target.value)} invalid={formError && !epidemiologySignature} invalidText={t('requiredField', 'Campo obligatorio')} />
            </div>
          </div>
          <div className={styles.modalChecks}>
            <Checkbox id="container-confirmed" checked={containerConfirmed} labelText={t('containerConfirmed', 'Las unidades están en recipientes cerrados y rotulados')} onChange={(_event, data) => setContainerConfirmed(Boolean(data.checked))} />
            <Checkbox id="reconciliation-confirmed" checked={reconciliationConfirmed} labelText={t('reconciliationConfirmed', 'Verifiqué que el recipiente contiene todas las unidades del acta')} onChange={(_event, data) => setReconciliationConfirmed(Boolean(data.checked))} />
          </div>
        </div>
      </Modal>}

      {actsOpen && <Modal open passiveModal size="lg" modalHeading={t('eliminationActsTitle', 'Actas de eliminación')} onRequestClose={() => setActsOpen(false)}>
        {eliminationActs.length === 0 ? <p className={styles.emptyTable}>{t('noEliminationActs', 'No hay actas generadas en este prototipo.')}</p> : (
          <TableContainer>
            <Table size="sm" useZebraStyles>
              <TableHead><TableRow><TableHeader>{t('eliminationActNumber', 'Número de acta')}</TableHeader><TableHeader>{t('eliminationActDate', 'Fecha')}</TableHeader><TableHeader>{t('unitsCount', 'Unidades')}</TableHeader><TableHeader>{t('status', 'Estado')}</TableHeader><TableHeader>{t('signatories', 'Firmantes')}</TableHeader></TableRow></TableHead>
              <TableBody>{eliminationActs.map((act) => <TableRow key={act.id}><TableCell>{act.id}</TableCell><TableCell>{act.date}</TableCell><TableCell>{act.units.join(', ')}</TableCell><TableCell><Tag type="green">{act.status}</Tag></TableCell><TableCell>{act.responsible} · {act.epidemiology}</TableCell></TableRow>)}</TableBody>
            </Table>
          </TableContainer>
        )}
      </Modal>}
    </div>
  );
}

export function Transfusion() {
  const { t } = useTranslation(moduleName);
  const [identityVerified, setIdentityVerified] = useState(false);
  const [compatibility, setCompatibility] = useState('pending');
  const [reserved, setReserved] = useState(false);
  const canReserve = identityVerified && compatibility === 'compatible';

  return (
    <div className={styles.pageStack}>
      <section className={styles.sectionCard}>
        <PageHeader
          eyebrow={t('requestId', 'Solicitud SOL-00641 · Emergencia')}
          title={t('transfusionTitle', 'Compatibilidad, reserva y entrega')}
          description={t('transfusionDescription', 'La reserva se habilita solo después de verificar identidad y compatibilidad.')}
        />
        <div className={styles.patientBanner}>
          <div><span>{t('recipient', 'Receptor')}</span><strong>Receptor 03</strong></div>
          <div><span>{t('medicalRecord', 'Historia clínica')}</span><strong>HCS-0000641</strong></div>
          <div><span>{t('location', 'Ubicación')}</span><strong>Emergencia · Cama 04</strong></div>
          <div><span>ABO/Rh</span><strong>O+</strong></div>
        </div>
        <div className={styles.formGrid}>
          <Checkbox
            id="identity-verified"
            checked={identityVerified}
            labelText={t('twoIdentifiersVerified', 'Verifiqué dos identificadores independientes del receptor')}
            onChange={(_event, data) => setIdentityVerified(Boolean(data.checked))}
          />
          <Select id="compatibility" labelText={t('compatibilityResult', 'Resultado de compatibilidad')} value={compatibility} onChange={(event) => setCompatibility(event.target.value)}>
            <SelectItem value="pending" text={t('pending', 'Pendiente')} />
            <SelectItem value="compatible" text={t('compatible', 'Compatible')} />
            <SelectItem value="incompatible" text={t('incompatible', 'Incompatible')} />
          </Select>
          <TextInput id="sample-id" labelText={t('sampleId', 'Identificador de muestra')} defaultValue="M-00641" />
          <TextInput id="unit-id" labelText={t('selectedUnit', 'Unidad seleccionada')} defaultValue="GR-01089-A" />
        </div>
        {compatibility === 'incompatible' && <InlineNotification hideCloseButton kind="error" lowContrast title={t('unitBlocked', 'Unidad bloqueada')} subtitle={t('incompatibleHelp', 'Una incompatibilidad impide reservar o entregar esta unidad.')} />}
        <div className={styles.formActions}>
          <Button kind="secondary">{t('recordChecks', 'Registrar cuatro verificaciones')}</Button>
          <Button disabled={!canReserve || reserved} onClick={() => setReserved(true)}>{reserved ? t('unitReserved', 'Unidad reservada') : t('reserveUnit', 'Reservar unidad')}</Button>
          <Button disabled={!reserved}>{t('prepareDelivery', 'Preparar entrega')}</Button>
        </div>
      </section>
    </div>
  );
}

export function Reactions() {
  const { t } = useTranslation(moduleName);
  const [reported, setReported] = useState(false);

  return (
    <div className={styles.pageStack}>
      <section className={styles.sectionCard}>
        <PageHeader
          eyebrow={t('hemovigilance', 'Hemovigilancia')}
          title={t('reactionTitle', 'Reacción adversa transfusional')}
          description={t('reactionDescription', 'Registro inicial vinculado al receptor, la transfusión y cada unidad implicada.')}
        />
        <InlineNotification hideCloseButton kind="warning" lowContrast title={t('immediateCare', 'Priorice la atención clínica inmediata')} subtitle={t('reactionWarning', 'Este formulario no sustituye la suspensión de la transfusión, la evaluación médica ni el protocolo institucional.')} />
        <div className={styles.formGrid}>
          <TextInput id="reaction-recipient" labelText={t('recipient', 'Receptor')} defaultValue="Receptor 03" />
          <TextInput id="reaction-unit" labelText={t('implicatedUnit', 'Unidad implicada')} defaultValue="GR-01089-A" />
          <Select id="reaction-type" labelText={t('reactionType', 'Tipo de reacción')} defaultValue="febrile">
            <SelectItem value="febrile" text={t('febrile', 'Febril')} />
            <SelectItem value="allergic" text={t('allergic', 'Alérgica')} />
            <SelectItem value="hemolytic" text={t('hemolytic', 'Hemolítica')} />
            <SelectItem value="other" text={t('other', 'Otra')} />
          </Select>
          <Select id="reaction-severity" labelText={t('severity', 'Severidad')} defaultValue="pending">
            <SelectItem value="pending" text={t('pendingClassification', 'Pendiente de clasificación')} />
            <SelectItem value="mild" text={t('mild', 'Leve')} />
            <SelectItem value="moderate" text={t('moderate', 'Moderada')} />
            <SelectItem value="severe" text={t('severe', 'Severa')} />
          </Select>
          <TextArea className={styles.fullWidth} id="reaction-actions" labelText={t('actionsTaken', 'Medidas adoptadas y tratamiento inicial')} />
          <TextArea className={styles.fullWidth} id="reaction-symptoms" labelText={t('symptomsAndVitals', 'Síntomas, signos vitales y evolución')} />
        </div>
        <div className={styles.formActions}>
          <Button onClick={() => setReported(true)}>{t('saveInitialReport', 'Guardar reporte inicial')}</Button>
        </div>
        {reported && <InlineNotification hideCloseButton kind="success" lowContrast title={t('reportRecorded', 'Reporte inicial registrado')} subtitle={t('followupPending', 'La evaluación médica, imputabilidad y seguimiento permanecen pendientes.')} />}
      </section>
    </div>
  );
}

export function Audit() {
  const { t } = useTranslation(moduleName);

  return (
    <div className={styles.pageStack}>
      <section className={styles.sectionCard}>
        <PageHeader
          eyebrow={t('endToEndTraceability', 'Trazabilidad de extremo a extremo')}
          title={t('auditTitle', 'Historial de eventos')}
          description={t('auditDescription', 'Vista cronológica de estados, responsables, motivos y referencias relacionadas.')}
        />
        <RecordList records={auditEvents} emptyLabel={t('noAuditEvents', 'No hay eventos registrados.')} />
      </section>
    </div>
  );
}
