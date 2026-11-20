import type { ReactNode } from 'react';
import type { ProcessingTranslate } from '../../shared/processing-page.component';
import hospitalLogo from '../collection/hospital-santa-clotilde.png';
import pangoLogo from '../collection/pango.png';
import { componentDefinitions } from '../laboratory/fractionation/fractionation-rules';
import { transfusionBloodGroupLabel } from '../transfusions/transfusion-blood-group';
import {
  antecedentKeys,
  conditions,
  conductionSigns,
  type Fields,
  findings,
  reactionSigns,
  reactionVitalKeys,
  studies,
  type UnitCase,
  vitalKeys,
} from './hemovigilance';

export const hemovigilancePrintCss = `
@page { size:A4 portrait; margin:8mm 8mm; }
* { box-sizing:border-box; }
body { margin:0; color:#111; font:9pt/1.19 Arial,sans-serif; }
article { margin:auto; max-width:193mm; }
h1 { font-size:13pt; margin:0; }
h2 { margin:2mm 0 .7mm; font-size:9pt; }
h3 { margin:0; font-size:9pt; }
p { margin:.65mm 0; }
small { font-size:7.5pt; }
table { border-collapse:collapse; width:100%; table-layout:fixed; }
th,td { border:.6pt solid; text-align:left; padding:.65mm 1.2mm; height:4.5mm; overflow-wrap:anywhere; }
thead th { font-size:8pt; }
tr, section, header { break-inside:avoid; }
.letterhead { display:grid; grid-template-columns:27mm 1fr 27mm; align-items:center; text-align:center; font-size:8pt; margin-bottom:3mm; }
.letterhead img { max-width:25mm; max-height:23mm; margin:auto; }
.titleRow { display:flex; justify-content:space-between; align-items:end; gap:3mm; margin-bottom:1mm; }
.titleRow h1 { font-size:11pt; }
.sheetDate { border:.7pt solid; padding:1mm 5mm; }
.frame { border:.8pt solid; padding:1mm 1.5mm; }
.frame ol { margin:.7mm 0; padding-left:4mm; font-size:7.8pt; }
.line { display:flex; gap:3mm; flex-wrap:wrap; }
.field { display:inline-flex; flex:1 1 27mm; align-items:baseline; gap:1mm; margin:.8mm 0; min-width:0; }
.value { flex:1 1 auto; min-width:7mm; min-height:3mm; border-bottom:.55pt solid; overflow-wrap:anywhere; }
.checks { display:grid; gap:.7mm 2mm; margin:1mm 0; align-items:start; }
.square { display:inline-block; width:2.85mm; height:2.85mm; line-height:2.6mm; text-align:center; vertical-align:-.4mm; border:.7pt solid; margin-right:1.05mm; }
.recommendations { min-height:34mm; white-space:pre-wrap; overflow-wrap:anywhere; }
.signatures { margin-top:6mm; }
.conduction th, .conduction td { font-size:8.5pt; height:4.15mm; padding:.55mm 1mm; }
.conduction .signatures { margin-top:4mm; }
.conduction .monitorLabel { width:23%; }
.conduction .letterhead img { max-height:22mm; }
.footReference { font-size:7pt; margin-top:1mm; }
`;

function DateText({ value }: { value?: string }) {
  const parts = value?.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return parts ? (
    <>
      {parts[3]}/{parts[2]}/{parts[1]}
    </>
  ) : null;
}
function TimeText({ value }: { value?: string }) {
  if (!value) return <>____ : ____ AM/PM</>;
  const [hours, minutes] = value.split(':');
  const hour = Number(hours);
  return (
    <>
      {String(hour % 12 || 12).padStart(2, '0')}:{minutes} {hour < 12 ? 'AM' : 'PM'}
    </>
  );
}

const Line = ({ children }: { children: ReactNode }) => <div className="line">{children}</div>;
const Field = ({ label, children }: { label: string; children?: ReactNode }) => (
  <span className="field">
    <span>{label}</span>
    <span className="value">{children}</span>
  </span>
);
const Box = ({ checked, label }: { checked: boolean; label: string }) => (
  <span>
    <span className="square">{checked ? '×' : ''}</span>
    {label}
  </span>
);
function CheckGrid({
  keys,
  fields,
  columns,
  t,
}: {
  keys: string[];
  fields: Fields;
  columns: number;
  t: ProcessingTranslate;
}) {
  return (
    <div className="checks" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {keys.map((key) => (
        <Box key={key} checked={fields[key] === 'yes'} label={t(key)} />
      ))}
    </div>
  );
}

export function ConductionPrint({ unit, t }: { unit: UnitCase; t: ProcessingTranslate }) {
  const { dispatch, order, sections } = unit;
  const fields = sections.conduction?.fields ?? {};
  const histories = ['date', 'units', 'component', 'priorReaction', 'place', 'notes'];
  const component = {
    ST: 'wholeBlood',
    PG: 'redCells',
    PFC: 'freshFrozenPlasma',
    PLAQ: 'platelets',
    CRIOP: 'cryoprecipitate',
    GRL: 'washedRedCells',
  };
  return (
    <article className="conduction">
      <header className="letterhead">
        <img src={hospitalLogo} alt="Hospital Santa Clotilde" />
        <div>
          <strong>
            HOSPITAL II-1 SANTA CLOTILDE
            <br />
            “NERI RIVADENEYRA RAMOS”
          </strong>
          <div>Río Napo, Maynas, Loreto, Perú</div>
          <strong>COOPERACIÓN AL SERVICIO DE LA COMUNIDAD</strong>
          <br />
          <small>
            Ministerio de Salud / Vicariato Apostólico de San José del Amazonas / Asociación Civil Pango
            <br />
            APARTADO 216 – IQUITOS – PERÚ
          </small>
        </div>
        <img src={pangoLogo} alt="Pango" />
      </header>
      <div className="titleRow">
        <h1>HOJA DE CONDUCCIÓN DE TRANSFUSIONES</h1>
        <div>
          <strong>CENTRO DE HEMOTERAPIA TIPO I</strong>
          <div className="sheetDate">
            Fecha <DateText value={fields.conductionDate} />
          </div>
        </div>
      </div>
      <table>
        <tbody>
          <tr>
            <td colSpan={3}>NOMBRE&nbsp; {order.patientName}</td>
            <td>DIAGNÓSTICO&nbsp; {order.diagnosis}</td>
          </tr>
          <tr>
            <td>N.º de LOTE&nbsp; {dispatch.lot}</td>
            <td colSpan={3}>
              Componente&nbsp;{' '}
              {Object.entries(component).map(([label, code]) => (
                <span key={code} style={{ marginRight: '2mm' }}>
                  <Box checked={dispatch.component === code} label={label} />
                </span>
              ))}
              {!Object.values(component).includes(dispatch.component) &&
                t(componentDefinitions[dispatch.component].key)}
            </td>
          </tr>
          <tr>
            <td>Edad&nbsp; {order.age}</td>
            <td>
              Peso&nbsp; {fields.weight} &nbsp; Talla&nbsp; {fields.height}
            </td>
            <td>
              Sexo&nbsp; <Box checked={order.sex === 'M'} label="M" /> <Box checked={order.sex === 'F'} label="F" />
            </td>
            <td>GRUPO SANGUÍNEO&nbsp; {transfusionBloodGroupLabel(order.bloodGroup, t)}</td>
          </tr>
        </tbody>
      </table>
      <section>
        <h2>ANTECEDENTES</h2>
        <CheckGrid keys={antecedentKeys} fields={fields} columns={4} t={t} />
      </section>
      <section>
        <h2>TRANSFUSIONES PREVIAS</h2>
        <table>
          <thead>
            <tr>
              {histories.map((key) => (
                <th key={key}>{t(key).toUpperCase()}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[0, 1, 2, 3, 4].map((row) => (
              <tr key={row}>
                {histories.map((key) => (
                  <td key={key}>
                    {key === 'date' ? (
                      <DateText value={fields[`history${row}${key}`]} />
                    ) : (
                      fields[`history${row}${key}`]
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section>
        <h2>CONDUCCIÓN DE LA TRANSFUSIÓN</h2>
        <table>
          <colgroup>
            <col className="monitorLabel" />
            <col span={5} />
          </colgroup>
          <tbody>
            <tr>
              <td colSpan={3}>Hora de inicio&nbsp; {fields.startTime}</td>
              <td colSpan={3}>Hora de término&nbsp; {fields.endTime}</td>
            </tr>
            <tr>
              <th scope="row">Parámetro / hora</th>
              {[0, 1, 2, 3, 4].map((col) => (
                <td key={col}>{fields[`time${col}`]}</td>
              ))}
            </tr>
            {vitalKeys.map((key) => (
              <tr key={key}>
                <th scope="row">{t(key)}</th>
                {[0, 1, 2, 3, 4].map((col) => (
                  <td key={col}>{fields[key + col]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section>
        <h2>DETERMINABLE EN SALA DE OPERACIONES</h2>
        <table>
          <thead>
            <tr>
              <th>ESTADOS CLÍNICOS</th>
              {[1, 2, 3].map((col) => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {['consciousness', 'cardiovascular', 'pulmonary'].map((key) => (
              <tr key={key}>
                <th scope="row">{t(key)}</th>
                {[1, 2, 3].map((col) => (
                  <td key={col}>{fields[key + col]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <small>
          (1) Consciente &nbsp; · &nbsp; (2) Somnoliento o desorientado &nbsp; · &nbsp; (3) Coma
          <br />
          (1) Normal &nbsp; · &nbsp; (2) Infarto de miocardio, HTA, valvulopatía, angina
          <br />
          (1) Normal &nbsp; · &nbsp; (2) Enfermedad parenquimal pulmonar, asma, EPOC
        </small>
      </section>
      <section>
        <h2>REACCIONES ADVERSAS</h2>
        <CheckGrid keys={conductionSigns} fields={fields} columns={4} t={t} />
        {fields.otherSymptom === 'yes' && <Field label={t('otherSymptom')}>{fields.otherSymptomText}</Field>}
      </section>
      <table className="signatures">
        <tbody>
          <tr style={{ height: '11mm' }}>
            <td>{fields.responsiblePhysician}</td>
            <td />
            <td>{fields.physicianRegistration}</td>
          </tr>
          <tr>
            <th>MÉDICO RESPONSABLE</th>
            <th>FIRMA</th>
            <th>CMP</th>
          </tr>
          <tr>
            <td>HC&nbsp; {order.historyNumber}</td>
            <td>SALA&nbsp; {order.ward}</td>
            <td>CAMA N.º&nbsp; {order.bed}</td>
          </tr>
        </tbody>
      </table>
      <p className="footReference">
        FR08 {order.number} · Unidad {dispatch.unitCode}
      </p>
    </article>
  );
}

const fr02Components: [string, string[]][] = [
  ['Glóbulos Rojos', ['redCells', 'lowVolumeRedCells']],
  ['Glóbulos Rojos Lavados', ['washedRedCells']],
  ['Plasma Fresco Congelado', ['freshFrozenPlasma']],
  ['Plasma Residual', ['cryoReducedPlasma']],
  ['Crioprecipitado', ['cryoprecipitate']],
  ['Concentrado de Plaquetas', ['platelets']],
  ['Plaquetas de Aféresis', ['apheresisPlatelets']],
  ['Glóbulos Rojos Desleucocitados', ['leukoreducedRedCells']],
];

export function Fr02Print({ unit, t }: { unit: UnitCase; t: ProcessingTranslate }) {
  const { dispatch, order, sections } = unit;
  const report = sections.report?.fields ?? {};
  const bank = sections.investigation?.fields ?? {};
  const other = !fr02Components.some(([, codes]) => codes.includes(dispatch.component));
  const review = sections.review?.actor;
  const investigator = sections.investigation?.actor;
  return (
    <article>
      <div className="titleRow">
        <h1>EG07 - FR02: REPORTE DE REACCIÓN ADVERSA TRANSFUSIONAL</h1>
        <small>(Hoja 1 de 1)</small>
      </div>
      <section className="frame">
        <h3>INDICACIONES GENERALES</h3>
        <ol>
          <li>Suspender la transfusión. Notifique de inmediato al médico tratante.</li>
          <li>
            Verificar la identidad del paciente y su concordancia con la Hoja de conducción y datos de la unidad de
            sangre o componente. Verificar el número de la unidad de sangre o componente.
          </li>
          <li>Completar el formato de Investigación de Reacciones Transfusionales.</li>
          <li>El formato DEBERÁ SER FIRMADO POR EL MÉDICO QUE ATIENDE LA REACCIÓN TRANSFUSIONAL.</li>
          <li>
            Comunicar al Banco de Sangre la aparición de la reacción transfusional. Devolver la unidad de sangre o
            componente al Banco de Sangre, sin retirar el equipo de transfusión, acompañada de la copia del formato de
            Investigación de Reacciones Transfusionales.
          </li>
          <li>
            Colectar la primera orina que emita el paciente. Enviar la muestra al laboratorio para su análisis, con el
            rótulo de “Reacción Transfusional”.
          </li>
        </ol>
      </section>
      <section>
        <h2>
          Para ser llenado por enfermería. Debe ser revisado y firmado por el médico que atiende la reacción
          transfusional.
        </h2>
        <Line>
          <Field label="Nombre del paciente">{order.patientName}</Field>
        </Line>
        <Line>
          <Field label="HC N.º">{order.historyNumber}</Field>
          <Field label="Servicio">{order.service}</Field>
          <Field label="Cama N.º">{order.bed}</Field>
        </Line>
        <Line>
          <Field label="I. N.º Unidad o Componente">{dispatch.unitCode}</Field>
        </Line>
        Componente
        <div className="checks" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {fr02Components.map(([label, codes]) => (
            <Box key={label} checked={codes.includes(dispatch.component)} label={label} />
          ))}
          <Box checked={other} label={other ? `Otros: ${t(componentDefinitions[dispatch.component].key)}` : 'Otros'} />
        </div>
        <Line>
          <Field label="Cantidad transfundida">{report.transfused && `${report.transfused} mL`}</Field>
        </Line>
        <Line>
          <Field label="Premedicación previa a transfusión">{report.premedication}</Field>
        </Line>
        <Line>
          <Field label="Hora de inicio de transfusión">
            <TimeText value={report.startTime} />
          </Field>
          <Field label="Hora de suspensión de transfusión">
            <TimeText value={report.stopTime} />
          </Field>
        </Line>
        <Line>
          <Field label="Hora de notificación al médico">
            <TimeText value={report.doctorNotified} />
          </Field>
          <Field label="Hora de notificación al Banco de Sangre">
            <TimeText value={report.bankNotified} />
          </Field>
        </Line>
        <Line>
          <Field label="Hora de recolección de la orina">
            <TimeText value={report.urineTime} />
          </Field>
        </Line>
        <p>Cambios en signos vitales y síntomas clínicos (verificar el ítem adecuado)</p>
        {[0, 2].map((row) => (
          <Line key={row}>
            {reactionVitalKeys.slice(row, row + 2).map((key) => (
              <Field
                key={key}
                label={key === 'temperature' ? 'Fiebre (T°)' : t(key)}
              >{`Pre: ${report[key + 'Before'] || '________'}   Post: ${report[key + 'After'] || '________'}`}</Field>
            ))}
          </Line>
        ))}
        <CheckGrid keys={reactionSigns} fields={report} columns={5} t={t} />
        {report.otherSymptom === 'yes' && <p>{report.otherSymptomText}</p>}
        <p>Paciente se encuentra en</p>
        <CheckGrid keys={conditions} fields={report} columns={5} t={t} />
        <Line>
          <Field label="Firma y CEP de Enfermera">
            {[sections.report?.actor.name, sections.report?.actor.license].filter(Boolean).join(' · ')}
          </Field>
          <Field label="Firma, Sello y CMP del Médico">
            {[review?.name, review?.license].filter(Boolean).join(' · ')}
          </Field>
        </Line>
      </section>
      <section>
        <h2>Para ser llenado por el médico del Banco de Sangre o Servicio de Medicina Transfusional</h2>
        <p>II. Se notificará al Servicio de Medicina Transfusional o Banco de Sangre en las siguientes situaciones</p>
        <p>
          · Errores clericales o técnicos que provoquen reacciones transfusionales.
          <br />· Hemólisis o Test de Coombs Directo positivo en la muestra postransfusional.
        </p>
        <Line>
          <Field label="Notificación">{bank.notification}</Field>
          <Field label="Fecha">
            <DateText value={bank.notificationDate} />
          </Field>
          <Field label="Hora">
            <TimeText value={bank.notificationTime} />
          </Field>
        </Line>
        <h3>III. Estudios de Laboratorio Adicionales</h3>
        <CheckGrid keys={studies} fields={bank} columns={2} t={t} />
        {bank.otherStudy === 'yes' && <p>{bank.otherStudyText}</p>}
        <h3>RESUMEN</h3>
        <CheckGrid keys={findings} fields={bank} columns={4} t={t} />
        {bank.otherFinding === 'yes' && <p>{bank.otherFindingText}</p>}
        <div className="frame">
          <p>Reporte y Recomendaciones del Médico del Servicio de Medicina Transfusional o Banco de Sangre</p>
          <p className="recommendations">{bank.recommendations}</p>
          <Line>
            <Field label="Fecha">
              <DateText value={sections.investigation?.at} />
            </Field>
            <Field label="Hora">
              {sections.investigation &&
                new Date(sections.investigation.at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
            </Field>
            <Field label="Firma, CMP y Sello">
              {[investigator?.name, investigator?.license].filter(Boolean).join(' · ')}
            </Field>
          </Line>
        </div>
      </section>
      <div>Original: Historia Clínica &nbsp; · &nbsp; Copia: Servicio de Medicina Transfusional</div>
      <p className="footReference">FR08 {order.number}</p>
    </article>
  );
}
