import {
  Accordion,
  AccordionItem,
  Button,
  Checkbox,
  InlineNotification,
  Select,
  SelectItem,
  TextInput,
} from '@carbon/react';
import { Printer } from '@carbon/react/icons';
import { formatDatetime, useSession } from '@openmrs/esm-framework';
import { useState } from 'react';
import type { ScreeningApi } from '../../../api/blood-bank-processing.api';
import { ObservationsTextArea } from '../../../shared/observations-text-area.component';
import { ProcessingModal } from '../../../shared/processing-modal.component';
import type { ProcessingTranslate } from '../../../shared/processing-page.component';
import { printDocument } from '../../../shared/print-document';
import { notifySuccess } from '../../../shared/notify-success';
import { validateObservations } from '../../../shared/text-field-contracts';
import styles from '../../applicant-selection/selection.scss';
import { ScreeningIdentity, ScreeningReport } from './screening-report.component';
import { ApheresisTubeLabel } from './apheresis-documents.component';
import { localDateTime, validateScreening } from './screening-rules';
import { screeningSteps, screeningTests, type ScreeningRecord, type ScreeningResult } from './screening.types';
import screeningStyles from './screening.scss';

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
  const [storedRecord, setRecord] = useState(() => ({
    ...initial,
    receivedOn: initial.receivedOn || localDateTime(),
    performedOn: initial.performedOn || localDateTime(),
  }));
  const { authenticated, user } = useSession();
  const operatorName = authenticated ? (user?.person?.display?.trim() ?? '') : '';
  const [step, setStep] = useState(initial.status === 'validated' ? 2 : Math.min(initial.completedSteps.length, 2));
  const [errors, setErrors] = useState<string[]>([]);
  const [failed, setFailed] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(!initial.receivedOn || !initial.performedOn);
  const [resultsExpanded, setResultsExpanded] = useState(true);
  const finalized = storedRecord.status === 'validated';
  const receptionSaved = storedRecord.completedSteps.includes('reception');
  const record = receptionSaved || finalized ? storedRecord : { ...storedRecord, receivedBy: operatorName };
  const locked = finalized || (step === 0 && receptionSaved);
  const stage = screeningSteps[step];
  const change = (next: ScreeningRecord) => {
    setRecord(next);
    setDirty(true);
  };
  const save = async (advance = false) => {
    if (saving) return false;
    if (advance && locked) {
      if (stage === 'reception') setResultsExpanded(true);
      setStep((value) => Math.min(value + 1, 2));
      return true;
    }
    const missing = validateObservations(record.observations);
    if (missing.length && record.completedSteps.includes('reception')) setStep(screeningSteps.indexOf('results'));
    if (advance && !missing.length) missing.push(...validateScreening(record, stage));
    setErrors(missing);
    setFailed('');
    if (missing.length) {
      if (stage === 'results' || missing.includes('observationsTooLong')) setResultsExpanded(true);
      return false;
    }
    setSaving(true);
    try {
      const result = await api.saveScreening(record, advance ? stage : undefined);
      setRecord(result);
      setDirty(false);
      if (advance && stage === 'validation') onSaved();
      else {
        const message = !advance
          ? 'screeningDraftUpdated'
          : stage === 'reception'
            ? 'screeningReceptionSaved'
            : record.completedSteps.includes('results')
              ? 'screeningResultsUpdated'
              : 'screeningResultsSaved';
        notifySuccess(t(message));
        if (advance) setStep((value) => value + 1);
      }
      return true;
    } catch {
      setFailed('screeningSaveFailed');
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
      value={
        locked && field.endsWith('On') && record[field]
          ? formatDatetime(new Date(record[field]), { noToday: true })
          : record[field]
      }
      type={!locked && field.endsWith('On') ? 'datetime-local' : 'text'}
      readOnly={locked || field === 'receivedBy'}
      disabled={saving && !locked && field !== 'receivedBy'}
      invalid={errors.includes(field)}
      invalidText={t(field === 'receivedBy' ? 'screeningReceiverUnavailable' : 'requiredFields')}
      onChange={(event) => {
        if (!locked && field !== 'receivedBy') change({ ...record, [field]: event.target.value });
      }}
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
      saveErrorText={t('screeningSaveFailed')}
      onClose={onClose}
      onDraft={() => save()}
      onSaveBeforeExit={async () => {
        if (!dirty) return 'unchanged';
        return (await save()) ? 'saved' : 'failed';
      }}
      onAdvance={() => {
        void save(true);
      }}
      onPrevious={() => {
        if (step === 2) setResultsExpanded(true);
        setStep((value) => value - 1);
        setErrors([]);
        setFailed('');
      }}
      advanceLabel={t(step === 2 ? 'validateResults' : 'next')}
      compactHeader={step === 0}
      hideStepHeading={step < 2}
      t={t}
      extraActions={
        <>
          {(initial.origin?.type === 'apheresis' || initial.origin?.type === 'followUp') && (
            <Button
              kind="ghost"
              renderIcon={Printer}
              disabled={saving}
              onClick={() => {
                try {
                  printDocument(<ApheresisTubeLabel record={initial} t={t} />, t('sampleLabel'));
                  setFailed('');
                } catch {
                  setFailed('printFailed');
                }
              }}
            >
              {t('printSample')}
            </Button>
          )}
          {step === 2 && (
            <Button kind="ghost" renderIcon={Printer} disabled={saving} onClick={print}>
              {t('printResults')}
            </Button>
          )}
        </>
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
          {locked ? (
            <TextInput
              id="screening-identity"
              labelText={t('identityVerified')}
              value={t(record.identityVerified ? 'yes' : 'no')}
              readOnly
            />
          ) : (
            <Checkbox
              id="screening-identity"
              labelText={t('identityVerified')}
              checked={record.identityVerified}
              disabled={saving}
              onChange={(_event, { checked }) => change({ ...record, identityVerified: checked })}
            />
          )}
        </>
      )}
      {step === 1 && (
        <Accordion className={screeningStyles.resultsAccordion}>
          <AccordionItem
            title={t('results')}
            open={resultsExpanded}
            onHeadingClick={({ isOpen }) => setResultsExpanded(isOpen)}
          >
            <div className={styles.fields}>
              {input('performedOn')}
              {input('performedBy')}
            </div>
            {screeningTests.map((test) => (
              <section className={styles.questionGroup} key={test} aria-label={t(test)}>
                <h3>{t(test)}</h3>
                <div className={styles.fields}>
                  {locked ? (
                    <TextInput
                      id={`screening-${test}-result`}
                      labelText={t('result')}
                      value={record.tests[test].result ? t(record.tests[test].result) : '—'}
                      readOnly
                    />
                  ) : (
                    <Select
                      id={`screening-${test}-result`}
                      labelText={t('result')}
                      value={record.tests[test].result}
                      disabled={saving}
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
                  )}
                  {(['reagent', 'brand', 'lot'] as const).map((field) => (
                    <TextInput
                      key={field}
                      id={`screening-${test}-${field}`}
                      labelText={t(field)}
                      value={record.tests[test][field]}
                      readOnly={locked}
                      disabled={saving && !locked}
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
            <ObservationsTextArea
              id="screening-notes"
              t={t}
              labelText={t('observations')}
              value={record.observations}
              readOnly={locked}
              disabled={saving && !locked}
              onChange={(event) => change({ ...record, observations: event.target.value })}
            />
          </AccordionItem>
        </Accordion>
      )}
      {step === 2 && (
        <>
          <div className={styles.fields}>{input('validatedBy')}</div>
          <ScreeningReport record={record} t={t} />
          <InlineNotification
            hideCloseButton
            kind="warning"
            title={t(record.unitCode ? 'quarantine' : 'results')}
            subtitle={t(record.unitCode ? 'screeningWarning' : 'sampleScreeningWarning')}
          />
        </>
      )}
    </ProcessingModal>
  );
}
