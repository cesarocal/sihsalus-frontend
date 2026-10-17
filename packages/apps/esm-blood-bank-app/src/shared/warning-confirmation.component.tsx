import { Button, ComposedModal, ModalBody, ModalFooter, ModalHeader } from '@carbon/react';
import { WarningAltFilled } from '@carbon/react/icons';
import { useId, useLayoutEffect, useRef } from 'react';
import styles from './warning-confirmation.scss';

/** Presentation only: callers retain validation, atomic writes and submission guards. */
export function WarningConfirmation({
  title,
  description,
  items,
  note,
  cancelLabel,
  confirmLabel,
  closeLabel,
  saving,
  disabled = false,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  items: string[];
  note: string;
  cancelLabel: string;
  confirmLabel: string;
  closeLabel: string;
  saving: boolean;
  disabled?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const descriptionId = useId();
  const modalRef = useRef<HTMLDivElement>(null);
  // Carbon forwards label attributes but not aria-describedby to the dialog.
  // Scope the description link to this modal through its public DOM ref.
  useLayoutEffect(() => {
    const dialog = modalRef.current?.querySelector('[role="dialog"], dialog');
    dialog?.setAttribute('aria-describedby', descriptionId);
    return () => dialog?.removeAttribute('aria-describedby');
  }, [descriptionId]);
  // Carbon retains its initial Escape listener: always consult current save state.
  const closeState = useRef({ saving, onCancel });
  closeState.current = { saving, onCancel };
  const cancel = () => {
    if (!closeState.current.saving) closeState.current.onCancel();
    return false;
  };
  return (
    <ComposedModal
      open
      size="sm"
      className={styles.modal}
      preventCloseOnClickOutside
      aria-label={title}
      data-blood-bank-warning
      ref={modalRef}
      onClose={cancel}
    >
      <ModalHeader
        iconDescription={closeLabel}
        closeModal={cancel}
        title={
          <span className={styles.heading}>
            <WarningAltFilled size={28} className={styles.icon} aria-hidden="true" data-warning-icon />
            {title}
          </span>
        }
      />
      <ModalBody>
        <div className={styles.message} id={descriptionId}>
          <p>{description}</p>
          {!!items.length && (
            <ul>
              {items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
          <p className={styles.note}>{note}</p>
        </div>
      </ModalBody>
      <ModalFooter className={styles.footer}>
        <Button kind="secondary" size="sm" disabled={saving} onClick={cancel} data-modal-primary-focus>
          {cancelLabel}
        </Button>
        <Button size="sm" disabled={saving || disabled} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </ModalFooter>
    </ComposedModal>
  );
}
