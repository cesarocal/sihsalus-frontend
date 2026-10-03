import { ageOnDate } from '../applicant-selection/selection-rules';
import type { ProcessingTranslate } from '../../shared/processing-page.component';
import { fullName } from './collection-rules';
import type { CollectionRecord } from './collection.types';
import styles from '../applicant-selection/selection.scss';

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
  t,
}: {
  record: CollectionRecord;
  sample?: boolean;
  t: ProcessingTranslate;
}) {
  const values: Record<string, string> = sample
    ? {
        sampleCode: record.sampleCode,
        unitCode: record.unitCode,
        applicant: fullName(record.application),
        document: `${record.application.admission.documentType} ${record.application.admission.documentNumber}`,
        number: record.application.number,
        collectionDate: record.registry.date,
        sampleType: record.label.sampleType,
        sampleContainer: record.label.sampleContainer,
      }
    : {
        unitCode: record.unitCode,
        component: record.label.component,
        anticoagulant: record.label.anticoagulant,
        preservative: record.label.preservative,
        sedimentingAgent: record.label.sedimentingAgent,
        plannedVolume: record.label.plannedVolume,
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
    <article data-label className={styles.report}>
      <p data-demo>{t('printPrototype')}</p>
      <h2>{t(sample ? 'printSample' : 'printUnit')}</h2>
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
