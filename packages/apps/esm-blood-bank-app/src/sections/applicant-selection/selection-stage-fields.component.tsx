import { Button, RadioButton, RadioButtonGroup, Select, SelectItem, TextArea, TextInput } from '@carbon/react';
import { Add, TrashCan } from '@carbon/react/icons';
import type { ChangeEvent } from 'react';
import { ObservationsTextArea } from '../../shared/observations-text-area.component';
import { ageOnDate, calculateReturnDate, contactNumberWarning } from './selection-rules';
import { personalFields, physicalFields, tripFields } from './selection-fields';
import { SelectionInterview } from './selection-interview.component';
import type { ApplicantTrip, SelectionApplication, SelectionStep, SelectionTranslate } from './selection.types';
import styles from './selection.scss';

interface StageFieldsProps {
  application: SelectionApplication;
  stage: SelectionStep;
  readOnly: boolean;
  update: (application: SelectionApplication) => void;
  t: SelectionTranslate;
}

export function SelectionStageFields({ application: a, stage, readOnly, update, t }: StageFieldsProps) {
  const text = (section: 'admission' | 'personal' | 'physical' | 'qualification', key: string, type = 'text') => {
    const data = a[section] as unknown as Record<string, string>;
    const value = data[key] ?? '';
    const warning =
      !readOnly && section === 'personal' && (key === 'phone' || key === 'mobile')
        ? contactNumberWarning(key, value)
        : undefined;
    return (
      <TextInput
        key={key}
        id={`selection-${key}`}
        labelText={t(key)}
        type={type}
        inputMode={type === 'tel' ? 'numeric' : undefined}
        value={value}
        readOnly={readOnly}
        warn={Boolean(warning)}
        warnText={warning && t(warning)}
        onChange={(event) => update({ ...a, [section]: { ...a[section], [key]: event.target.value } })}
      />
    );
  };
  const select = (section: 'admission' | 'personal' | 'physical' | 'qualification', key: string, options: string[]) => {
    const data = a[section] as unknown as Record<string, string>;
    return (
      <Select
        id={`selection-${key}`}
        labelText={t(key)}
        value={data[key] ?? ''}
        disabled={readOnly}
        onChange={(event) => update({ ...a, [section]: { ...a[section], [key]: event.target.value } })}
      >
        <SelectItem value="" text={t('choose')} />
        {options.map((value) => (
          <SelectItem key={value} value={value} text={t(value)} />
        ))}
      </Select>
    );
  };
  const notes = (section: 'physical' | 'qualification', key = 'observations') => {
    const value = (a[section] as unknown as Record<string, string>)[key] ?? '';
    const props = {
      id: `selection-${section}-${key}`,
      labelText: t(key),
      rows: 3,
      value,
      readOnly,
      onChange: (event: ChangeEvent<HTMLTextAreaElement>) =>
        update({ ...a, [section]: { ...a[section], [key]: event.target.value } }),
    };
    return key === 'observations' ? <ObservationsTextArea {...props} t={t} /> : <TextArea {...props} />;
  };

  if (stage === 'admission')
    return (
      <div className={styles.fields}>
        <TextInput
          id="selection-number"
          labelText={t('number')}
          value={a.number || t('numberAssignedOnSave')}
          readOnly
        />
        {text('admission', 'date', 'date')}
        {select('admission', 'documentType', ['DNI', 'CE', 'PASSPORT'])}
        {text('admission', 'documentNumber')}
        {text('admission', 'donorCode')}
        {select('admission', 'donationType', ['voluntary', 'replacement', 'autologous'])}
        <div className={styles.fullWidth}>
          <RadioButtonGroup
            legendText={t('modality')}
            name="selection-modality"
            valueSelected={a.admission.modality}
            disabled={readOnly}
            onChange={(value) =>
              update({ ...a, admission: { ...a.admission, modality: value as typeof a.admission.modality } })
            }
          >
            <RadioButton id="selection-wholeBlood" value="wholeBlood" labelText={t('wholeBlood')} />
            <RadioButton id="selection-apheresis" value="apheresis" labelText={t('apheresis')} />
          </RadioButtonGroup>
        </div>
        {a.admission.donationType === 'replacement' && (
          <>
            {text('admission', 'beneficiaryName')}
            {text('admission', 'beneficiaryDocument')}
          </>
        )}
      </div>
    );

  if (stage === 'personal') {
    const { trips } = a.personal;
    const updateTrips = (next: ApplicantTrip[]) => update({ ...a, personal: { ...a.personal, trips: next } });
    return (
      <>
        <div className={styles.fields}>
          {personalFields.map(({ key, type }) => text('personal', key, type))}
          {select('personal', 'sex', ['M', 'F'])}
          <TextInput
            id="selection-age"
            labelText={t('age')}
            value={String(ageOnDate(a.personal.birthDate, a.admission.date) ?? '')}
            readOnly
          />
          {select('personal', 'maritalStatus', ['single', 'married', 'widowed', 'divorced', 'cohabiting'])}
        </div>
        <section className={styles.trips} aria-labelledby="selection-trips">
          <div className={styles.tripHeading}>
            <h4 id="selection-trips">
              {t('trips')} ({trips.length})
            </h4>
            {!readOnly && (
              <Button
                type="button"
                kind="tertiary"
                size="sm"
                renderIcon={Add}
                onClick={() =>
                  updateTrips([...trips, { id: (trips.at(-1)?.id ?? 0) + 1, place: '', duration: '', date: '' }])
                }
              >
                {t('addTrip')}
              </Button>
            )}
          </div>
          {trips.map((trip, index) => {
            const headingId = `selection-trip-${trip.id}-heading`;
            const tripLabel = `${t('trip')} ${index + 1}`;
            return (
              <section className={styles.trip} key={trip.id} aria-labelledby={headingId}>
                <div className={styles.tripHeading}>
                  <h5 id={headingId}>{tripLabel}</h5>
                  {!readOnly && (
                    <Button
                      type="button"
                      kind="ghost"
                      size="sm"
                      renderIcon={TrashCan}
                      aria-label={`${t('removeTrip')} · ${tripLabel}`}
                      onClick={() => updateTrips(trips.filter(({ id }) => id !== trip.id))}
                    >
                      {t('removeTrip')}
                    </Button>
                  )}
                </div>
                <div className={`${styles.fields} ${styles.tripFields}`}>
                  {tripFields.map(({ key, label, type }) => (
                    <TextInput
                      key={key}
                      id={`selection-trip-${trip.id}-${key}`}
                      labelText={t(label)}
                      type={type}
                      max={type === 'date' ? a.admission.date : undefined}
                      value={trip[key]}
                      readOnly={readOnly}
                      onChange={(event) => {
                        const value = event.target.value;
                        updateTrips(trips.map((row) => (row.id === trip.id ? { ...row, [key]: value } : row)));
                      }}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </section>
      </>
    );
  }

  if (stage === 'physical')
    return (
      <>
        <div className={styles.fields}>
          {physicalFields.map(({ key, unit }) => (
            <TextInput
              key={key}
              id={`selection-${key}`}
              labelText={`${t(key)} (${unit === 'lpm' ? t('beatsPerMinute') : unit})`}
              inputMode="decimal"
              value={a.physical[key]}
              readOnly={readOnly}
              onChange={(event) => {
                const value = event.target.value.replace(',', '.');
                if (/^\d*(\.\d*)?$/.test(value))
                  update({ ...a, physical: { ...a.physical, [key]: value, warningAcknowledgement: '' } });
              }}
            />
          ))}
          {select('physical', 'bloodGroup', ['O', 'A', 'B', 'AB'])}
          {select('physical', 'rh', ['+', '-'])}
          {select('physical', 'armInspection', ['normal', 'lesions', 'otherFinding'])}
        </div>
        {notes('physical')}
        {a.physical.warningAcknowledgement && (
          <TextArea
            id="selection-warningAcknowledgement"
            labelText={t('warningAcknowledgement')}
            value={a.physical.warningAcknowledgement}
            readOnly
            rows={2}
          />
        )}
      </>
    );

  if (stage === 'interview')
    return (
      <SelectionInterview
        interview={a.interview}
        sex={a.personal.sex}
        readOnly={readOnly}
        onChange={(interview) => update({ ...a, interview })}
        t={t}
      />
    );

  if (stage === 'qualification')
    return (
      <>
        <div className={styles.qualification}>
          <RadioButtonGroup
            legendText={t('result')}
            name="selection-result"
            orientation="vertical"
            valueSelected={a.qualification.result}
            disabled={readOnly}
            onChange={(value) =>
              update({
                ...a,
                qualification: {
                  ...a.qualification,
                  result: value as typeof a.qualification.result,
                  ...(value === 'eligible' ? { reason: '', duration: '' } : {}),
                },
              })
            }
          >
            {['eligible', 'temporary', 'permanent'].map((value) => (
              <RadioButton
                key={value}
                id={`selection-${value}`}
                value={value}
                labelText={t(value)}
                disabled={value === 'eligible' && a.stoppedAfterPhysical}
              />
            ))}
          </RadioButtonGroup>
          <div>
            {a.qualification.result === 'temporary' && (
              <div className={styles.fields}>
                {text('qualification', 'duration', 'number')}
                {select('qualification', 'durationUnit', ['days', 'months', 'years'])}
                <TextInput
                  id="selection-returnDate"
                  labelText={t('returnDate')}
                  value={
                    calculateReturnDate(a.admission.date, a.qualification.duration, a.qualification.durationUnit) ?? ''
                  }
                  readOnly
                />
              </div>
            )}
            {a.qualification.result && a.qualification.result !== 'eligible' && notes('qualification', 'reason')}
          </div>
        </div>
        <div className={styles.fields}>
          {text('qualification', 'applicantName')}
          {text('qualification', 'interviewerName')}
          {text('qualification', 'interviewerLicense')}
          {text('qualification', 'validatedBy')}
        </div>
        {notes('qualification')}
      </>
    );
  return null;
}
