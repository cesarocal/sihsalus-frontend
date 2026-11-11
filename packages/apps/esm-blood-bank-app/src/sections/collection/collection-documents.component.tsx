import { ageOnDate, isDate } from '../applicant-selection/selection-rules';
import { processingPrintCss } from '../../shared/print-document';
import type { ProcessingTranslate } from '../../shared/processing-page.component';
import { fullName } from './collection-rules';
import type { CollectionRecord } from './collection.types';
import styles from '../applicant-selection/selection.scss';
import { formatDonorDate } from '../donors/donor-utils';
import collectionStyles from './collection.scss';

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

export const donationCertificatePrintCss = `${processingPrintCss}
  @page { @bottom-left { content: ""; } }
  [data-certificate-header] { display: flex; align-items: start; justify-content: space-between; gap: 12pt; }
  [data-certificate-header] h2 { margin-top: 0; text-align: left; }
  [data-applicant-number] { border: 1px solid #184e77; color: #184e77; padding: 6pt 9pt; text-align: center; }
  [data-applicant-number] strong { display: block; overflow-wrap: anywhere; }
  [data-donation-types] { display: flex; flex-wrap: wrap; gap: 6pt 18pt; }
  [data-certificate-signature] { margin: 30pt 0 0 auto; width: 58mm; border-top: 1px solid currentColor; text-align: center; }
  [data-certificate-issue-date] { text-align: right; }
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
  const { application, registry, label, certificate } = record;
  const { donationType, documentType, documentNumber, beneficiaryName } = application.admission;
  const sex = application.personal.sex;
  const validDate = isDate(registry.date);
  const [year, month, day] = registry.date.split('-');
  const issueDate = validDate
    ? t('certificateIssueDate', {
        day: String(Number(day)),
        month: new Intl.DateTimeFormat(t('certificateDateLocale'), { month: 'long', timeZone: 'UTC' }).format(
          new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))),
        ),
        year,
      })
    : '—';
  const resultsDate = formatDonorDate(certificate.resultsAvailableOn);
  const values = {
    bagLot: registry.bagLot,
    collectionDate: formatDonorDate(registry.date),
    bloodGroup: `${application.physical.bloodGroup}${application.physical.rh}`,
    hemoglobin: application.physical.hemoglobin,
    hematocrit: application.physical.hematocrit,
    certificatePatientName: donationType === 'replacement' ? beneficiaryName : '',
    recipientName: donationType === 'autologous' ? label.recipientName : '',
    emailConsent: certificate.emailConsent ? t(certificate.emailConsent) : '—',
    email: certificate.emailConsent === 'yes' ? certificate.email : '',
  };
  return (
    <article className={`${styles.report} ${collectionStyles.certificate}`}>
      <header data-certificate-header>
        <h2>{t('certificate')}</h2>
        <div data-applicant-number>
          <span>{t('applicantNumber')}</span>
          <strong>{application.number}</strong>
        </div>
      </header>
      <p>
        {t('certificateIntro', {
          title: t(sex === 'F' ? 'certificateMrs' : sex === 'M' ? 'certificateMr' : 'certificatePerson'),
          name: fullName(application),
          documentType,
          documentNumber,
          age: String(ageOnDate(application.personal.birthDate, registry.date) ?? '—'),
          component: label.component,
        })}
      </p>
      <p data-donation-types>
        <span>
          {donationType === 'voluntary' ? '☒' : '☐'} {t('certificateVoluntary')}
        </span>
        <span>
          {donationType === 'replacement' ? '☒' : '☐'} {t('replacement')}
        </span>
        {donationType === 'autologous' && <span>☒ {t('autologous')}</span>}
      </p>
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
      <p data-certificate-issue-date>{issueDate}</p>
      <p data-certificate-signature>{t('certificateDonorSignature')}</p>
      <footer>
        <strong>{t('certificateNoteHeading')}</strong>
        <p>{t('certificateNote')}</p>
        <p>{t('certificateResultsDate', { date: resultsDate })}</p>
      </footer>
    </article>
  );
}
