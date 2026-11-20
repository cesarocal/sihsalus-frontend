import { Button, Checkbox, Select, SelectItem, TextArea, TextInput } from '@carbon/react';
import { Add } from '@carbon/react/icons';
import { type ReactNode, useId } from 'react';
import { formatListDate } from '../../shared/format-list-date';
import type { ProcessingTranslate } from '../../shared/processing-page.component';
import { componentDefinitions, componentTypes } from '../laboratory/fractionation/fractionation-rules';
import { transfusionBloodGroupLabel } from '../transfusions/transfusion-blood-group';
import {
  antecedentKeys,
  type Actor,
  conditions,
  conductionCode,
  conductionSignKeys,
  type Fields,
  findings,
  manualHistoryRows,
  maxMonitoringColumns,
  monitoringColumns,
  operatingRoomOptions,
  priorConductionValues,
  priorTransfusionKeys,
  reactionPressureKeys,
  reactionSigns,
  reactionVitalKeys,
  reactionVitalLabel,
  reportTimes,
  type Stage,
  studies,
  type UnitCase,
  vitalKeys,
} from './hemovigilance';
import styles from './hemovigilance.scss';
import { PremedicationPicker } from './premedication-picker.component';

function Readout({ label, value, className = '' }: { label: string; value?: string; className?: string }) {
  return (
    <div className={`${styles.readout} ${className}`.trim()}>
      <dt>{label}</dt>
      <dd>{value || '—'}</dd>
    </div>
  );
}

function SheetSection({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  const headingId = useId();
  return (
    <section className={styles.sheetCard} aria-labelledby={headingId}>
      <header className={styles.cardHeader}>
        <h3 id={headingId}>{title}</h3>
        {action}
      </header>
      {children}
    </section>
  );
}

export function CaseFields({ unit, t }: { unit: UnitCase; t: ProcessingTranslate }) {
  const { order, dispatch } = unit;
  const values = {
    patientName: order.patientName,
    historyNumber: order.historyNumber,
    fr08: order.number,
    requestingDoctor: order.orderer,
    service: order.service,
    ward: order.ward,
    bed: order.bed,
    unitCode: dispatch.unitCode,
    component: t(componentDefinitions[dispatch.component].key),
    dispatchDate: formatListDate(dispatch.deliveredAt),
    bloodGroup: transfusionBloodGroupLabel(order.bloodGroup, t),
    unitBloodGroup: transfusionBloodGroupLabel(dispatch.bloodGroup, t),
    diagnosis: order.diagnosis,
    lot: dispatch.lot,
    age: order.age,
    sex: t(order.sex === 'F' ? 'female' : 'male'),
  };
  return (
    <dl className={styles.caseFields}>
      {Object.entries(values).map(([key, value]) => (
        <div key={key}>
          <dt>{t(key)}</dt>
          <dd>{value || '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

export function HemovigilanceFields({
  stage,
  fields,
  setFields,
  readOnly,
  hideBankNotification = false,
  nurse,
  reviewer,
  unit,
  history = [],
  t,
}: {
  stage: Stage;
  fields: Fields;
  setFields: (fields: Fields) => void;
  readOnly: boolean;
  hideBankNotification?: boolean;
  nurse?: Actor;
  reviewer?: Actor;
  unit: UnitCase;
  history?: UnitCase[];
  t: ProcessingTranslate;
}) {
  const change = (key: string, value: string) => setFields({ ...fields, [key]: value });
  const input = (key: string, type = 'text', accessibleName = t(key), labelText: ReactNode = accessibleName) => (
    <TextInput
      key={key}
      id={`hemo-${stage}-${key}`}
      labelText={labelText}
      aria-label={accessibleName}
      type={type}
      min={type === 'number' ? '0' : undefined}
      step={type === 'number' ? 'any' : undefined}
      maxLength={500}
      value={fields[key] ?? ''}
      readOnly={readOnly || (stage === 'report' && reportTimes.includes(key) && key !== 'urineTime')}
      onChange={(event) => change(key, event.target.value)}
    />
  );
  const readout = (key: string, value?: string, className?: string) => (
    <Readout label={t(key)} value={value} className={className} />
  );
  const notes = (key: string) => (
    <TextArea
      id={`hemo-${stage}-${key}`}
      labelText={t(key)}
      value={fields[key] ?? ''}
      rows={3}
      maxLength={500}
      readOnly={readOnly}
      onChange={(event) => change(key, event.target.value)}
    />
  );
  const checklist = (title: string, keys: string[], detailsKey?: string, detailsTrigger = 'otherSymptom') => {
    const content = (
      <>
        <div className={styles.checks}>
          {keys.map((key) =>
            readOnly ? (
              <span key={key}>
                {fields[key] === 'yes' ? '☒' : '☐'} {t(key)}
              </span>
            ) : (
              <Checkbox
                key={key}
                id={`hemo-${stage}-${key}`}
                labelText={t(key)}
                checked={fields[key] === 'yes'}
                onChange={(_, { checked }) => change(key, checked ? 'yes' : '')}
              />
            ),
          )}
        </div>
        {detailsKey && fields[detailsTrigger] === 'yes' && input(detailsKey)}
      </>
    );
    return stage === 'conduction' || stage === 'report' ? (
      <SheetSection title={t(title)}>{content}</SheetSection>
    ) : (
      <fieldset className={styles.block}>
        <legend>{t(title)}</legend>
        {content}
      </fieldset>
    );
  };

  if (stage === 'conduction') {
    const { order, dispatch } = unit;
    const manualRows = manualHistoryRows(fields);
    const columns = monitoringColumns(fields);
    const lastColumn = columns.length - 1;
    const canRemoveColumn = lastColumn > 0 && !['time', ...vitalKeys].some((key) => fields[key + lastColumn]);
    const dateLabel = (value: string) => value.split('-').reverse().join('/');
    const cellInput = (key: string, label: string, type = 'text', min?: string, placeholder = '—') => (
      <input
        className={styles.cellInput}
        type={type}
        aria-label={label}
        min={min}
        placeholder={type === 'text' && !readOnly ? placeholder : undefined}
        maxLength={500}
        readOnly={readOnly}
        value={fields[key] ?? ''}
        onChange={(event) => change(key, event.target.value)}
      />
    );
    return (
      <div className={styles.conductionLayout}>
        <SheetSection title={t('conductionTitle', { code: conductionCode(unit) })}>
          <div className={styles.summaryGrid}>
            <div>
              <span className={styles.summaryLabel}>{t('patientName')}</span>
              <h4 className={styles.recipientName}>{order.patientName}</h4>
              <dl className={styles.recipientFacts}>
                {readout('historyNumber', order.historyNumber)}
                {readout('age', order.age)}
                {readout('sex', t(order.sex === 'F' ? 'female' : 'male'))}
                {readout('bloodGroup', transfusionBloodGroupLabel(order.bloodGroup, t))}
                {readout('diagnosis', order.diagnosis, styles.diagnosis)}
              </dl>
              <div className={styles.bodyMeasurements}>
                {input('weight', 'number')}
                {input('height', 'number')}
              </div>
            </div>
            <div className={styles.unitSummary}>
              <h4>{t('unitTitle')}</h4>
              <dl className={styles.unitFacts}>
                {readout('unitCode', dispatch.unitCode)}
                {readout('bloodComponent', t(componentDefinitions[dispatch.component].key))}
                {readout('unitBloodGroup', transfusionBloodGroupLabel(dispatch.bloodGroup, t))}
              </dl>
            </div>
          </div>
        </SheetSection>
        <SheetSection title={t('transfusionRequest')}>
          <dl className={styles.requestFields}>
            {readout('requestCode', order.number)}
            {readout('dispatchDate', formatListDate(dispatch.deliveredAt))}
          </dl>
        </SheetSection>
        {checklist('antecedents', antecedentKeys)}
        <SheetSection
          title={t('priorTransfusions')}
          action={
            !readOnly && (
              <Button
                type="button"
                kind="tertiary"
                size="sm"
                renderIcon={Add}
                onClick={() => change(`history${(manualRows.at(-1) ?? -1) + 1}date`, '')}
              >
                {t('addPriorTransfusion')}
              </Button>
            )
          }
        >
          <div className={styles.scrollArea}>
            <table className={`${styles.sheetTable} ${styles.historyTable}`} aria-label={t('priorTransfusions')}>
              <thead>
                <tr>
                  {priorTransfusionKeys.map((key) => (
                    <th key={key} scope="col">
                      {t(key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => {
                  const values = priorConductionValues(entry, t);
                  return (
                    <tr key={conductionCode(entry)}>
                      {priorTransfusionKeys.map((key) => (
                        <td className={styles.importedCell} key={key}>
                          {(key === 'date' ? dateLabel(values[key]) : values[key]) || '—'}
                        </td>
                      ))}
                    </tr>
                  );
                })}
                {manualRows.map((row, index) => (
                  <tr key={row} className={styles.manualHistory}>
                    {priorTransfusionKeys.map((key) => {
                      const field = `history${row}${key}`;
                      const label = `${t(key)} ${index + 1}`;
                      const legacyQuantity = key === 'unitCode' && fields[`history${row}units`];
                      const component = fields[field] ?? '';
                      return (
                        <td key={key}>
                          {key === 'component' && readOnly ? (
                            <span>
                              {Object.hasOwn(componentDefinitions, component)
                                ? t(componentDefinitions[component as keyof typeof componentDefinitions].key)
                                : component || '—'}
                            </span>
                          ) : key === 'component' ? (
                            <select
                              className={styles.cellInput}
                              aria-label={label}
                              value={component}
                              onChange={(event) => change(field, event.target.value)}
                            >
                              <option value="">{t('chooseComponent')}</option>
                              {component && !Object.hasOwn(componentDefinitions, component) && (
                                <option value={component}>{component}</option>
                              )}
                              {componentTypes.map((type) => (
                                <option key={type} value={type}>
                                  {t(componentDefinitions[type].key)}
                                </option>
                              ))}
                            </select>
                          ) : (
                            cellInput(field, label, key === 'date' ? 'date' : 'text', undefined, t(key))
                          )}
                          {legacyQuantity && (
                            <small className={styles.legacyValue}>
                              {t('legacyQuantity', { quantity: legacyQuantity })}
                            </small>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {!history.length && !manualRows.length && (
                  <tr>
                    <td colSpan={priorTransfusionKeys.length} className={styles.importedCell}>
                      {t('noConductionHistory')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SheetSection>
        <SheetSection title={t('monitoring')}>
          <div className={styles.conductionTimes}>
            <dl className={styles.conductionDate}>
              {readout('conductionDate', dateLabel(fields.conductionDate ?? ''))}
            </dl>
            {input('startTime', 'time')}
            {input('stopTime', 'time')}
            {input('endTime', 'time')}
          </div>
          {!readOnly && (
            <div className={`${styles.actions} ${styles.monitoringActions}`}>
              {canRemoveColumn && (
                <Button
                  type="button"
                  kind="ghost"
                  size="sm"
                  onClick={() => change('monitoringColumns', String(lastColumn))}
                >
                  {t('removeEmptyMonitoringTime')}
                </Button>
              )}
              <Button
                type="button"
                kind="tertiary"
                size="sm"
                renderIcon={Add}
                disabled={columns.length >= maxMonitoringColumns}
                onClick={() => change('monitoringColumns', String(columns.length + 1))}
              >
                {t('addMonitoringTime')}
              </Button>
            </div>
          )}
          <div className={styles.scrollArea}>
            <table className={`${styles.sheetTable} ${styles.monitoring}`} aria-label={t('monitoring')}>
              <thead>
                <tr>
                  <th scope="col">{t('measurement')}</th>
                  {columns.map((column) => (
                    <th scope="col" key={column}>
                      <span className={styles.controlTime}>
                        {t('time')} {column + 1}
                      </span>
                      {cellInput(`time${column}`, `${t('time')} ${column + 1}`, 'time', fields[`time${column - 1}`])}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vitalKeys.map((key) => (
                  <tr key={key}>
                    <th scope="row">{t(key)}</th>
                    {columns.map((column) => (
                      <td key={column}>{cellInput(key + column, `${t(key)} ${column + 1}`)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SheetSection>
        <SheetSection title={t('operatingRoom')}>
          <div className={styles.identityRow}>
            {Object.entries(operatingRoomOptions).map(([key, options]) => {
              const stored = fields[key] ?? '';
              const selected = options.some((option) => option === stored) ? stored : '';
              const legacy = stored
                ? t(stored)
                : [1, 2, 3]
                    .map((column) => fields[key + column])
                    .filter(Boolean)
                    .join(' / ');
              return (
                <div key={key}>
                  <Select
                    id={`hemo-conduction-${key}`}
                    labelText={t(key)}
                    value={selected}
                    readOnly={readOnly}
                    onChange={(event) => change(key, event.target.value)}
                  >
                    <SelectItem
                      value=""
                      text={t('chooseClinicalState')}
                      disabled={key === 'cardiovascular'}
                      hidden={key === 'cardiovascular'}
                    />
                    {options.map((option) => (
                      <SelectItem key={option} value={option} text={t(option)} />
                    ))}
                  </Select>
                  {legacy && !selected && <small className={styles.legacyValue}>{legacy}</small>}
                </div>
              );
            })}
          </div>
        </SheetSection>
        {checklist('adverseSigns', conductionSignKeys(unit.sections.conduction?.fields ?? fields), 'otherSymptomText')}
        <dl className={`${styles.sheetCard} ${styles.requestFields}`}>
          {readout('responsiblePhysician', fields.responsiblePhysician)}
          {readout('physicianRegistration', fields.physicianRegistration)}
        </dl>
      </div>
    );
  }
  if (stage === 'report') {
    const { order, dispatch } = unit;
    const hasLegacyPressure = Boolean(fields.pressureBefore || fields.pressureAfter);
    return (
      <div className={styles.conductionLayout}>
        <SheetSection title={t('reactionPatientAndUnit')}>
          <div className={styles.summaryGrid}>
            <div>
              <span className={styles.summaryLabel}>{t('patientName')}</span>
              <h4 className={styles.recipientName}>{order.patientName}</h4>
              <dl className={styles.requestFields}>
                {readout('historyNumber', order.historyNumber)}
                {readout('service', order.service)}
              </dl>
              <div className={styles.bodyMeasurements}>{input('bed')}</div>
            </div>
            <div className={styles.unitSummary}>
              <h4>{t('unitTitle')}</h4>
              <dl className={styles.unitFacts}>
                {readout('unitCode', dispatch.unitCode)}
                {readout('bloodComponent', t(componentDefinitions[dispatch.component].key))}
              </dl>
              <div className={styles.bodyMeasurements}>{input('transfused', 'number')}</div>
            </div>
          </div>
        </SheetSection>
        <SheetSection title={t('reactionTransfusionDetails')}>
          <div className={styles.reactionTimes}>
            {reportTimes
              .filter((key) => !hideBankNotification || key !== 'bankNotified')
              .map((key) => input(key, 'time'))}
          </div>
          <div className={styles.reactionMedication}>
            {readOnly ? (
              input('premedication')
            ) : (
              <PremedicationPicker
                value={fields.premedication ?? ''}
                onChange={(uuid, name) => setFields({ ...fields, premedication: name, premedicationConceptUuid: uuid })}
                t={t}
              />
            )}
          </div>
        </SheetSection>
        <SheetSection title={t('vitalChanges')}>
          <div className={styles.reactionVitals}>
            {reactionVitalKeys.map((key) => (
              <fieldset key={key} className={styles.vitalPair}>
                <legend>{reactionVitalLabel(key, t)}</legend>
                {(['Before', 'After'] as const).map((period) => {
                  const phase = t(period === 'Before' ? 'before' : 'after');
                  if (key !== 'pressure' || hasLegacyPressure)
                    return input(key + period, 'text', `${reactionVitalLabel(key, t)} · ${phase}`, phase);
                  return (
                    <div key={period} className={styles.pressurePhase}>
                      <span>{phase}</span>
                      {reactionPressureKeys.map((measure) =>
                        input(measure + period, 'number', `${t(measure)} · ${phase}`, t(measure)),
                      )}
                    </div>
                  );
                })}
              </fieldset>
            ))}
          </div>
        </SheetSection>
        {checklist('symptoms', reactionSigns, 'otherSymptomText')}
        {checklist('underlyingConditions', conditions)}
        <SheetSection title={t('reactionPersonnel')}>
          <dl className={styles.reactionPersonnel}>
            {readout('nurse', nurse?.name)}
            {readout('cep', nurse?.license)}
            {readout('reactionPhysician', reviewer?.name)}
            {readout('cmp', reviewer?.license)}
          </dl>
        </SheetSection>
      </div>
    );
  }
  return (
    <>
      <div className={styles.grid}>
        {input('notification')}
        {input('notificationDate', 'date')}
        {input('notificationTime', 'time')}
      </div>
      {checklist('additionalLaboratoryStudies', studies, 'otherStudyText', 'otherStudy')}
      {checklist('summary', findings, 'otherFindingText', 'otherFinding')}
      {notes('recommendations')}
    </>
  );
}
