import { formatDatetime } from '@openmrs/esm-framework';
import { processingPrintCss } from '../../shared/print-document';
import type { ProcessingTranslate } from '../../shared/processing-page.component';
import hospitalLogo from '../collection/hospital-santa-clotilde.png';
import { inventoryDisplayDate, inventoryUnitSealCode } from '../inventory/inventory-rules';
import { componentDefinitions } from '../laboratory/fractionation/fractionation-rules';
import { transfusionBloodGroupLabel } from './transfusion-blood-group';
import styles from './transfusions.scss';
import type { CompatibilityRound, RecipientSample, TransfusionRequest } from './transfusions.types';
import { compatibilityReportReady } from './transfusions-rules';

export const transfusionLabelPrintCss = `${processingPrintCss}
  [data-label] { box-sizing: border-box; margin-block: 0 3mm; break-inside: avoid; }
  [data-label] header { display: flex; align-items: center; gap: 3mm; }
  [data-label] header img { width: 12mm; height: 12mm; object-fit: contain; }
  [data-label] header h2 { margin: 0; font-size: 12pt; text-align: start; }
  [data-label] p { margin: 1.5mm 0; }
`;

export const compatibilityReportPrintCss = `${processingPrintCss}
  [data-compatibility-report] header {
    display: flex; align-items: center; gap: 5mm; padding-block-end: 4mm;
    border-bottom: 2px solid #185b5d; break-after: avoid;
  }
  [data-compatibility-report] header img { width: 18mm; height: 18mm; object-fit: contain; }
  [data-compatibility-report] h2 { margin: 0; text-align: start; }
  [data-compatibility-report] dl {
    margin: 4mm 0; padding: 3mm; border: 1px solid #aaa; font-size: 10pt; break-inside: avoid;
  }
  [data-compatibility-report] th { text-align: start; background: #edf2f2; }
  [data-compatibility-report] th, [data-compatibility-report] td { padding: 4pt; vertical-align: top; }
  [data-compatibility-report] thead { display: table-header-group; }
  [data-compatibility-results] { table-layout: fixed; }
  [data-compatibility-results] th { box-sizing: border-box; }
  [data-compatibility-results] th:nth-child(1) { width: 14%; }
  [data-compatibility-results] th:nth-child(2) { width: 19%; }
  [data-compatibility-results] th:nth-child(3) { width: 13%; }
  [data-compatibility-results] th:nth-child(4) { width: 18%; }
  [data-compatibility-results] th:nth-child(5) { width: 13%; }
  [data-compatibility-results] th:nth-child(6) { width: 12%; }
  [data-compatibility-report] summary {
    list-style: none; margin-block: 4mm 2mm; font-weight: bold; break-after: avoid;
  }
`;

const compatibilityResultKeys = {
  pending: 'txResultPending',
  compatible: 'txCompatible',
  incompatible: 'txIncompatible',
  notRequired: 'txNotRequired',
} as const;

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
  const { assignments, order } = request;
  const summary = {
    txReportRequestNumber: order.number,
    txSamplePatientName: order.patientName,
    txSampleHistoryNumber: order.historyNumber,
    txReportBloodGroup: transfusionBloodGroupLabel(order.bloodGroup, t),
    ...(request.sample?.code ? { txRecipientSample: request.sample.code } : {}),
  };

  return (
    <article className={`${styles.document} ${styles.compatibilityReport}`} data-compatibility-report>
      <header>
        {print && <img src={hospitalLogo} width={68} height={68} alt={t('certificateHospital')} />}
        <h2>{t('txCompatibilityReport')}</h2>
      </header>
      <dl className={`${styles.summary} ${styles.reportSummary}`}>
        {Object.entries(summary).map(([key, value]) => (
          <div key={key}>
            <dt>{t(key)}</dt>
            <dd>{value || '—'}</dd>
          </div>
        ))}
      </dl>
      {!print && !compatibilityReportReady(request) && (
        <p className={styles.reportStatus} role="status">
          {t('txReportPendingPrint')}
        </p>
      )}
      <div className={styles.reportTable}>
        <table data-compatibility-results aria-label={t('txCompatibilityReport')}>
          <thead>
            <tr>
              {[
                'inventoryUnitNumber',
                'fractionationComponent',
                'bloodGroupShort',
                'txUnitSample',
                'txResult',
                'txTestedBy',
                'txResultAt',
              ].map((key) => (
                <th key={key} scope="col">
                  {t(key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {assignments.map((item) => (
              <tr key={`${item.unit.id}/${item.roundId}`}>
                <td>{item.unit.id}</td>
                <td>
                  {item.unit.componentType ? t(componentDefinitions[item.unit.componentType].key) : item.unit.component}
                </td>
                <td>{transfusionBloodGroupLabel(item.unit.bloodGroup, t)}</td>
                <td>{item.unitSampleCode || '—'}</td>
                <td>
                  {t(compatibilityResultKeys[item.result])}
                  {!item.active && ` · ${t('txReleased')}`}
                </td>
                <td>{item.testedBy || '—'}</td>
                <td>{item.resultAt ? formatDatetime(new Date(item.resultAt), { noToday: true }) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {assignments.length > 0 && (
        <details className={styles.reportTraceability} open={print || undefined}>
          <summary>{t('txReportTraceability')}</summary>
          <div className={styles.reportTable}>
            <table aria-label={t('txReportTraceability')}>
              <thead>
                <tr>
                  {['inventoryUnitNumber', 'txSeal', 'collectedOn', 'inventoryExpiration'].map((key) => (
                    <th key={key} scope="col">
                      {t(key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {assignments.map(({ unit, roundId }) => (
                  <tr key={`${unit.id}/${roundId}`}>
                    <td>{unit.id}</td>
                    <td>{inventoryUnitSealCode(unit) || '—'}</td>
                    <td>{inventoryDisplayDate(unit.collectedOn)}</td>
                    <td>{inventoryDisplayDate(unit.expiresAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
      {request.deliveredAt && (
        <p>
          {t('txDelivered')}: {formatDatetime(new Date(request.deliveredAt), { noToday: true })} ·{' '}
          {request.draft.collectorName} · {request.draft.collectorDocument} · {request.draft.deliveredBy}
        </p>
      )}
    </article>
  );
}
