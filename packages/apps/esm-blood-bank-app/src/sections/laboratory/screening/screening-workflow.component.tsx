import { Button, Checkbox, InlineNotification, Select, SelectItem, TextArea, TextInput } from '@carbon/react';
import { Printer } from '@carbon/react/icons';
import { useState } from 'react';
import type { ScreeningApi } from '../../../api/blood-bank-processing.api';
import { ProcessingModal } from '../../../shared/processing-modal.component';
import type { ProcessingTranslate } from '../../../shared/processing-page.component';
import { printDocument } from '../../../shared/print-document';
import { notifySuccess } from '../../../shared/notify-success';
import styles from '../../applicant-selection/selection.scss';
import { ScreeningIdentity, ScreeningReport } from './screening-report.component';
import { localDateTime, validateScreening } from './screening-rules';
import { screeningSteps, screeningTests, type ScreeningRecord, type ScreeningResult } from './screening.types';

export function ScreeningWorkflow({
  initial,
  api,
  onClose,
  onSaved,
  t,
}: {
  initial: ScreeningRecord;
  api: ScreeningApi;
  onClose: () => void;
  onSaved: () => void;
  t: ProcessingTranslate;
}) {
  const [record, setRecord] = useState(() => ({
    ...initial,
    receivedOn: initial.receivedOn || localDateTime(),
    performedOn: initial.performedOn || localDateTime(),
  }));
  const [step, setStep] = useState(initial.status === 'validated' ? 2 : Math.min(initial.completedSteps.length, 2));
  const [errors, setErrors] = useState<string[]>([]);
  const [failed, setFailed] = useState('');
  const [saving, setSaving] = useState(false);
  const finalized = record.status === 'validated';
  const locked = finalized || (step === 0 && record.completedSteps.includes('reception'));
  const stage = screeningSteps[step];
  const change = (next: ScreeningRecord) => {
    setRecord(next);
  };
  const save = async (advance = false) => {
    if (saving) return false;
    if (advance && locked) {
      setStep((value) => Math.min(value + 1, 2));
      return true;
    }
    const missing = advance ? validateScreening(record, stage) : [];
    setErrors(missing);
    setFailed('');
    if (missing.length) return false;
    setSaving(true);
    try {
      const result = await api.saveScreening(record, advance ? stage : undefined);
      setRecord(result);
      if (advance && stage === 'validation') onSaved();
      else {
        notifySuccess(t('saved'));
        if (advance) setStep((value) => value + 1);
      }
      return true;
    } catch {
      setFailed('saveFailed');
      return false;
    } finally {
      setSaving(false);
    }
  };
  const input = (field: 'receivedOn' | 'receivedBy' | 'performedOn' | 'performedBy' | 'validatedBy') => (
    <TextInput
      key={field}
      id={`screening-${field}`}
      labelText={t(field)}
      value={record[field]}
      type={field.endsWith('On') ? 'datetime-local' : 'text'}
      readOnly={locked}
      disabled={saving}
      invalid={errors.includes(field)}
      invalidText={t('requiredFields')}
      onChange={(event) => change({ ...record, [field]: event.target.value })}
    />
  );
  const print = () => {
    const missing = validateScreening(record, 'validation');
    setErrors(missing);
    setFailed('');
    if (missing.length) return;
    try {
      printDocument(<ScreeningReport record={record} t={t} />, t('printResults'));
    } catch {
      setFailed('printFailed');
    }
  };
  return (
    <ProcessingModal
      title={t('screeningTitle')}
      steps={screeningSteps}
      step={step}
      completed={record.completedSteps}
      finalized={finalized}
      saving={saving}
      errors={errors}
      failed={failed}
      onClose={onClose}
      onDraft={() => save()}
      onAdvance={() => {
        void save(true);
      }}
      onPrevious={() => {
        setStep((value) => value - 1);
        setErrors([]);
        setFailed('');
      }}
      advanceLabel={t(step === 2 ? 'validateResults' : 'next')}
      t={t}
      extraActions={
        step === 2 && (
          <Button kind="ghost" renderIcon={Printer} disabled={saving} onClick={print}>
            {t('printResults')}
          </Button>
        )
      }
    >
      {step < 2 && <ScreeningIdentity record={record} t={t} />}
      {locked && <p className={styles.help}>{t('locked')}</p>}
      {step === 0 && (
        <>
          <div className={styles.fields}>
            {input('receivedOn')}
            {input('receivedBy')}
          </div>
          <Checkbox
            id="screening-identity"
            labelText={t('identityVerified')}
            checked={record.identityVerified}
            disabled={locked || saving}
            onChange={(_event, { checked }) => change({ ...record, identityVerified: checked })}
          />
          <p className={styles.help}>{t('identityHelp')}</p>
        </>
      )}
      {step === 1 && (
        <>
          <div className={styles.fields}>
            {input('performedOn')}
            {input('performedBy')}
          </div>
          {screeningTests.map((test) => (
            <section className={styles.questionGroup} key={test} aria-label={t(test)}>
              <h3>{t(test)}</h3>
              <div className={styles.fields}>
                <Select
                  id={`screening-${test}-result`}
                  labelText={t('result')}
                  value={record.tests[test].result}
                  disabled={locked || saving}
                  invalid={errors.includes(test)}
                  invalidText={t('requiredFields')}
                  onChange={(event) =>
                    change({
                      ...record,
                      tests: {
                        ...record.tests,
                        [test]: { ...record.tests[test], result: event.target.value as ScreeningResult },
                      },
                    })
                  }
                >
                  <SelectItem value="" text={t('choose')} />
                  {['nonReactive', 'reactive', 'inconclusive'].map((value) => (
                    <SelectItem key={value} value={value} text={t(value)} />
                  ))}
                </Select>
                {(['reagent', 'brand', 'lot'] as const).map((field) => (
                  <TextInput
                    key={field}
                    id={`screening-${test}-${field}`}
                    labelText={t(field)}
                    value={record.tests[test][field]}
                    readOnly={locked}
                    disabled={saving}
                    onChange={(event) =>
                      change({
                        ...record,
                        tests: { ...record.tests, [test]: { ...record.tests[test], [field]: event.target.value } },
                      })
                    }
                  />
                ))}
              </div>
            </section>
          ))}
          <TextArea
            id="screening-notes"
            labelText={t('observations')}
            value={record.observations}
            readOnly={locked}
            disabled={saving}
            onChange={(event) => change({ ...record, observations: event.target.value })}
          />
        </>
      )}
      {step === 2 && (
        <>
          <div className={styles.fields}>{input('validatedBy')}</div>
          <ScreeningReport record={record} t={t} />
          <InlineNotification hideCloseButton kind="warning" title={t('quarantine')} subtitle={t('screeningWarning')} />
        </>
      )}
    </ProcessingModal>
  );
}
