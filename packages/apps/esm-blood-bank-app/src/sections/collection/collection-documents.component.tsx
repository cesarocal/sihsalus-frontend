import { ageOnDate } from '../applicant-selection/selection-rules';
import { processingPrintCss } from '../../shared/print-document';
import type { ProcessingTranslate } from '../../shared/processing-page.component';
import { fullName } from './collection-rules';
import type { CollectionRecord } from './collection.types';
import styles from '../applicant-selection/selection.scss';

export const collectionLabelPrintCss = `${processingPrintCss}
  [data-label] { box-sizing: border-box; break-inside: avoid; }
  [data-label] header p { font-size: 9pt; margin: 0; }
  [data-label] header h2 { font-size: 12pt; text-align: left; margin: 2pt 0 0; overflow-wrap: anywhere; }
  [data-manual-volume] { display: block; width: 36mm; max-width: 100%; min-height: 5mm; border-bottom: 1px solid #111; }
  [data-label="tube"] { width: 65mm; min-height: 28mm; padding: 2mm; margin: 0; font-size: 8pt; line-height: 1.15; }
  [data-label="tube"] header p { font-size: inherit; }
  [data-label="tube"] header h2 { font-size: 10pt; }
  [data-label="tube"] dl { gap: 1mm 2mm; margin: 1.5mm 0 0; }
  [data-label="tube"] dd { margin: 0; }
  [data-label="tube"] [data-label-field="applicant"] { grid-column: 1 / -1; }
`;

export function CollectionIdentity({ record, t }: { record: CollectionRecord; t: ProcessingTranslate }) {
  const values = {
    applicant: fullName(record.application),
    document: `${record.application.admission.documentType} ${record.application.admission.documentNumber}`,
    number: record.application.number,
    unitCode: record.unitCode,
    sampleCode: record.sampleCode,
    modality: t(record.application.admission.modality),
  };
  return (
    <dl className={styles.fields}>
      {Object.entries(values).map(([key, value]) => (
        <div key={key}>
          <dt>{t(key)}</dt>
          <dd>{value || '—'}</dd>
        </div>
      ))}
    </dl>
  );
}
export function CollectionLabelDocument({
  record,
  sample = false,
  print = false,
  t,
}: {
  record: CollectionRecord;
  sample?: boolean;
  print?: boolean;
  t: ProcessingTranslate;
}) {
  const values: Record<string, string> = sample
    ? {
        applicant: fullName(record.application),
        unitCode: record.unitCode,
        document: `${record.application.admission.documentType} ${record.application.admission.documentNumber}`,
        number: record.application.number,
        collectionDate: record.registry.date,
      }
    : {
        component: record.label.component,
        anticoagulant: record.label.anticoagulant,
        preservative: record.label.preservative,
        sedimentingAgent: record.label.sedimentingAgent,
        service: record.label.service,
        collectionDate: record.registry.date,
        ...(record.application.admission.donationType === 'autologous'
          ? {
              recipientName: record.label.recipientName,
              recipientDocument: record.label.recipientDocument,
              recipientService: record.label.recipientService,
              recipientHistory: record.label.recipientHistory,
            }
          : {}),
      };
  return (
    <article data-label={sample ? 'tube' : 'unit'} className={styles.report}>
      <header>
        <p>{t(sample ? 'sampleCode' : 'unitCode')}</p>
        <h2>{sample ? record.sampleCode : record.unitCode}</h2>
      </header>
      <dl>
        {Object.entries(values)
          .filter(([, value]) => value)
          .map(([key, value]) => (
            <div key={key} data-label-field={key}>
              <dt>{t(key)}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        {print && !sample && (
          <div>
            <dt>{t('labelVolume')}</dt>
            <dd>
              <span data-manual-volume aria-hidden="true" />
            </dd>
          </div>
        )}
      </dl>
      {!sample && (
        <>
          <p>{t(record.application.admission.donationType)}</p>
          {record.label.leukocytesReduced && <p>{t('leukocytesReduced')}</p>}
          <footer>
            {t(record.unitStatus)} · {t('screeningWarning')}
          </footer>
        </>
      )}
    </article>
  );
}
export function DonationCertificateDocument({ record, t }: { record: CollectionRecord; t: ProcessingTranslate }) {
  const values = {
    applicant: fullName(record.application),
    document: `${record.application.admission.documentType} ${record.application.admission.documentNumber}`,
    age: String(ageOnDate(record.application.personal.birthDate, record.registry.date) ?? '—'),
    number: record.application.number,
    bagLot: record.registry.bagLot,
    collectionDate: record.registry.date,
    bloodGroup: `${record.application.physical.bloodGroup}${record.application.physical.rh}`,
    hemoglobin: record.application.physical.hemoglobin,
    hematocrit: record.application.physical.hematocrit,
    recipientName: record.label.recipientName,
    resultsAvailableOn: record.certificate.resultsAvailableOn,
    emailConsent: record.certificate.emailConsent ? t(record.certificate.emailConsent) : '—',
    email: record.certificate.emailConsent === 'yes' ? record.certificate.email : '',
  };
  return (
    <article className={styles.report}>
      <p data-demo>{t('printPrototype')}</p>
      <h2>{t('certificate')}</h2>
      <p>{t('certificateIntro')}</p>
      <dl>
        {Object.entries(values)
          .filter(([, value]) => value)
          .map(([key, value]) => (
            <div key={key}>
              <dt>{t(key)}</dt>
              <dd>{value}</dd>
            </div>
          ))}
      </dl>
      <p>{t(record.application.admission.donationType)}</p>
      <footer>
        <p>{t('certificateNote')}</p>
        <p>{t('signature')}: __________________________</p>
      </footer>
    </article>
  );
}
