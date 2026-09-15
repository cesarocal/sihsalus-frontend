import {
  Button,
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
  Tag,
  TextInput,
} from '@carbon/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { moduleName } from './constants';
import styles from './root.scss';

type FollowupMode = 'donor' | 'recipient';
type FollowupRow = [string, string, string, string, string];

interface FollowupCase {
  id: string;
  date: string;
  person: string;
  document: string;
  screening: string;
  result: string;
  status: string;
  units: FollowupRow[];
  priorInstitution: string;
  otherInstitution: string;
  notes: string;
}

const donorInitialCases: FollowupCase[] = [
  { id: 'SEG-DON-0001', date: '08/09/2026', person: 'Receptor sintético 03', document: 'HCS-0000641', screening: 'HBsAg', result: 'Reactivo', status: 'En confirmación', units: [['08/09/2026', 'GR-01089-A', 'Glóbulos rojos', 'Donante sintético 02', '12/05/2026'], ['08/09/2026', 'PFC-01082-B', 'Plasma fresco congelado', 'Donante sintético 04', '21/07/2026']], priorInstitution: 'Sí', otherInstitution: 'No', notes: 'Se informó al responsable del Banco de Sangre.' },
];

const recipientInitialCases: FollowupCase[] = [
  { id: 'SEG-REC-0001', date: '08/09/2026', person: 'Donante sintético 02', document: 'DON-01092', screening: 'Anti-HCV', result: 'Dudoso', status: 'Receptores identificados', units: [['12/05/2026', 'GR-00618-A', 'Glóbulos rojos', 'Receptor sintético 03', '12/05/2026'], ['21/07/2026', 'PFC-00874-B', 'Plasma fresco congelado', 'Receptor sintético 05', '21/07/2026']], priorInstitution: 'Sí', otherInstitution: 'No', notes: 'Se identificaron receptores vinculados por lote.' },
];

function FollowupHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  const { t } = useTranslation(moduleName);
  return <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>{eyebrow}</p><h2>{title}</h2><p className={styles.muted}>{description}</p></div><Tag type="cyan">{t('syntheticDataLabel', 'Datos sintéticos')}</Tag></div>;
}

function CaseHistory({ mode, cases, onSelect, onNew }: { mode: FollowupMode; cases: FollowupCase[]; onSelect: (id: string) => void; onNew: () => void }) {
  const { t } = useTranslation(moduleName);
  return <section className={styles.sectionCard}>
    <div className={styles.tableActionBar}><div><h3>{t('followupHistory', 'Historial de casos')}</h3><p className={styles.muted}>{t('followupHistoryHelp', 'Consulte casos registrados y abra su detalle para continuar el seguimiento.')}</p></div><Button onClick={onNew}>{t('newFollowupCase', 'Registrar nuevo caso')}</Button></div>
    <TableContainer className={styles.inventoryTable}><Table size="sm" useZebraStyles><TableHead><TableRow>{['caseNumber', 'followupDate', mode === 'donor' ? 'recipientName' : 'donorName', 'screeningResult', 'status', 'actions'].map((key) => <TableHeader key={key}>{t(key, key)}</TableHeader>)}</TableRow></TableHead><TableBody>{cases.map((item) => <TableRow key={item.id}><TableCell><strong>{item.id}</strong></TableCell><TableCell>{item.date}</TableCell><TableCell>{item.person}</TableCell><TableCell>{item.result}</TableCell><TableCell><Tag type={item.status === 'Cerrado' ? 'green' : 'blue'}>{item.status}</Tag></TableCell><TableCell><Button kind="ghost" size="sm" onClick={() => onSelect(item.id)}>{t('viewCaseDetail', 'Ver detalle')}</Button></TableCell></TableRow>)}</TableBody></Table></TableContainer>
  </section>;
}

function CaseDetail({ mode, item, stage, result, onResult, onStage }: { mode: FollowupMode; item: FollowupCase; stage: string; result: string; onResult: (value: string) => void; onStage: (value: string) => void }) {
  const { t } = useTranslation(moduleName);
  const headers = mode === 'donor' ? ['transfusionDate', 'unitCode', 'bloodComponent', 'donorName', 'donationDate'] : ['donationDate', 'unitCode', 'bloodComponent', 'recipientName', 'transfusionDate'];
  return <section className={styles.sectionCard}>
    <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>{item.id}</p><h3>{t('caseDetail', 'Detalle del caso')}</h3><p className={styles.muted}>{item.notes}</p></div><Tag type="blue">{item.status}</Tag></div>
    <div className={styles.reviewGrid}><div><span>{t('followupDate', 'Fecha')}</span><strong>{item.date}</strong></div><div><span>{mode === 'donor' ? t('recipientName', 'Receptor') : t('donorName', 'Donante')}</span><strong>{item.person}</strong></div><div><span>{t('healthRecord', 'N.° H.C.')}</span><strong>{item.document}</strong></div><div><span>{t('reactiveScreening', 'Prueba de tamizaje')}</span><strong>{item.screening}</strong></div></div>
    <h3>{t(mode === 'donor' ? 'transfusedUnits' : 'donatedUnits', mode === 'donor' ? 'Unidades transfundidas y donantes relacionados' : 'Unidades y componentes relacionados')}</h3>
    <TableContainer className={styles.inventoryTable}><Table size="sm" useZebraStyles><TableHead><TableRow>{headers.map((key) => <TableHeader key={key}>{t(key, key)}</TableHeader>)}</TableRow></TableHead><TableBody>{item.units.map((row) => <TableRow key={`${item.id}-${row[1]}`}>{row.map((cell) => <TableCell key={`${row[1]}-${cell}`}>{cell}</TableCell>)}</TableRow>)}</TableBody></Table></TableContainer>
    {mode === 'recipient' && <TableContainer className={styles.inventoryTable}><Table size="sm" useZebraStyles><TableHead><TableRow><TableHeader>{t('recipientName', 'Nombre del receptor')}</TableHeader><TableHeader>{t('priorInstitutionTransfusions', 'Transfusiones previas en la institución')}</TableHeader><TableHeader>{t('otherInstitutionTransfusions', 'Transfusiones previas en otras instituciones')}</TableHeader></TableRow></TableHead><TableBody><TableRow><TableCell>{item.units[0][3]}</TableCell><TableCell>{item.priorInstitution}</TableCell><TableCell>{item.otherInstitution}</TableCell></TableRow></TableBody></Table></TableContainer>}
    <div className={styles.formGrid}><Select id={`${item.id}-result`} labelText={t('screeningResult', 'Resultado de tamizaje')} value={result} onChange={(event) => onResult(event.target.value)}><SelectItem value="pending" text={t('pending', 'Pendiente')} /><SelectItem value="non-reactive" text={t('nonReactive', 'No reactivo')} /><SelectItem value="reactive" text={t('reactive', 'Reactivo')} /><SelectItem value="doubtful" text={t('doubtful', 'Dudoso')} /></Select><TextInput id={`${item.id}-second-test`} labelText={t('secondTest', 'Segunda prueba confirmatoria')} defaultValue="Pendiente de confirmar" /><TextInput id={`${item.id}-responsible`} labelText={t('responsible', 'Responsable')} defaultValue={mode === 'donor' ? 'Tecnólogo sintético' : 'Médico tratante sintético'} /></div>
    {(result === 'reactive' || result === 'doubtful') && <InlineNotification hideCloseButton lowContrast kind="warning" title={t('confirmResult', 'Requiere confirmación')} subtitle={t(mode === 'donor' ? 'confirmResultHelp' : 'recipientAlertHelp', mode === 'donor' ? 'El flujo solicita una segunda prueba antes de comunicar el resultado definitivo.' : 'Identifique los receptores vinculados por lote, confirme el resultado y notifique al equipo tratante.')} />}
    <div className={styles.formActions}><Button kind="secondary" onClick={() => onStage(mode === 'donor' ? 'sample' : 'notified')}>{t(mode === 'donor' ? 'registerSample' : 'notifyRecipients', mode === 'donor' ? 'Registrar muestra' : 'Registrar notificación')}</Button><Button kind="secondary" onClick={() => onStage('testing')}>{t('registerTest', 'Registrar pruebas')}</Button><Button onClick={() => onStage('informed')}>{t('closeFollowup', 'Informar y cerrar seguimiento')}</Button><Tag type="blue">{t(`followupStage_${stage}`, stage)}</Tag></div>
  </section>;
}

function NewCaseModal({ mode, onClose, onSave }: { mode: FollowupMode; onClose: () => void; onSave: (item: FollowupCase) => void }) {
  const { t } = useTranslation(moduleName);
  const [person, setPerson] = useState(mode === 'donor' ? 'Receptor sintético nuevo' : 'Donante sintético nuevo');
  const [unit, setUnit] = useState(mode === 'donor' ? 'GR-NUEVA-A' : 'GR-NUEVA-B');
  const [component, setComponent] = useState('Glóbulos rojos');
  const [screening, setScreening] = useState(mode === 'donor' ? 'HBsAg' : 'Anti-HCV');
  const [date, setDate] = useState('2026-09-08');
  const [counterpart, setCounterpart] = useState(mode === 'donor' ? 'Donante sintético nuevo' : 'Receptor sintético nuevo');
  const save = () => {
    const id = `SEG-${mode === 'donor' ? 'DON' : 'REC'}-${Date.now().toString().slice(-4)}`;
    const row: FollowupRow = mode === 'donor' ? [date, unit, component, counterpart, '2026-08-20'] : ['2026-08-20', unit, component, counterpart, date];
    onSave({ id, date: date.split('-').reverse().join('/'), person, document: mode === 'donor' ? 'HCS-NUEVA' : 'DON-NUEVO', screening, result: 'Pendiente', status: 'Abierto', units: [row], priorInstitution: 'No', otherInstitution: 'No', notes: t('newCaseCreated', 'Caso nuevo registrado con su relación automática de unidades.') });
  };
  return <Modal open size="lg" modalHeading={t('newFollowupCase', 'Registrar nuevo caso')} primaryButtonText={t('saveCase', 'Guardar caso')} secondaryButtonText={t('cancel', 'Cancelar')} onRequestClose={onClose} onRequestSubmit={save}><div className={styles.formGrid}><TextInput id="new-case-date" type="date" labelText={t('followupDate', 'Fecha')} value={date} onChange={(event) => setDate(event.target.value)} /><TextInput id="new-case-person" labelText={t(mode === 'donor' ? 'recipientNames' : 'donorNames', mode === 'donor' ? 'Apellidos y nombres del receptor' : 'Apellidos y nombres del donante')} value={person} onChange={(event) => setPerson(event.target.value)} /><TextInput id="new-case-screening" labelText={t('reactiveScreening', 'Prueba de tamizaje reactiva')} value={screening} onChange={(event) => setScreening(event.target.value)} /><TextInput id="new-case-unit" labelText={t('unitCode', 'Código de unidad')} value={unit} onChange={(event) => setUnit(event.target.value)} /><TextInput id="new-case-component" labelText={t('bloodComponent', 'Hemocomponente')} value={component} onChange={(event) => setComponent(event.target.value)} /><TextInput id="new-case-counterpart" labelText={t(mode === 'donor' ? 'donorName' : 'recipientName', mode === 'donor' ? 'Nombre del donante' : 'Nombre del receptor')} value={counterpart} onChange={(event) => setCounterpart(event.target.value)} /></div><InlineNotification hideCloseButton lowContrast kind="info" title={t('autoReportTitle', 'Informe automático')} subtitle={t('autoReportHelp', 'Al guardar, la unidad y la persona relacionada se agregarán automáticamente al informe correspondiente.')} /></Modal>;
}

function FollowupPage({ mode }: { mode: FollowupMode }) {
  const { t } = useTranslation(moduleName);
  const [cases, setCases] = useState<FollowupCase[]>(mode === 'donor' ? donorInitialCases : recipientInitialCases);
  const [selectedId, setSelectedId] = useState(cases[0].id);
  const [newCaseOpen, setNewCaseOpen] = useState(false);
  const [stage, setStage] = useState('identified');
  const [result, setResult] = useState(mode === 'donor' ? 'reactive' : 'doubtful');
  const selected = cases.find((item) => item.id === selectedId) ?? cases[0];
  const saveCase = (item: FollowupCase) => { setCases((current) => [item, ...current]); setSelectedId(item.id); setNewCaseOpen(false); setStage('identified'); setResult('pending'); };
  return <div className={styles.pageStack}><section className={styles.sectionCard}><FollowupHeader eyebrow={mode === 'donor' ? 'EG05-PC15 · EG05-FR13' : 'EG05-PC16 · EG05-FR14'} title={t(mode === 'donor' ? 'donorFollowupTitle' : 'recipientFollowupTitle', mode === 'donor' ? 'Seguimiento al donante' : 'Seguimiento al receptor')} description={t(mode === 'donor' ? 'donorFollowupDescription' : 'recipientFollowupDescription', mode === 'donor' ? 'Identifique donantes relacionados con una transfusión y registre el seguimiento serológico.' : 'Relacione donantes, unidades y receptores para realizar el tamizaje y seguimiento posterior.')} /></section><CaseHistory mode={mode} cases={cases} onSelect={(id) => { setSelectedId(id); setStage('identified'); }} onNew={() => setNewCaseOpen(true)} /><CaseDetail mode={mode} item={selected} stage={stage} result={result} onResult={setResult} onStage={setStage} />{newCaseOpen && <NewCaseModal mode={mode} onClose={() => setNewCaseOpen(false)} onSave={saveCase} />}</div>;
}

export function DonorFollowup() { return <FollowupPage mode="donor" />; }
export function RecipientFollowup() { return <FollowupPage mode="recipient" />; }
