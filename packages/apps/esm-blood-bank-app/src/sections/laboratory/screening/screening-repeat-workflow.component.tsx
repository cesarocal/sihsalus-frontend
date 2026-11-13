import {
  InlineNotification,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TextInput,
} from '@carbon/react';
import { useSession } from '@openmrs/esm-framework';
import { useState } from 'react';
import type { ScreeningApi } from '../../../api/blood-bank-processing.api';
import { notifySuccess } from '../../../shared/notify-success';
import { useLiveClock } from '../../../shared/use-live-clock';
import { ProcessingModal } from '../../../shared/processing-modal.component';
import type { ProcessingTranslate } from '../../../shared/processing-page.component';
import styles from '../../applicant-selection/selection.scss';
import { formatScreeningCollectionTime, localDateTime } from './screening-rules';
import {
  screeningReportCode,
  screeningReportedTests,
  screeningRepeatTests,
  screeningTestLabelKey,
} from './screening-repeat-rules';
import { ScreeningIdentity, ScreeningReport } from './screening-report.component';
import { ScreeningOutcomeField } from './screening-results-fields.component';
import type { ScreeningRecord, ScreeningRepeatRound, ScreeningRepeatStep } from './screening.types';
import screeningStyles from './screening.scss';

const steps = ['screeningRepeatResults', 'validation'] as const;

export function ScreeningRepeatWorkflow({
  record,
  initial,
  api,
  onClose,
  onSaved,
  t,
}: {
  record: ScreeningRecord;
  initial: ScreeningRepeatRound;
  api: ScreeningApi;
  onClose: () => void;
  onSaved: (round: ScreeningRepeatRound) => void;
  t: ProcessingTranslate;
}) {
  const [round, setRound] = useState(initial);
  const [step, setStep] = useState(initial.status === 'readyForValidation' ? 1 : 0);
  const clock = useLiveClock(step === 0);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [failed, setFailed] = useState('');
  const { authenticated, user } = useSession();
  const operatorName = authenticated ? (user?.person?.display?.trim() ?? '') : '';

  const save = async (stage?: ScreeningRepeatStep) => {
    if (saving) return false;
    const missing = stage
      ? screeningRepeatTests(round)
          .filter((test) => !round.results[test])
          .map(screeningTestLabelKey)
      : [];
    if (stage && !operatorName) missing.push('screeningRepeatOperatorUnavailable');
    setErrors(missing);
    setFailed('');
    if (missing.length) return false;
    setSaving(true);
    try {
      const saved = await api.saveScreeningRepeat(
        record.id,
        { roundId: round.id, revision: round.revision, results: round.results, operatorName },
        stage,
      );
      setRound(saved);
      setDirty(false);
      if (stage === 'validation') onSaved(saved);
      else if (stage === 'results') setStep(1);
      else notifySuccess(t('screeningRepeatDraftSaved'));
      return true;
    } catch {
      setFailed('screeningRepeatSaveFailed');
      return false;
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProcessingModal
      title={t('screeningRepeatNumber', { number: String(round.number - 1) })}
      steps={steps}
      step={step}
      completed={round.status === 'readyForValidation' ? [steps[0]] : []}
      finalized={false}
      saving={saving}
      errors={errors}
      failed={failed}
      saveErrorText={t('screeningRepeatSaveFailed')}
      onClose={onClose}
      onDraft={step === 0 ? () => save() : undefined}
      onSaveBeforeExit={async () => (!dirty ? 'unchanged' : (await save()) ? 'saved' : 'failed')}
      onAdvance={() => {
        void save(step === 0 ? 'results' : 'validation');
      }}
      onPrevious={() => {
        setStep(0);
        setErrors([]);
        setFailed('');
      }}
      advanceLabel={t(step === 0 ? 'next' : 'screeningValidateRepeat')}
      compactHeader
      t={t}
    >
      {step === 0 ? (
        <>
          <ScreeningIdentity record={record} t={t} />
          <div className={styles.fields}>
            <TextInput
              id="screening-repeat-origin"
              labelText={t('screeningPreviousReport')}
              value={screeningReportCode(record, round.number - 1)}
              readOnly
            />
            <TextInput id="screening-repeat-operator" labelText={t('performedBy')} value={operatorName} readOnly />
            <TextInput
              id="screening-repeat-time"
              labelText={t('performedOn')}
              value={formatScreeningCollectionTime(localDateTime(clock))}
              readOnly
            />
          </div>
          <Table className={screeningStyles.resultsTable} aria-label={t('screeningRepeatResults')}>
            <TableHead>
              <TableRow>
                <TableHeader scope="col">{t('screeningTestPerformed')}</TableHeader>
                <TableHeader scope="col">{t('result')}</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {screeningReportedTests(record, round).map(({ test, name, labelKey, result }) => (
                <TableRow key={test}>
                  <th scope="row">{name || t(labelKey)}</th>
                  <TableCell>
                    <ScreeningOutcomeField
                      name={`screening-repeat-${test}`}
                      label={name || t(labelKey)}
                      value={result ?? ''}
                      disabled={saving}
                      invalid={errors.includes(labelKey)}
                      onChange={(value) => {
                        setRound((current) => ({ ...current, results: { ...current.results, [test]: value } }));
                        setDirty(true);
                      }}
                      t={t}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      ) : (
        <>
          <ScreeningReport record={record} round={round} t={t} review />
          {record.unitCode && (
            <InlineNotification
              className={screeningStyles.screeningWarning}
              hideCloseButton
              kind="warning"
              lowContrast
              title={t('quarantine')}
              subtitle={t('screeningWarning')}
            />
          )}
        </>
      )}
    </ProcessingModal>
  );
}
