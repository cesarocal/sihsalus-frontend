import {
  Button,
  Checkbox,
  ComposedModal,
  InlineNotification,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Tag,
} from '@carbon/react';
import { Renew } from '@carbon/react/icons';
import { useConfig, userHasAccess, useSession } from '@openmrs/esm-framework';
import { useCallback, useEffect, useRef, useState } from 'react';
import { bloodBankPrivileges } from '../../access/blood-bank-privileges';
import type { BloodBankConfig } from '../../config-schema';
import { formatListDate } from '../../shared/format-list-date';
import { ProcessingTable, useProcessingData } from '../../shared/processing-page.component';
import { Fr08Document, PrintFr08 } from './fr08-document.component';
import {
  configuredTransfusionOrders,
  type IssuedTransfusionOrder,
  issuedOrderStatus,
  listIssuedTransfusionOrders,
  receiveTransfusionOrder,
  type TransfusionOrderConfig,
  transfusionOrdersChanged,
} from './transfusion-order.resource';
import styles from './transfusions.scss';
import { useTransfusionsTranslation } from './use-transfusions-translation';

const bankRead = [bloodBankPrivileges.module, bloodBankPrivileges.transfusions, 'Get Orders'];
const chartRead = ['app:hoja.clinica.ordenes', 'Get Orders'];
type OrderPerspective = { patientUuid: string; bank?: false } | { bank: true; patientUuid?: never };

export function IssuedTransfusionOrders({
  config,
  ...perspective
}: { config: TransfusionOrderConfig } & OrderPerspective) {
  const { user, authenticated } = useSession();
  if (!authenticated || !userHasAccess(perspective.bank ? bankRead : chartRead, user)) return null;
  return <OrderList key={perspective.patientUuid ?? 'bank'} config={config} {...perspective} />;
}

function OrderList({ config, patientUuid, bank }: { config: TransfusionOrderConfig } & OrderPerspective) {
  const t = useTransfusionsTranslation();
  const session = useSession();
  const load = useCallback(() => listIssuedTransfusionOrders(config, patientUuid), [config, patientUuid]);
  const { data, loading, failed, reload } = useProcessingData(load);
  const [selectedId, setSelectedId] = useState<string>();
  const [verified, setVerified] = useState(false);
  const [saving, setSaving] = useState(false);
  const [receiveFailed, setReceiveFailed] = useState(false);
  const updating = useRef(false);
  const selected = data?.find(({ order }) => order.id === selectedId);
  const canReceive = Boolean(
    bank &&
      selected &&
      !selected.stopped &&
      !selected.fulfillerStatus &&
      session.authenticated &&
      userHasAccess([...bankRead, 'Edit Orders'], session.user),
  );

  useEffect(() => {
    window.addEventListener(transfusionOrdersChanged, reload);
    window.addEventListener('focus', reload);
    return () => {
      window.removeEventListener(transfusionOrdersChanged, reload);
      window.removeEventListener('focus', reload);
    };
  }, [reload]);

  const open = ({ order }: IssuedTransfusionOrder) => {
    setVerified(false);
    setReceiveFailed(false);
    setSelectedId(order.id);
  };
  const receive = async () => {
    if (!canReceive || !verified || !selected || updating.current) return;
    updating.current = true;
    setSaving(true);
    setReceiveFailed(false);
    try {
      await receiveTransfusionOrder(config, selected.order.id);
      setSelectedId(undefined);
      window.dispatchEvent(new Event(transfusionOrdersChanged));
    } catch {
      setReceiveFailed(true);
    } finally {
      updating.current = false;
      setSaving(false);
    }
  };
  return (
    <section className={styles.fr08List}>
      <div className={styles.fr08ListHeading}>
        <h2>{t('fr08Orders')}</h2>
        <Button kind="tertiary" size="sm" renderIcon={Renew} disabled={loading || saving} onClick={reload}>
          {t('fr08Refresh')}
        </Button>
      </div>
      <ProcessingTable
        title={t('fr08Orders')}
        columns={['txNumber', 'txRequestedAt', ...(bank ? ['txPatient', 'txHistoryNumber'] : []), 'status', 'actions']}
        rows={(data ?? []).map((entry) => ({
          id: entry.order.id,
          cells: [
            entry.order.number,
            formatListDate(entry.order.requestedAt),
            ...(bank ? [entry.order.patientName, entry.order.historyNumber] : []),
            <Tag key="state" type={entry.fulfillerStatus === 'COMPLETED' ? 'green' : 'blue'}>
              {t(issuedOrderStatus(entry))}
            </Tag>,
            <Button key="detail" kind="ghost" size="sm" onClick={() => open(entry)}>
              {t('fr08Open')}
            </Button>,
          ],
        }))}
        loading={loading}
        failed={failed}
        reload={reload}
        emptyHelp={t('fr08Empty')}
        t={t}
      />
      {selected && (
        <ComposedModal
          open
          size="lg"
          aria-label={t('fr08Title')}
          className={styles.modal}
          onClose={() => {
            if (!saving) setSelectedId(undefined);
          }}
        >
          <ModalHeader title={`${t('fr08Title')} · ${selected.order.number}`} />
          <ModalBody>
            {receiveFailed && <InlineNotification kind="error" hideCloseButton title={t('fr08ReceiveFailed')} />}
            <Fr08Document order={selected.order} t={t} />
            {canReceive && (
              <Checkbox
                id="fr08-verify-receipt"
                labelText={t('fr08VerifyReceipt')}
                checked={verified}
                disabled={saving}
                onChange={(_event, { checked }) => setVerified(checked)}
              />
            )}
          </ModalBody>
          <ModalFooter className={styles.fr08Footer}>
            <PrintFr08 order={selected.order} t={t} />
            <Button kind="secondary" disabled={saving} onClick={() => setSelectedId(undefined)}>
              {t('close')}
            </Button>
            {canReceive && (
              <Button disabled={!verified || saving} onClick={() => void receive()}>
                {t('fr08Receive')}
              </Button>
            )}
          </ModalFooter>
        </ComposedModal>
      )}
    </section>
  );
}

export function PatientTransfusionOrders({ patientUuid }: { patientUuid?: string }) {
  const { enabled, transfusionOrders } = useConfig<BloodBankConfig>();
  if (!enabled || !patientUuid || !configuredTransfusionOrders(transfusionOrders)) return null;
  return <IssuedTransfusionOrders config={transfusionOrders} patientUuid={patientUuid} />;
}
