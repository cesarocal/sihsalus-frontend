import {
  Button,
  Checkbox,
  ComposedModal,
  InlineNotification,
  ModalBody,
  ModalFooter,
  ModalHeader,
  TextArea,
} from '@carbon/react';
import { Printer } from '@carbon/react/icons';
import { useRef, useState } from 'react';
import type { ProcessingTranslate } from '../../shared/processing-page.component';
import type { InventoryOperation } from './inventory.types';
import { qualitySealCode } from './inventory-rules';
import styles from './inventory.scss';

export function QualitySealReprintDialog({
  operation,
  eligibleIds,
  operator,
  loadingOperator = false,
  onRetryOperator,
  onClose,
  onPrint,
  t,
}: {
  operation: InventoryOperation;
  eligibleIds: string[];
  operator: string;
  loadingOperator?: boolean;
  onRetryOperator?: () => void;
  onClose: () => void;
  onPrint: (unitIds: string[], reason: string) => Promise<boolean>;
  t: ProcessingTranslate;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const inFlight = useRef(false);
  const close = () => {
    if (!inFlight.current) onClose();
    return false;
  };
  const unitIds = selected.filter((id) => eligibleIds.includes(id));
  return (
    <ComposedModal
      open
      size="sm"
      preventCloseOnClickOutside
      data-blood-bank-warning
      aria-label={t('inventoryReprintTitle')}
      onClose={close}
    >
      <ModalHeader title={t('inventoryReprintTitle')} iconDescription={t('close')} closeModal={close} />
      <ModalBody>
        <p>{t('inventoryReprintHelp')}</p>
        <fieldset className={styles.checks}>
          <legend>{t('inventorySelectUnits')}</legend>
          {operation.units
            .filter((unit) => eligibleIds.includes(unit.id))
            .map((unit) => (
              <Checkbox
                key={unit.id}
                id={`inventory-reprint-${unit.id}`}
                labelText={`${unit.id} · ${qualitySealCode(operation, unit.id)}`}
                checked={selected.includes(unit.id)}
                disabled={saving}
                onChange={(_event, { checked }) =>
                  setSelected((current) => (checked ? [...current, unit.id] : current.filter((id) => id !== unit.id)))
                }
              />
            ))}
        </fieldset>
        {!eligibleIds.length && <p>{t('inventoryNoReprintUnits')}</p>}
        <TextArea
          id="inventory-reprint-reason"
          labelText={t('inventoryReprintReason')}
          value={reason}
          rows={3}
          disabled={saving}
          onChange={(event) => setReason(event.target.value)}
        />
        {loadingOperator && <p role="status">{t('inventoryOperatorLoading')}</p>}
        {((!loadingOperator && !operator) || failed) && (
          <InlineNotification
            hideCloseButton
            kind="error"
            title={t(!operator ? 'inventoryOperatorUnavailable' : 'inventorySaveFailed')}
          />
        )}
        {!operator && !loadingOperator && onRetryOperator && (
          <Button kind="ghost" size="sm" onClick={onRetryOperator}>
            {t('retry')}
          </Button>
        )}
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" size="sm" disabled={saving} onClick={close}>
          {t('inventoryCancel')}
        </Button>
        <Button
          size="sm"
          renderIcon={Printer}
          disabled={saving || !operator || !reason.trim() || !unitIds.length}
          onClick={async () => {
            if (inFlight.current) return;
            inFlight.current = true;
            setSaving(true);
            setFailed(false);
            try {
              if (await onPrint(unitIds, reason)) onClose();
              else setFailed(true);
            } finally {
              inFlight.current = false;
              setSaving(false);
            }
          }}
        >
          {t(saving ? 'saving' : unitIds.length > 1 ? 'inventoryPrintSeals' : 'inventoryPrintSeal')}
        </Button>
      </ModalFooter>
    </ComposedModal>
  );
}
