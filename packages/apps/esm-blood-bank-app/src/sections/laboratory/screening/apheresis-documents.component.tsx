import type { ProcessingTranslate } from '../../../shared/processing-page.component';
import { ScreeningIdentity } from './screening-report.component';
import type { ApheresisCandidate, ScreeningRecord } from './screening.types';
import styles from '../../applicant-selection/selection.scss';

export function ApheresisCandidateReview({ candidate, t }: { candidate: ApheresisCandidate; t: ProcessingTranslate }) {
  const values = {
    number: candidate.applicationNumber,
    applicant: candidate.applicantName,
    document: candidate.documentNumber,
    admissionDate: candidate.admissionDate,
    donationType: t(candidate.donationType),
    modality: t('apheresis'),
    donorCode: candidate.donorCode,
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
export function ApheresisTubeLabel({ record, t }: { record: ScreeningRecord; t: ProcessingTranslate }) {
  return (
    <article className={styles.report} data-label>
      <p data-demo>{t('printPrototype')}</p>
      <h2>{t('sampleLabel')}</h2>
      <ScreeningIdentity record={record} t={t} />
    </article>
  );
}
