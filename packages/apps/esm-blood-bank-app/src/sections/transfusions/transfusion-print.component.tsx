import { formatDatetime } from '@openmrs/esm-framework';
import { processingPrintCss } from '../../shared/print-document';
import type { ProcessingTranslate } from '../../shared/processing-page.component';
import hospitalLogo from '../collection/hospital-santa-clotilde.png';
import { inventoryDisplayDate, inventoryUnitSealCode } from '../inventory/inventory-rules';
import { componentDefinitions } from '../laboratory/fractionation/fractionation-rules';
import { transfusionBloodGroupLabel } from './transfusion-blood-group';
import styles from './transfusions.scss';
import type { CompatibilityRound, RecipientSample, TransfusionRequest } from './transfusions.types';

export const transfusionLabelPrintCss = `${processingPrintCss}
  [data-label] { box-sizing: border-box; margin-block: 0 3mm; break-inside: avoid; }
  [data-label] header { display: flex; align-items: center; gap: 3mm; }
  [data-label] header img { width: 12mm; height: 12mm; object-fit: contain; }
  [data-label] header h2 { margin: 0; font-size: 12pt; text-align: start; }
  [data-label] p { margin: 1.5mm 0; }
`;

export function TransfusionLabels({
  request,
  sample,
  round,
  t,
}: {
  request: TransfusionRequest;
  sample: RecipientSample;
  round?: CompatibilityRound;
  t: ProcessingTranslate;
}) {
  const labels = [
    {
      code: sample.code,
      name: request.order.patientName,
      historyNumber: sample.historyNumber,
      bloodGroup: request.order.bloodGroup,
      seal: '',
      date: sample.collectedAt,
      operator: sample.collectedBy,
    },
    ...request.assignments
      .filter((item) => item.roundId === round?.id && !!item.unitSampleCode)
      .map((item) => ({
        code: item.unitSampleCode ?? '',
        name: item.unit.id,
        historyNumber: '',
        bloodGroup: item.unit.bloodGroup,
        seal: inventoryUnitSealCode(item.unit),
        date: item.assignedAt,
        operator: request.draft.reviewer,
      })),
  ];
  return (
    <article className={styles.document}>
      {labels.map((label) => (
        <section key={label.code} data-label>
          <header>
            <img src={hospitalLogo} width={46} height={46} alt={t('certificateHospital')} />
            <h2>{t('txSampleLabel')}</h2>
          </header>
          <p>
            {t('sampleCode')}: {label.code}
          </p>
          <p>
            {t(label.historyNumber ? 'txSamplePatientName' : 'inventoryUnitNumber')}: {label.name}
          </p>
          {label.historyNumber ? (
            <p>
              {t('txSampleHistoryNumber')}: {label.historyNumber}
            </p>
          ) : (
            <p>
              {t('txSeal')}: {label.seal || '—'}
            </p>
          )}
          <p>
            {t('bloodGroupShort')}: <strong>{transfusionBloodGroupLabel(label.bloodGroup, t)}</strong>
          </p>
          <p>
            {t('collectedOn')}: {label.date ? formatDatetime(new Date(label.date), { noToday: true }) : '—'}
          </p>
          <p>
            {t('txCollectedBy')}: {label.operator || '—'}
          </p>
        </section>
      ))}
    </article>
  );
}
export function CompatibilityReport({
  request,
  t,
  print = false,
}: {
  request: TransfusionRequest;
  t: ProcessingTranslate;
  print?: boolean;
}) {
  return (
    <article className={styles.document}>
      {print && <p data-demo>{t('printPrototype')}</p>}
      <h2>{t('txCompatibilityReport')}</h2>
      <p>
        {request.order.number} · {request.order.patientName} · {request.order.historyNumber} ·{' '}
        {request.order.bloodGroup}
      </p>
      <table aria-label={t('txCompatibilityReport')}>
        <thead>
          <tr>
            {[
              'inventoryUnitNumber',
              'fractionationComponent',
              'sampleCode',
              'txResult',
              'txTestedBy',
              'txResultAt',
            ].map((key) => (
              <th key={key}>{t(key)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {request.assignments.map((item) => (
            <tr key={`${item.unit.id}/${item.roundId}`}>
              <td>
                {item.unit.id}
                <br />
                {t('txSeal')}: {item.unit.sealId}/{item.unit.id}
                <br />
                {t('bloodGroup')}: {item.unit.bloodGroup}
                <br />
                {t('collectedOn')}: {inventoryDisplayDate(item.unit.collectedOn)}
                <br />
                {t('inventoryExpiration')}: {inventoryDisplayDate(item.unit.expiresAt)}
              </td>
              <td>
                {item.unit.componentType ? t(componentDefinitions[item.unit.componentType].key) : item.unit.component}
              </td>
              <td>
                {item.unitSampleCode || t('txNotRequired')}
                <br />
                {request.sample?.code}
              </td>
              <td>
                {t(
                  item.result === 'pending'
                    ? 'txResultPending'
                    : item.result === 'compatible'
                      ? 'txCompatible'
                      : item.result === 'incompatible'
                        ? 'txIncompatible'
                        : 'txNotRequired',
                )}
                {!item.active && ` · ${t('txReleased')}`}
              </td>
              <td>{item.testedBy || '—'}</td>
              <td>{item.resultAt ? formatDatetime(new Date(item.resultAt), { noToday: true }) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>{t('txReportHelp')}</p>
      {request.deliveredAt && (
        <p>
          {t('txDelivered')}: {formatDatetime(new Date(request.deliveredAt), { noToday: true })} ·{' '}
          {request.draft.collectorName} · {request.draft.collectorDocument} · {request.draft.deliveredBy}
        </p>
      )}
    </article>
  );
}
