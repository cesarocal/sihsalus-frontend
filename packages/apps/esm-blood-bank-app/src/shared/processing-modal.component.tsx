import {
  Button,
  ComposedModal,
  InlineNotification,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ProgressIndicator,
  ProgressStep,
} from '@carbon/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ProcessingTranslate } from './processing-page.component';
import { ExitConfirmation } from './exit-confirmation.component';
import styles from '../sections/applicant-selection/selection.scss';

export function ProcessingModal({
  title,
  steps,
  step,
  completed,
  finalized,
  saving,
  errors,
  failed,
  onClose,
  onDraft,
  onAdvance,
  onPrevious,
  advanceLabel,
  advanceDisabled = false,
  children,
  extraActions,
  t,
}: {
  title: string;
  steps: readonly string[];
  step: number;
  completed: string[];
  finalized: boolean;
  saving: boolean;
  errors: string[];
  failed: string;
  onClose: () => void;
  onDraft: () => Promise<boolean>;
  onAdvance: () => void;
  onPrevious: () => void;
  advanceLabel: string;
  advanceDisabled?: boolean;
  children: ReactNode;
  extraActions?: ReactNode;
  t: ProcessingTranslate;
}) {
  const [confirm, setConfirm] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (errors.length) errorRef.current?.focus();
  }, [errors]);
  useEffect(() => {
    if (finalized) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [finalized]);
  const requestClose = () => {
    if (saving) return false;
    if (finalized) onClose();
    else setConfirm(true);
    return false;
  };
  return (
    <>
      <ComposedModal
        open
        size="lg"
        className={styles.workflow}
        onClose={requestClose}
        preventCloseOnClickOutside
        aria-label={title}
      >
        <ModalHeader title={title} iconDescription={t('close')} closeModal={requestClose}>
          <div className={styles.progress}>
            <ProgressIndicator currentIndex={step} spaceEqually>
              {steps.map((key) => (
                <ProgressStep key={key} label={t(key)} complete={completed.includes(key)} />
              ))}
            </ProgressIndicator>
          </div>
        </ModalHeader>
        <ModalBody>
          {failed && <InlineNotification hideCloseButton kind="error" title={t(failed)} />}
          {!!errors.length && (
            <div className={styles.errors} tabIndex={-1} ref={errorRef} role="alert" aria-label={t('requiredFields')}>
              <h3>{t('requiredFields')}</h3>
              <ul>
                {errors.map((key) => (
                  <li key={key}>{t(key)}</li>
                ))}
              </ul>
            </div>
          )}
          <div className={styles.stepHeading}>
            <h3>{t(steps[step])}</h3>
          </div>
          {children}
        </ModalBody>
        <ModalFooter className={styles.footer}>
          <div>{extraActions}</div>
          <div>
            {step > 0 && (
              <Button kind="secondary" disabled={saving} onClick={onPrevious}>
                {t('previous')}
              </Button>
            )}
            {!finalized && (
              <Button
                kind="tertiary"
                disabled={saving}
                onClick={() => {
                  void onDraft();
                }}
              >
                {t('saveDraft')}
              </Button>
            )}
            {finalized && step === steps.length - 1 ? (
              <Button onClick={onClose}>{t('close')}</Button>
            ) : (
              <Button disabled={saving || advanceDisabled} onClick={onAdvance}>
                {saving ? t('saving') : advanceLabel}
              </Button>
            )}
          </div>
        </ModalFooter>
      </ComposedModal>
      {confirm && (
        <ExitConfirmation
          title={t('exitTitle')}
          description={t('exitHelp')}
          closeLabel={t('close')}
          saving={saving}
          t={t}
          onCancel={() => setConfirm(false)}
          onSave={onDraft}
          onExit={() => onClose()}
        />
      )}
    </>
  );
}
