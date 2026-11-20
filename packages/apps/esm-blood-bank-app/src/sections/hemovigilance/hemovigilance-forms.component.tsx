import { Checkbox, TextArea, TextInput } from '@carbon/react';
import type { ReactNode } from 'react';
import { formatListDate } from '../../shared/format-list-date';
import type { ProcessingTranslate } from '../../shared/processing-page.component';
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
  reportTimes,
  type Stage,
  studies,
  type UnitCase,
  vitalKeys,
} from './hemovigilance';
import styles from './hemovigilance.scss';

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
  copied = {},
  t,
}: {
  stage: Stage;
  fields: Fields;
  setFields: (fields: Fields) => void;
  readOnly: boolean;
  copied?: Fields;
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
      readOnly={
        readOnly || (stage === 'report' && (key === 'startTime' || key === 'transfused') && Boolean(copied[key]))
      }
      onChange={(event) => change(key, event.target.value)}
    />
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
  const checklist = (title: string, keys: string[], detailsKey?: string, detailsTrigger = 'otherSymptom') => (
    <fieldset className={styles.block}>
      <legend>{t(title)}</legend>
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
    </fieldset>
  );

  if (stage === 'conduction')
    return (
      <>
        <div className={styles.grid}>
          {input('conductionDate', 'date')}
          {input('weight', 'number')}
          {input('height', 'number')}
          {input('startTime', 'time')}
          {input('endTime', 'time')}
          {input('transfused', 'number')}
        </div>
        {checklist('antecedents', antecedentKeys)}
        <fieldset className={styles.block}>
          <legend>{t('priorTransfusions')}</legend>
          <div className={styles.scrollArea}>
            <table className={styles.monitoring}>
              <thead>
                <tr>
                  {['date', 'units', 'component', 'priorReaction', 'place', 'notes'].map((key) => (
                    <th key={key}>{t(key)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[0, 1, 2, 3, 4].map((row) => (
                  <tr key={row}>
                    {['date', 'units', 'component', 'priorReaction', 'place', 'notes'].map((key) => (
                      <td key={key}>
                        {input(
                          `history${row}${key}`,
                          key === 'date' ? 'date' : key === 'units' ? 'number' : 'text',
                          `${t(key)} ${row + 1}`,
                          '',
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </fieldset>
        <fieldset className={styles.block}>
          <legend>{t('monitoring')}</legend>
          <div className={styles.scrollArea}>
            <table className={styles.monitoring}>
              <thead>
                <tr>
                  <th scope="col">{t('measurement')}</th>
                  {[0, 1, 2, 3, 4].map((column) => (
                    <th scope="col" key={column}>
                      {input(`time${column}`, 'time', `${t('time')} ${column + 1}`, '')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vitalKeys.map((key) => (
                  <tr key={key}>
                    <th scope="row">{t(key)}</th>
                    {[0, 1, 2, 3, 4].map((column) => (
                      <td key={column}>{input(key + column, 'text', `${t(key)} ${column + 1}`, '')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </fieldset>
        <fieldset className={styles.block}>
          <legend>{t('operatingRoom')}</legend>
          <div className={styles.grid}>
            {['consciousness', 'cardiovascular', 'pulmonary'].flatMap((key) =>
              [1, 2, 3].map((column) => input(key + column, 'text', `${t(key)} ${column}`)),
            )}
          </div>
        </fieldset>
        {checklist('adverseSigns', conductionSigns, 'otherSymptomText')}
        <div className={styles.grid}>
          {input('responsiblePhysician')}
          {input('physicianRegistration')}
        </div>
      </>
    );
  if (stage === 'report')
    return (
      <>
        <div className={styles.grid}>
          {input('transfused', 'number')}
          {input('premedication')}
        </div>
        <div className={styles.grid}>{reportTimes.map((key) => input(key, 'time'))}</div>
        <fieldset className={styles.block}>
          <legend>{t('vitalChanges')}</legend>
          <div className={styles.grid}>
            {reactionVitalKeys.flatMap((key) => [
              input(key + 'Before', 'text', `${t(key)} · ${t('before')}`),
              input(key + 'After', 'text', `${t(key)} · ${t('after')}`),
            ])}
          </div>
        </fieldset>
        {checklist('symptoms', reactionSigns, 'otherSymptomText')}
        {checklist('underlyingConditions', conditions)}
      </>
    );
  if (stage === 'review') return notes('reviewNotes');
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
