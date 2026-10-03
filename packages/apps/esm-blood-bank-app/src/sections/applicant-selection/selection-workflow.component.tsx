import {
  Button,
  ComposedModal,
  InlineLoading,
  InlineNotification,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ProgressIndicator,
  ProgressStep,
  TextArea,
} from '@carbon/react';
import { Printer } from '@carbon/react/icons';
import { useEffect, useRef, useState } from 'react';
import type { ApplicantSelectionApi } from '../../api/applicant-selection.api';
import { hasActiveExclusion, isFinal, physicalWarnings, validateFinal, validateStep } from './selection-rules';
import { printSelectionReport, SelectionReport } from './selection-report.component';
import { SelectionStageFields } from './selection-stage-fields.component';
import { notifySuccess } from '../../shared/notify-success';
import { ExitConfirmation, type ExitSaveResult } from '../../shared/exit-confirmation.component';
import {
  selectionSteps,
  type ApplicantHistory,
  type SelectionApplication,
  type SelectionTranslate,
} from './selection.types';
import styles from './selection.scss';

interface WorkflowProps {
  application: SelectionApplication;
  api: ApplicantSelectionApi;
  onClose: () => void;
  onSaved: (message: string) => void;
  t: SelectionTranslate;
}

export function SelectionWorkflow({ application, api, onClose, onSaved, t }: WorkflowProps) {
  const [data, setData] = useState(application);
  const [step, setStep] = useState(
    isFinal(application)
      ? 5
      : application.status === 'awaitingInterview'
        ? 0
        : application.stoppedAfterPhysical
          ? Math.max(4, Math.min(application.completedSteps.length + 1, 5))
          : Math.min(application.completedSteps.length, 5),
  );
  const [history, setHistory] = useState<ApplicantHistory | null>(null);
  const [lookup, setLookup] = useState<'pending' | 'ready' | 'error'>('pending');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [closeRequested, setCloseRequested] = useState(false);
  const [warningsOpen, setWarningsOpen] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [dirty, setDirty] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const currentData = useRef(data);
  currentData.current = data;
  const finalized = isFinal(data);
  const locked = finalized || (step < 3 && data.completedSteps.includes('physical'));
  const stage = selectionSteps[step];

  const change = (next: SelectionApplication) => {
    const identityChanged = ['documentType', 'documentNumber', 'donorCode'].some(
      (key) =>
        next.admission[key as keyof typeof next.admission] !== data.admission[key as keyof typeof data.admission],
    );
    setData(identityChanged ? { ...next, patientUuid: undefined } : next);
    if (identityChanged) {
      setHistory(null);
      setLookup('pending');
    }
    setDirty(true);
    setErrors([]);
  };

  useEffect(() => {
    if (finalized) return;
    let active = true;
    setLookup('pending');
    setHistory(null);
    const timer = setTimeout(() => {
      void api
        .lookupApplicant({
          documentType: data.admission.documentType,
          documentNumber: data.admission.documentNumber,
          donorCode: data.admission.donorCode,
        })
        .then((found) => {
          if (!active) return;
          setHistory(found);
          setLookup('ready');
          const current = currentData.current;
          if (
            found?.personal &&
            !found.identityConflict &&
            !current.completedSteps.includes('physical') &&
            !current.personal.givenName
          ) {
            setData({
              ...current,
              patientUuid: found.patientUuid,
              personal: structuredClone(found.personal),
              admission: {
                ...current.admission,
                ...(current.admission.documentNumber
                  ? {}
                  : {
                      documentNumber: found.documentNumber ?? '',
                      documentType: found.documentType ?? current.admission.documentType,
                    }),
              },
            });
            setDirty(true);
          }
        })
        .catch(() => {
          if (active) setLookup('error');
        });
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [api, data.admission.documentType, data.admission.documentNumber, data.admission.donorCode, finalized]);

  useEffect(() => {
    const preventLoss = (event: BeforeUnloadEvent) => {
      if (!finalized) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', preventLoss);
    return () => window.removeEventListener('beforeunload', preventLoss);
  }, [finalized]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: moving to a different step must announce its heading.
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);
  useEffect(() => {
    if (errors.length) errorRef.current?.focus();
  }, [errors]);

  const persist = async (mode: 'draft' | 'stage' | 'final', next = data) => {
    setSaving(true);
    setErrors([]);
    try {
      const saved =
        mode === 'draft'
          ? await api.saveDraft(next)
          : mode === 'stage'
            ? await api.completeStep(next, stage)
            : await api.finalizeSelection(next);
      setData(saved);
      setDirty(false);
      return saved;
    } catch {
      setErrors(['saveFailed']);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const continueStep = async () => {
    if (locked) {
      setStep(step === 2 && data.stoppedAfterPhysical ? 4 : step + 1);
      return;
    }
    const problems = stage === 'review' ? validateFinal(data) : validateStep(data, stage);
    if (
      stage === 'admission' &&
      (lookup !== 'ready' || history?.identityConflict || (data.admission.donorCode.trim() && !history))
    )
      problems.push(lookup === 'error' ? 'historyFailed' : 'checkIdentity');
    if (
      (stage === 'qualification' || stage === 'review') &&
      data.qualification.result === 'eligible' &&
      hasActiveExclusion(history, data.admission.date)
    )
      problems.push('activeExclusionBlocks');
    if (problems.length) {
      setErrors(problems);
      return;
    }
    if (stage === 'physical' && physicalWarnings(data).length) {
      setWarningsOpen(true);
      return;
    }
    const next =
      stage === 'personal'
        ? {
            ...data,
            qualification: {
              ...data.qualification,
              applicantName: `${data.personal.givenName} ${data.personal.familyName}`.trim(),
            },
          }
        : data;
    const saved = await persist(stage === 'review' ? 'final' : 'stage', next);
    if (!saved) return;
    if (stage === 'physical' || stage === 'review')
      onSaved(
        stage === 'physical' ? 'readyForInterview' : saved.status === 'selected' ? 'selectionSaved' : 'exclusionSaved',
      );
    else {
      const message =
        stage === 'admission'
          ? data.id
            ? 'admissionUpdated'
            : 'admissionCreated'
          : stage === 'personal'
            ? 'personalSaved'
            : stage === 'interview'
              ? 'interviewSaved'
              : 'qualificationSaved';
      notifySuccess(t(message));
      setStep(step + 1);
    }
  };

  const resolvePhysical = async (continueInterview: boolean) => {
    if (continueInterview && !reviewNotes.trim()) return;
    const next = {
      ...data,
      stoppedAfterPhysical: !continueInterview,
      physical: { ...data.physical, warningAcknowledgement: continueInterview ? reviewNotes.trim() : '' },
      qualification: { ...data.qualification, ...(continueInterview ? {} : { result: 'temporary' as const }) },
    };
    const saved = await persist('stage', next);
    if (!saved) return;
    setWarningsOpen(false);
    if (continueInterview) onSaved('readyForInterview');
    else {
      notifySuccess(t('physicalStopped'));
      setStep(4);
    }
  };

  const requestClose = () => {
    if (saving) return false;
    if (finalized) onClose();
    else setCloseRequested(true);
    // Carbon must keep the original dialog open while confirmation is shown.
    return false;
  };

  const saveBeforeExit = async (): Promise<ExitSaveResult> => {
    if (!dirty && data.id) return 'unchanged';
    return (await persist('draft')) ? 'saved' : 'failed';
  };

  const finishExit = (result: Exclude<ExitSaveResult, 'failed'> | 'discarded') => {
    if (result === 'saved') onSaved(data.id ? 'draftUpdated' : 'draftCreated');
    else onClose();
  };

  return (
    <>
      <ComposedModal
        open
        size="lg"
        aria-label={finalized ? t('viewApplication') : t('applicationForm')}
        className={styles.workflow}
        onClose={requestClose}
        preventCloseOnClickOutside
      >
        <ModalHeader
          title={`${finalized ? t('viewApplication') : t('applicationForm')}${data.number ? ` · ${data.number}` : ''}`}
          iconDescription={t('closeProcess')}
        >
          <ProgressIndicator
            currentIndex={step}
            spaceEqually
            className={styles.progress}
            onChange={(index) => {
              if (
                !saving &&
                !(data.stoppedAfterPhysical && index === 3) &&
                (finalized || index <= step || data.completedSteps.includes(selectionSteps[index]))
              )
                setStep(index);
            }}
          >
            {selectionSteps.map((name, index) => (
              <ProgressStep
                key={name}
                label={t(name)}
                translateWithId={(id) => t(id.split('.').pop() ?? id)}
                complete={data.completedSteps.includes(name)}
                disabled={
                  (data.stoppedAfterPhysical && index === 3) ||
                  (!finalized && index > step && !data.completedSteps.includes(name))
                }
              />
            ))}
          </ProgressIndicator>
        </ModalHeader>
        <ModalBody hasForm>
          <div className={styles.stepHeading}>
            <h3 tabIndex={-1} ref={headingRef}>
              {t(stage)}
            </h3>
            {locked && <p>{t('readOnlyStage')}</p>}
          </div>
          {errors.length > 0 && (
            <div role="alert" aria-label={t('checkForm')} tabIndex={-1} ref={errorRef} className={styles.errors}>
              <strong>{t('checkForm')}</strong>
              <ul>
                {errors.map((key) => (
                  <li key={key}>{t(key)}</li>
                ))}
              </ul>
            </div>
          )}
          {!finalized && lookup === 'error' && (
            <InlineNotification hideCloseButton kind="error" title={t('historyFailed')} />
          )}
          {!finalized && history?.identityConflict && (
            <InlineNotification hideCloseButton kind="error" title={t('identityConflict')} />
          )}
          {!finalized && history?.exclusion && (
            <InlineNotification
              hideCloseButton
              kind={hasActiveExclusion(history, data.admission.date) ? 'warning' : 'info'}
              title={history.exclusion.kind === 'permanent' ? t('priorPermanent') : t('priorTemporary')}
              subtitle={
                history.exclusion.returnDate
                  ? `${t('returnDate')}: ${history.exclusion.returnDate}. ${t('exclusionNoCause')}`
                  : t('permanentPeriod')
              }
            />
          )}
          {stage === 'admission' && !locked && (
            <p className={styles.help}>{lookup === 'pending' ? t('checkingHistory') : t('admissionHelp')}</p>
          )}
          {stage === 'personal' && !locked && history?.personal && !history.identityConflict && (
            <Button
              type="button"
              kind="tertiary"
              disabled={saving}
              onClick={() =>
                change({
                  ...data,
                  patientUuid: history.patientUuid,
                  personal: structuredClone(history.personal ?? data.personal),
                })
              }
            >
              {t('loadDonorProfile')}
            </Button>
          )}
          {stage === 'review' ? (
            <SelectionReport application={data} t={t} />
          ) : (
            <SelectionStageFields application={data} stage={stage} readOnly={locked || saving} update={change} t={t} />
          )}
        </ModalBody>
        <ModalFooter className={styles.footer}>
          <div>
            <Button
              type="button"
              kind="ghost"
              disabled={step === 0 || saving}
              onClick={() => setStep(step === 4 && data.stoppedAfterPhysical ? 2 : step - 1)}
            >
              {t('previous')}
            </Button>
            {(stage === 'review' || finalized) && (
              <Button type="button" kind="tertiary" renderIcon={Printer} onClick={() => printSelectionReport(data, t)}>
                {t('printForm')}
              </Button>
            )}
          </div>
          <div>
            {!finalized && (
              <Button
                type="button"
                kind="secondary"
                disabled={saving || locked}
                onClick={async () => {
                  const result = await saveBeforeExit();
                  if (result !== 'failed') finishExit(result);
                }}
              >
                {t('saveAndExit')}
              </Button>
            )}
            {finalized ? (
              <Button type="button" onClick={onClose}>
                {t('backToList')}
              </Button>
            ) : (
              <Button
                type="button"
                disabled={saving}
                onClick={() => {
                  void continueStep();
                }}
              >
                {stage === 'review'
                  ? t('saveSelection')
                  : stage === 'physical' && !locked
                    ? t('finishPhysical')
                    : t('saveAndContinue')}
              </Button>
            )}
          </div>
          {saving && <InlineLoading description={t('saving')} />}
        </ModalFooter>
      </ComposedModal>
      {closeRequested && (
        <ExitConfirmation
          title={t('leaveTitle')}
          description={t('leaveExplanation')}
          closeLabel={t('closeConfirmation')}
          saving={saving}
          saveErrorText={t('saveFailed')}
          t={t}
          onCancel={() => setCloseRequested(false)}
          onSave={saveBeforeExit}
          onExit={finishExit}
        />
      )}
      <ComposedModal
        open={warningsOpen}
        size="md"
        aria-label={t('physicalWarningTitle')}
        onClose={() => setWarningsOpen(false)}
        preventCloseOnClickOutside
      >
        <ModalHeader title={t('physicalWarningTitle')} iconDescription={t('reviewValues')} />
        <ModalBody hasForm>
          <p>{t('physicalWarningExplanation')}</p>
          <ul className={styles.warningList}>
            {physicalWarnings(data).map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
          <TextArea
            id="selection-reviewNotes"
            labelText={t('clinicalReviewNotes')}
            value={reviewNotes}
            onChange={(event) => setReviewNotes(event.target.value)}
            rows={3}
          />
          <div className={styles.confirmActions}>
            <Button type="button" kind="tertiary" disabled={saving} onClick={() => setWarningsOpen(false)}>
              {t('reviewValues')}
            </Button>
            <Button
              type="button"
              kind="secondary"
              disabled={saving}
              onClick={() => {
                void resolvePhysical(false);
              }}
            >
              {t('stopProcess')}
            </Button>
            <Button
              type="button"
              disabled={saving || !reviewNotes.trim()}
              onClick={() => {
                void resolvePhysical(true);
              }}
            >
              {t('continueInterview')}
            </Button>
          </div>
        </ModalBody>
      </ComposedModal>
    </>
  );
}
