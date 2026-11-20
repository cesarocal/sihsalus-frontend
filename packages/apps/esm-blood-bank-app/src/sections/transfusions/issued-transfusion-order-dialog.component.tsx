import {
  Button,
  Checkbox,
  ComposedModal,
  InlineNotification,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from '@carbon/react';
import { useRef, useState } from 'react';
import type { ProcessingTranslate } from '../../shared/processing-page.component';
import { Fr08Document, PrintFr08 } from './fr08-document.component';
import type { IssuedTransfusionOrder, TransfusionOrderConfig } from './transfusion-order.resource';
import styles from './transfusions.scss';
import type { TransfusionOrder } from './transfusions.types';
import { useTransfusionReceipt } from './use-transfusion-receipt';

export function IssuedTransfusionOrderDialog({
  order,
  config,
  issued,
  attend,
  onClose,
  t,
}: {
  order: TransfusionOrder;
  config?: TransfusionOrderConfig;
  issued?: IssuedTransfusionOrder;
  attend: boolean;
  onClose: () => void;
  t: ProcessingTranslate;
}) {
  const [verified, setVerified] = useState(false);
  const receipt = useTransfusionReceipt(attend ? config : undefined, issued);
  const closeGuard = useRef({ saving: receipt.saving, onClose });
  closeGuard.current = { saving: receipt.saving, onClose };
  const title = attend ? t('txRequestTitle') : t('fr08Title');

  return (
    <ComposedModal
      open
      size="lg"
      aria-label={title}
      className={styles.modal}
      preventCloseOnClickOutside
      onClose={() => {
        if (closeGuard.current.saving) return false;
        closeGuard.current.onClose();
      }}
    >
      <ModalHeader title={`${title} · ${order.number}`} iconDescription={t('close')} />
      <ModalBody>
        {attend && <h3>{t('txReview')}</h3>}
        {receipt.failed && <InlineNotification kind="error" hideCloseButton title={t('fr08ReceiveFailed')} />}
        <Fr08Document order={order} t={t} />
        {receipt.canReceive && (
          <Checkbox
            id="fr08-verify-receipt"
            labelText={t('fr08VerifyReceipt')}
            checked={verified}
            disabled={receipt.saving}
            onChange={(_event, { checked }) => setVerified(checked)}
          />
        )}
      </ModalBody>
      <ModalFooter className={styles.fr08Footer}>
        {!attend && <PrintFr08 order={order} t={t} label={t('fr08PrintForm')} />}
        <Button kind="secondary" disabled={receipt.saving} onClick={onClose}>
          {t('close')}
        </Button>
        {receipt.canReceive && (
          <Button disabled={!verified || receipt.saving} onClick={() => void receipt.register()}>
            {t('fr08Receive')}
          </Button>
        )}
      </ModalFooter>
    </ComposedModal>
  );
}
