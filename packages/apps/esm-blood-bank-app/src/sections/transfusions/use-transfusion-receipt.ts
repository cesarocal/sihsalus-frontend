import { useConfig, userHasAccess, useSession } from '@openmrs/esm-framework';
import { useRef, useState } from 'react';
import type { BloodBankConfig } from '../../config-schema';
import { closesTransfusion, listConsent, recipientConsentSubject } from '../consents/paper-consent.resource';
import { notifySuccess } from '../../shared/notify-success';
import {
  type IssuedTransfusionOrder,
  receiveTransfusionOrder,
  type TransfusionOrderConfig,
  transfusionOrdersChanged,
} from './transfusion-order.resource';
import { useTransfusionsTranslation } from './use-transfusions-translation';

export function useTransfusionReceipt(config?: TransfusionOrderConfig, issued?: IssuedTransfusionOrder) {
  const { authenticated, user } = useSession();
  const t = useTransfusionsTranslation();
  const { paperConsent } = useConfig<BloodBankConfig>();
  const [state, setState] = useState<'idle' | 'saving' | 'failed' | 'received'>('idle');
  const inFlight = useRef(false);
  const received = state === 'received' || issued?.fulfillerStatus === 'RECEIVED';
  const canReceive = Boolean(
    config &&
      issued &&
      !issued.stopped &&
      !issued.fulfillerStatus &&
      !received &&
      authenticated &&
      userHasAccess('Edit Orders', user),
  );

  const register = async () => {
    if (!canReceive || !config || !issued || inFlight.current) return;
    inFlight.current = true;
    setState('saving');
    try {
      if (paperConsent) {
        const [latest] = await listConsent(paperConsent, recipientConsentSubject(issued.order));
        if (closesTransfusion(latest?.decision)) throw new Error('CONSENT_REQUEST_CLOSED');
      }
      await receiveTransfusionOrder(config, issued.order.id);
      setState('received');
      notifySuccess(t('fr08ReceiptRegistered'));
      window.dispatchEvent(new Event(transfusionOrdersChanged));
    } catch {
      setState('failed');
    } finally {
      inFlight.current = false;
    }
  };

  return { canReceive, received, saving: state === 'saving', failed: state === 'failed' && !received, register };
}
