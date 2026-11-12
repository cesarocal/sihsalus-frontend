import { Button, InlineNotification, RadioButton, RadioButtonGroup, TextInput } from '@carbon/react';
import { Add, TrashCan } from '@carbon/react/icons';
import {
  interviewGeneralGroups,
  interviewListEntries,
  interviewListFields,
  interviewQuestions,
  stiQuestions,
  type InterviewQuestion,
} from './selection-fields';
import type {
  Answer,
  InterviewData,
  InterviewListEntry,
  InterviewListKey,
  PersonalData,
  SelectionTranslate,
} from './selection.types';
import styles from './selection.scss';

interface SelectionInterviewProps {
  interview: InterviewData;
  sex: PersonalData['sex'];
  readOnly: boolean;
  onChange: (interview: InterviewData) => void;
  t: SelectionTranslate;
}

export function SelectionInterview({ interview, sex, readOnly, onChange, t }: SelectionInterviewProps) {
  const answer = (id: string, value: Answer) => {
    const question = interviewQuestions.find((item) => item.id === id);
    const details = { ...interview.details };
    const listDetails = { ...interview.listDetails };
    const answers = { ...interview.answers, [id]: value };
    if (value !== 'yes') {
      if (question?.detail) delete details[question.detail];
      if (question?.list) {
        delete details[question.list];
        delete listDetails[question.list];
      }
      if (id === 'sti') {
        for (const item of stiQuestions) delete answers[item];
        delete details.otherSti;
      }
      if (id === 'otherSti') delete details.otherSti;
    }
    onChange({ ...interview, answers, details, listDetails });
  };

  const yesNo = (id: string, value: Answer, updateAnswer: (next: Answer) => void) => (
    <RadioButtonGroup
      legendText={t(id)}
      name={`selection-${id}`}
      valueSelected={value}
      disabled={readOnly}
      onChange={(next) => updateAnswer(next as Answer)}
    >
      <RadioButton id={`selection-${id}-yes`} labelText={t('yes')} value="yes" />
      <RadioButton id={`selection-${id}-no`} labelText={t('no')} value="no" />
    </RadioButtonGroup>
  );

  const detail = (id: string) => (
    <div data-interview-detail>
      <TextInput
        id={`selection-detail-${id}`}
        labelText={t(id)}
        value={interview.details[id] ?? ''}
        readOnly={readOnly}
        onChange={(event) => onChange({ ...interview, details: { ...interview.details, [id]: event.target.value } })}
      />
    </div>
  );

  const list = (key: InterviewListKey) => {
    const entries = interviewListEntries(interview, key);
    const { item, add } = interviewListFields[key];
    const updateEntries = (next: InterviewListEntry[]) => {
      const details = { ...interview.details };
      delete details[key];
      onChange({ ...interview, details, listDetails: { ...interview.listDetails, [key]: next } });
    };
    return (
      <div className={styles.interviewList} data-interview-detail>
        <div className={styles.interviewListHeader}>
          <h4>
            {t(key)} ({entries.length})
          </h4>
          {!readOnly && (
            <Button
              type="button"
              size="sm"
              kind="tertiary"
              renderIcon={Add}
              onClick={() => updateEntries([...entries, { id: (entries.at(-1)?.id ?? 0) + 1, value: '' }])}
            >
              {t(add)}
            </Button>
          )}
        </div>
        {entries.map((entry, index) => {
          const label = `${t(item)} ${index + 1}`;
          return (
            <div key={entry.id} className={styles.interviewEntry}>
              <TextInput
                id={`selection-${key}-${entry.id}`}
                labelText={label}
                value={entry.value}
                readOnly={readOnly}
                onChange={(event) => {
                  const value = event.target.value;
                  updateEntries(entries.map((row) => (row.id === entry.id ? { ...row, value } : row)));
                }}
              />
              {!readOnly && (
                <Button
                  type="button"
                  size="sm"
                  kind="ghost"
                  renderIcon={TrashCan}
                  aria-label={`${t('removeInterviewEntry')} · ${label}`}
                  onClick={() => updateEntries(entries.filter(({ id }) => id !== entry.id))}
                >
                  {t('removeInterviewEntry')}
                </Button>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const group = (name: InterviewQuestion['group']) => (
    <section className={styles.questionGroup} key={name}>
      <h3>{t(name)}</h3>
      {interviewQuestions
        .filter((question) => question.group === name)
        .map((question) => {
          const value = interview.answers[question.id] ?? '';
          return (
            <div className={styles.question} key={question.id} data-interview-question={question.id}>
              {yesNo(question.id, value, (next) => answer(question.id, next))}
              {value === 'yes' && question.detail && detail(question.detail)}
              {value === 'yes' && question.list && list(question.list)}
              {value === 'yes' && question.id === 'sti' && (
                <>
                  <div className={styles.stiGuidance} data-interview-detail>
                    <InlineNotification
                      kind="warning"
                      hideCloseButton
                      title={t('stiGuidanceTitle')}
                      subtitle={`${t('stiGuidance')} ${t('stiGuidanceEligibility')}`}
                    />
                  </div>
                  <div className={styles.fields}>
                    {stiQuestions.map((id) => (
                      <div key={id} data-interview-question={id}>
                        {yesNo(id, interview.answers[id] ?? '', (next) => answer(id, next))}
                        {id === 'otherSti' && interview.answers[id] === 'yes' && detail(id)}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })}
    </section>
  );

  const womenInput = (key: 'lastPeriod' | 'lastDelivery' | 'pregnancies') => (
    <div data-interview-question={key}>
      <TextInput
        id={`selection-${key}`}
        labelText={t(key)}
        type={key === 'pregnancies' ? 'number' : 'date'}
        min={key === 'pregnancies' ? 0 : undefined}
        value={interview[key]}
        readOnly={readOnly}
        onChange={(event) => onChange({ ...interview, [key]: event.target.value })}
      />
    </div>
  );

  return (
    <div>
      {interviewGeneralGroups.map(group)}
      {sex === 'F' && (
        <section className={styles.questionGroup} aria-labelledby="selection-interview-women">
          <h3 id="selection-interview-women">{t('women')}</h3>
          <div className={styles.fields}>
            <div className={styles.womenQuestions}>
              <h4>{t('menstruationAndPregnancy')}</h4>
              {womenInput('lastPeriod')}
              <div data-interview-question="pregnant">
                {yesNo('pregnant', interview.pregnant, (pregnant) => onChange({ ...interview, pregnant }))}
              </div>
              {womenInput('pregnancies')}
            </div>
            <div className={styles.womenQuestions}>
              <h4>{t('deliveryAndBreastfeeding')}</h4>
              {womenInput('lastDelivery')}
              <div data-interview-question="breastfeeding">
                {yesNo('breastfeeding', interview.breastfeeding, (breastfeeding) =>
                  onChange({ ...interview, breastfeeding }),
                )}
              </div>
            </div>
          </div>
        </section>
      )}
      {group('withInterviewer')}
    </div>
  );
}
