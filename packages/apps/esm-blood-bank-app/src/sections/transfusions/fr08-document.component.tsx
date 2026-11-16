import { Button, InlineNotification } from '@carbon/react';
import { Printer } from '@carbon/react/icons';
import { useState } from 'react';
import { formatListDate } from '../../shared/format-list-date';
import { printDocument, processingPrintCss } from '../../shared/print-document';
import type { ProcessingTranslate } from '../../shared/processing-page.component';
import hospitalLogo from '../collection/hospital-santa-clotilde.png';
import { componentDefinitions } from '../laboratory/fractionation/fractionation-rules';
import { transfusionBloodGroupLabel } from './transfusion-blood-group';
import styles from './transfusions.scss';
import type { TransfusionOrder } from './transfusions.types';

const fr08PrintCss = `${processingPrintCss}
  [data-fr08] header { display: flex; align-items: center; gap: 4mm; margin-bottom: 3mm; }
  [data-fr08] header img { width: 15mm; height: 15mm; object-fit: contain; }
  [data-fr08] h2 { margin: 0; text-align: start; font-size: 14pt; }
  [data-fr08] h3 { margin: 4mm 0 2mm; font-size: 10pt; }
  [data-fr08] dl { border: 1px solid #777; gap: 0; }
  [data-fr08] dl > div { padding: 2mm; border: 1px solid #aaa; }
  [data-fr08] dl > div:last-child:nth-child(odd) { grid-column: 1 / -1; }
  [data-fr08] th { text-align: start; }
  [data-fr08] footer { margin-top: 9mm; padding-top: 3mm; break-inside: avoid; }
`;

export function Fr08Document({ order, t }: { order: TransfusionOrder; t: ProcessingTranslate }) {
  const identification = {
    txSamplePatientName: order.patientName,
    txSampleHistoryNumber: order.historyNumber,
    txSex: t(order.sex === 'F' ? 'female' : 'male'),
    txAge: order.age,
    txReportBloodGroup: transfusionBloodGroupLabel(order.bloodGroup, t),
    txService: order.service,
    txWard: order.ward,
    txBed: order.bed,
  };
  const history = {
    txPriorTransfusions: t(`tx${order.priorTransfusions}`),
    txPriorReactions: t(`tx${order.priorReactions}`),
    ...(order.sex === 'F'
      ? { txPregnancies: order.pregnancies, txAbortions: order.abortions, txMaternal: order.maternalIncompatibility }
      : {}),
    txHemoglobin: order.hemoglobin,
    txHematocrit: order.hematocrit,
    txPlateletCount: order.platelets,
    txDiagnosis: order.diagnosis,
  };

  return (
    <article data-fr08 className={styles.fr08Document}>
      <header>
        <img src={hospitalLogo} alt={t('certificateHospital')} width={56} height={56} />
        <h2>{t('fr08Title')}</h2>
      </header>
      <dl>
        <div>
          <dt>{t('txReportRequestNumber')}</dt>
          <dd>{order.number}</dd>
        </div>
        <div>
          <dt>{t('txRequestedAt')}</dt>
          <dd>{formatListDate(order.requestedAt)}</dd>
        </div>
      </dl>
      {[
        ['fr08Recipient', identification],
        ['fr08Clinical', history],
      ].map(([heading, fields]) => (
        <section key={String(heading)}>
          <h3>{t(String(heading))}</h3>
          <dl>
            {Object.entries(fields).map(([label, value]) => (
              <div key={label}>
                <dt>{t(label)}</dt>
                <dd>{value || '—'}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
      <h3>{t('txRequirement')}</h3>
      <table aria-label={t('txRequirement')}>
        <thead>
          <tr>
            <th scope="col">{t('fractionationComponent')}</th>
            <th scope="col">{t('fr08Quantity')}</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map(({ component, quantity }) => (
            <tr key={component}>
              <td>{t(componentDefinitions[component].key)}</td>
              <td>{quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl>
        <div>
          <dt>{t('txDoctor')}</dt>
          <dd>{order.orderer}</dd>
        </div>
        <div>
          <dt>{t('txPriority')}</dt>
          <dd>{t('txScheduled')}</dd>
        </div>
      </dl>
      <footer>{t('fr08Signature')}</footer>
    </article>
  );
}

export function PrintFr08({ order, t }: { order: TransfusionOrder; t: ProcessingTranslate }) {
  const [failed, setFailed] = useState(false);
  const print = () => {
    setFailed(false);
    try {
      printDocument(<Fr08Document order={order} t={t} />, t('fr08Title'), () => setFailed(true), fr08PrintCss);
    } catch {
      setFailed(true);
    }
  };
  return (
    <>
      <Button kind="tertiary" size="sm" onClick={print} renderIcon={Printer}>
        {t('fr08Print')}
      </Button>
      {failed && <InlineNotification kind="error" hideCloseButton title={t('printFailed')} />}
    </>
  );
}
