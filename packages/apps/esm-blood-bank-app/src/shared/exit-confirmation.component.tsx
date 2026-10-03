import {
  Button,
  Checkbox,
  ComposedModal,
  InlineNotification,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from '@carbon/react';
import { useId, useState } from 'react';
import styles from '../sections/applicant-selection/selection.scss';

interface ExitConfirmationProps {
  title: string;
  description: string;
  closeLabel: string;
  saving: boolean;
  t: (key: string) => string;
  onCancel: () => void;
  onSave: () => Promise<boolean>;
  onExit: (saved: boolean) => void;
}

/** Mount on each close request so saving is always the default choice. */
export function ExitConfirmation({
  title,
  description,
  closeLabel,
  saving,
  t,
  onCancel,
  onSave,
  onExit,
}: ExitConfirmationProps) {
  const checkboxId = useId();
  const [saveBeforeExit, setSaveBeforeExit] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);
  const busy = saving || submitting;
  const cancel = () => {
    if (!busy) onCancel();
    return false;
  };
  const leave = async () => {
    if (busy) return;
    if (!saveBeforeExit) {
      onExit(false);
      return;
    }
    setSubmitting(true);
    setFailed(false);
    try {
      if (await onSave()) onExit(true);
      else onCancel(); // The workflow displays its save error and keeps all inputs.
    } catch {
      setFailed(true); // Do not close or expose technical details on an unexpected rejection.
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <ComposedModal open size="sm" preventCloseOnClickOutside onClose={cancel} aria-label={title}>
      <ModalHeader title={title} iconDescription={closeLabel} closeModal={cancel} />
      <ModalBody>
        <p>{description}</p>
        <div className={styles.exitOptions}>
          <Checkbox
            id={checkboxId}
            labelText={t('saveBeforeExit')}
            checked={saveBeforeExit}
            disabled={busy}
            onChange={(_event, { checked }) => setSaveBeforeExit(checked)}
          />
        </div>
        {failed && <InlineNotification hideCloseButton kind="error" title={t('saveFailed')} />}
      </ModalBody>
      <ModalFooter>
        <Button type="button" kind="secondary" disabled={busy} onClick={cancel}>
          {t('keepEditing')}
        </Button>
        <Button
          type="button"
          kind={saveBeforeExit ? 'primary' : 'danger'}
          disabled={busy}
          onClick={() => {
            void leave();
          }}
        >
          {busy ? t('saving') : t('leave')}
        </Button>
      </ModalFooter>
    </ComposedModal>
  );
}
