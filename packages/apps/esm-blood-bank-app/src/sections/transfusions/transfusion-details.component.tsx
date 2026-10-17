import { formatDatetime } from '@openmrs/esm-framework';
import type { ProcessingTranslate } from '../../shared/processing-page.component';
import { ProcessingTable } from '../../shared/processing-page.component';
import { inventoryDisplayDate } from '../inventory/inventory-rules';
import { componentDefinitions } from '../laboratory/fractionation/fractionation-rules';
import styles from './transfusions.scss';
import type { TransfusionRequest } from './transfusions.types';
import { priorityKeys, transfusionStatusKeys } from './transfusions-rules';

export function TransfusionDetails({
  request,
  t,
  history = false,
}: {
  request: TransfusionRequest;
  t: ProcessingTranslate;
  history?: boolean;
}) {
  const order = request.order;
  const details = {
    txNumber: order.number,
    txPatient: order.patientName,
    txHistoryNumber: order.historyNumber,
    document: order.document,
    txAge: order.age,
    txSex: t(order.sex === 'F' ? 'female' : 'male'),
    bloodGroup: order.bloodGroup,
    txService: order.service,
    txWard: order.ward,
    txBed: order.bed,
    txDiagnosis: order.diagnosis,
    txDoctor: order.orderer,
    txDoctorLicense: order.doctorLicense,
    txRequestedAt: formatDatetime(new Date(order.requestedAt), { noToday: true }),
    txPriority: t(priorityKeys[order.priority]),
    status: t(transfusionStatusKeys[request.status]),
    txHemoglobin: order.hemoglobin,
    txHematocrit: order.hematocrit,
    txPlateletCount: order.platelets,
    txPriorTransfusions: t(`tx${order.priorTransfusions}`),
    txPriorReactions: t(`tx${order.priorReactions}`),
    ...(order.sex === 'F'
      ? { txPregnancies: order.pregnancies, txAbortions: order.abortions, txMaternal: order.maternalIncompatibility }
      : {}),
  };
  return (
    <>
      <section className={styles.panel}>
        <h4>{t('txRequestDetails')}</h4>
        <dl className={styles.summary}>
          {Object.entries(details).map(([key, value]) => (
            <div key={key}>
              <dt>{t(key)}</dt>
              <dd>{value || '—'}</dd>
            </div>
          ))}
        </dl>
        <p>
          {t('txRequirement')}:{' '}
          {order.items.map((item) => `${item.quantity} × ${t(componentDefinitions[item.component].key)}`).join('; ')}
        </p>
      </section>
      {history && (
        <section className={styles.panel}>
          <h4>{t('txPatientHistory')}</h4>
          <ProcessingTable
            title={t('txPatientHistory')}
            columns={['date', 'fractionationComponent', 'inventoryUnitNumber', 'txReaction']}
            rows={order.history.map((item) => ({
              id: item.id,
              cells: [
                inventoryDisplayDate(item.date),
                t(componentDefinitions[item.component].key),
                item.unit,
                item.reaction,
              ],
            }))}
            loading={false}
            failed={false}
            reload={() => {}}
            emptyHelp={t('txNoPatientHistory')}
            t={t}
          />
        </section>
      )}
    </>
  );
}
