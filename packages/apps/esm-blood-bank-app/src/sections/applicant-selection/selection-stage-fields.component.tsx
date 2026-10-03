import {
  InlineNotification,
  RadioButton,
  RadioButtonGroup,
  Select,
  SelectItem,
  TextArea,
  TextInput,
} from '@carbon/react';
import { ageOnDate, calculateReturnDate } from './selection-rules';
import { interviewQuestions, personalFields, physicalFields, stiQuestions } from './selection-fields';
import type { Answer, SelectionApplication, SelectionStep, SelectionTranslate } from './selection.types';
import styles from './selection.scss';

interface StageFieldsProps {
  application: SelectionApplication;
  stage: SelectionStep;
  readOnly: boolean;
  update: (application: SelectionApplication) => void;
  t: SelectionTranslate;
}

export function YesNo({
  id,
  label,
  value,
  onChange,
  readOnly,
  t,
}: {
  id: string;
  label: string;
  value: Answer;
  onChange: (answer: Answer) => void;
  readOnly?: boolean;
  t: SelectionTranslate;
}) {
  return (
    <RadioButtonGroup
      legendText={label}
      name={`selection-${id}`}
      valueSelected={value}
      onChange={(value) => onChange(value as Answer)}
      disabled={readOnly}
    >
      <RadioButton id={`selection-${id}-yes`} labelText={t('yes')} value="yes" />
      <RadioButton id={`selection-${id}-no`} labelText={t('no')} value="no" />
    </RadioButtonGroup>
  );
}

export function SelectionStageFields({ application: a, stage, readOnly, update, t }: StageFieldsProps) {
  const text = (section: 'admission' | 'personal' | 'physical' | 'qualification', key: string, type = 'text') => {
    const data = a[section] as unknown as Record<string, string>;
    return (
      <TextInput
        key={key}
        id={`selection-${key}`}
        labelText={t(key)}
        type={type}
        value={data[key] ?? ''}
        readOnly={readOnly}
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
  const notes = (section: 'physical' | 'interview' | 'qualification', key = 'observations') => (
    <TextArea
      id={`selection-${section}-${key}`}
      labelText={t(key)}
      rows={3}
      value={(a[section] as unknown as Record<string, string>)[key]}
      readOnly={readOnly}
      onChange={(event) => update({ ...a, [section]: { ...a[section], [key]: event.target.value } })}
    />
  );

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

  if (stage === 'personal')
    return (
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
    );

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

  if (stage === 'interview') {
    const answer = (id: string, value: Answer) => {
      const question = interviewQuestions.find((q) => q.id === id);
      const details = { ...a.interview.details };
      const answers = { ...a.interview.answers, [id]: value };
      if (question?.detail && value !== 'yes') delete details[question.detail];
      if (id === 'sti' && value !== 'yes') {
        for (const item of stiQuestions) delete answers[item];
        delete details.otherSti;
      }
      if (id === 'otherSti' && value !== 'yes') delete details.otherSti;
      update({ ...a, interview: { ...a.interview, answers, details } });
    };
    const detail = (id: string) => (
      <TextInput
        id={`selection-detail-${id}`}
        labelText={t(id)}
        value={a.interview.details[id] ?? ''}
        readOnly={readOnly}
        onChange={(event) =>
          update({ ...a, interview: { ...a.interview, details: { ...a.interview.details, [id]: event.target.value } } })
        }
      />
    );
    return (
      <>
        {['general', 'nextDay', 'lastTwoWeeks', 'lastMonth', 'lastYear', 'lifetime'].map((group) => (
          <section className={styles.questionGroup} key={group}>
            <h3>{t(group)}</h3>
            {interviewQuestions
              .filter((q) => q.group === group)
              .map((q) => (
                <div className={styles.question} key={q.id}>
                  <YesNo
                    id={q.id}
                    label={t(q.id)}
                    value={a.interview.answers[q.id] ?? ''}
                    onChange={(value) => answer(q.id, value)}
                    readOnly={readOnly}
                    t={t}
                  />
                  {q.detail && a.interview.answers[q.id] === 'yes' && detail(q.detail)}
                </div>
              ))}
          </section>
        ))}
        {a.personal.sex === 'F' && (
          <section className={styles.questionGroup}>
            <h3>{t('women')}</h3>
            <div className={styles.fields}>
              {['lastPeriod', 'lastDelivery', 'pregnancies'].map((key) => (
                <TextInput
                  key={key}
                  id={`selection-${key}`}
                  labelText={t(key)}
                  type={key === 'pregnancies' ? 'number' : 'date'}
                  min={key === 'pregnancies' ? 0 : undefined}
                  value={a.interview[key as 'lastPeriod' | 'lastDelivery' | 'pregnancies']}
                  readOnly={readOnly}
                  onChange={(event) => update({ ...a, interview: { ...a.interview, [key]: event.target.value } })}
                />
              ))}
            </div>
            <YesNo
              id="pregnant"
              label={t('pregnant')}
              value={a.interview.pregnant}
              onChange={(value) => update({ ...a, interview: { ...a.interview, pregnant: value } })}
              readOnly={readOnly}
              t={t}
            />
            <YesNo
              id="breastfeeding"
              label={t('breastfeeding')}
              value={a.interview.breastfeeding}
              onChange={(value) => update({ ...a, interview: { ...a.interview, breastfeeding: value } })}
              readOnly={readOnly}
              t={t}
            />
          </section>
        )}
        <section className={styles.questionGroup}>
          <h3>{t('withInterviewer')}</h3>
          {interviewQuestions
            .filter((q) => q.group === 'withInterviewer')
            .map((q) => (
              <div className={styles.question} key={q.id}>
                <YesNo
                  id={q.id}
                  label={t(q.id)}
                  value={a.interview.answers[q.id] ?? ''}
                  onChange={(value) => answer(q.id, value)}
                  readOnly={readOnly}
                  t={t}
                />
              </div>
            ))}
          {a.interview.answers.sti === 'yes' && (
            <div className={styles.fields}>
              {stiQuestions.map((id) => (
                <YesNo
                  key={id}
                  id={id}
                  label={t(id)}
                  value={a.interview.answers[id] ?? ''}
                  onChange={(value) => answer(id, value)}
                  readOnly={readOnly}
                  t={t}
                />
              ))}
              {a.interview.answers.otherSti === 'yes' && detail('otherSti')}
            </div>
          )}
        </section>
        {notes('interview')}
      </>
    );
  }

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
        {a.stoppedAfterPhysical && <InlineNotification hideCloseButton kind="info" title={t('stoppedAfterPhysical')} />}
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
