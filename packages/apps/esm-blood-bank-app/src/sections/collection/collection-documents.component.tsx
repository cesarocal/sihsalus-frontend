import { ageOnDate, isDate } from '../applicant-selection/selection-rules';
import { processingPrintCss } from '../../shared/print-document';
import type { ProcessingTranslate } from '../../shared/processing-page.component';
import { fullName } from './collection-rules';
import type { CollectionRecord } from './collection.types';
import styles from '../applicant-selection/selection.scss';
import { formatDonorDate } from '../donors/donor-utils';
import collectionStyles from './collection.scss';
import hospitalLogo from './hospital-santa-clotilde.png';
import pangoLogo from './pango.png';

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
  @page { margin: 15mm 16mm; @bottom-left { content: ""; } }
  [data-donation-certificate] { max-width: 170mm; line-height: 1.35; }
  [data-donation-certificate] p { margin: 0 0 6pt; }
  [data-certificate-masthead] {
    display: grid; grid-template-columns: 21mm 1fr 27mm; gap: 3mm; align-items: center;
    text-align: center; border-bottom: 2px solid currentColor; padding-bottom: 7pt;
  }
  [data-certificate-masthead] img { width: 100%; height: auto; display: block; }
  [data-certificate-masthead] p { margin: 0; font-size: 8pt; }
  [data-certificate-masthead] strong { display: block; font-size: 11pt; }
  [data-certificate-header] { display: flex; align-items: center; gap: 6pt; margin: 10pt 0 12pt; }
  [data-certificate-header] h2 { flex: 1; margin: 0; text-decoration: underline; text-transform: uppercase; }
  [data-applicant-number] { border: 1.5pt solid #184e77; color: #184e77; padding: 4pt 8pt; text-align: center; font-size: 8pt; }
  [data-applicant-number] strong { display: block; font-size: 13pt; overflow-wrap: anywhere; }
  [data-certificate-donor] { display: block; padding: 3pt 0; border-bottom: 1px solid; }
  [data-certificate-identity], [data-donation-types], [data-certificate-consent] { display: flex; flex-wrap: wrap; gap: 5pt 14pt; }
  [data-donation-certificate] [data-certificate-identity] { margin-top: 8pt; }
  [data-donation-certificate] [data-donation-types] { margin-block: 8pt; }
  [data-certificate-record] { grid-template-columns: 1.4fr 1fr; gap: 4pt 12pt; margin: 8pt 0; }
  [data-certificate-record] div { display: flex; flex-wrap: wrap; gap: 0 4pt; }
  [data-certificate-record] dd { margin: 0; }
  [data-donation-certificate] [data-certificate-signature] {
    margin: 26pt auto 12pt 0; width: 58mm; border-top: 1px solid; text-align: center;
  }
  [data-certificate-note] { margin-top: 10pt; }
  [data-certificate-note] strong { display: block; margin-bottom: 4pt; }
  [data-certificate-results-date] { display: inline-block; min-width: 26mm; padding-inline: 3pt; border-bottom: 1px solid; text-align: center; }
  [data-donation-certificate] [data-certificate-motto] { margin-top: 10pt; text-align: center; font-weight: bold; font-style: italic; }
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
  const title = t(sex === 'F' ? 'certificateMrs' : sex === 'M' ? 'certificateMr' : 'certificatePerson');
  const values = {
    certificateApplicantCode: application.number,
    bagLot: registry.bagLot,
    bloodGroup: `${application.physical.bloodGroup}${application.physical.rh}`,
    hematocrit: application.physical.hematocrit,
    collectionDate: formatDonorDate(registry.date),
    hemoglobin: application.physical.hemoglobin,
  };
  return (
    <article data-donation-certificate className={`${styles.report} ${collectionStyles.certificate}`}>
      <header data-certificate-masthead>
        <img src={hospitalLogo} width={185} height={185} alt="" />
        <div>
          <strong>{t('certificateHospital')}</strong>
          <strong>{t('certificateHospitalName')}</strong>
          <p>{t('certificateHospitalRegion')}</p>
          <strong>{t('certificateHospitalMotto')}</strong>
          <p>{t('certificateHospitalPartners')}</p>
          <p>{t('certificateHospitalAddress')}</p>
          <p>{t('certificateHospitalEmail')}</p>
        </div>
        <img src={pangoLogo} width={277} height={197} alt="" />
      </header>
      <header data-certificate-header>
        <h2>{t('certificate')}</h2>
        <div data-applicant-number>
          <span>{t('applicantNumber')}</span>
          <strong>{application.number}</strong>
        </div>
      </header>
      <p>
        {t('certificateIntro', { title })}
        <strong data-certificate-donor>{fullName(application)}</strong>
      </p>
      <p data-certificate-identity>
        <span>
          {documentType} N.º {documentNumber}
        </span>
        <span>{t('certificateAge', { age: String(ageOnDate(application.personal.birthDate, registry.date) ?? '—') })}</span>
      </p>
      <p>{t('certificateDonationStatement', { component: label.component })}</p>
      <dl data-certificate-record>
        {Object.entries(values).map(([key, value]) => (
          <div key={key}>
            <dt>{t(key)}</dt>
            <dd>{value || '—'}</dd>
          </div>
        ))}
      </dl>
      <p data-donation-types>
        <span>{donationType === 'voluntary' ? '☒' : '☐'} {t('certificateVoluntary')}</span>
        <span>{donationType === 'replacement' ? '☒' : '☐'} {t('replacement')}</span>
        {donationType === 'autologous' && <span>☒ {t('autologous')}</span>}
      </p>
      {donationType === 'replacement' && <p>{t('certificatePatientName')}: {beneficiaryName || '—'}</p>}
      {donationType === 'autologous' && <p>{t('recipientName')}: {label.recipientName || '—'}</p>}
      <p data-certificate-issue-date>{issueDate}</p>
      <p data-certificate-signature>{t('certificateDonorSignature')}</p>
      <section data-certificate-note aria-label={t('certificateNoteHeading')}>
        <strong>{t('certificateNoteHeading').toUpperCase()}</strong>
        <p>{t('certificateNote')}</p>
        <p>{t('certificateResultsDate')} <b data-certificate-results-date>{resultsDate}</b></p>
        <p data-certificate-consent>
          <span>{t('emailConsent')}</span>
          <span>{certificate.emailConsent === 'yes' ? '☒' : '☐'} {t('yes')}</span>
          <span>{certificate.emailConsent === 'no' ? '☒' : '☐'} {t('no')}</span>
        </p>
        {certificate.emailConsent === 'yes' && <p>{t('email')}: {certificate.email}</p>}
      </section>
      <p data-certificate-motto>{t('certificateMotto')}</p>
    </article>
  );
}
