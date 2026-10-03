import type { ProcessingTranslate } from '../../../shared/processing-page.component';
import { globalScreeningResult } from './screening-rules';
import { screeningTests, type ScreeningRecord } from './screening.types';
import styles from '../../applicant-selection/selection.scss';

export function ScreeningIdentity({ record, t }: { record: ScreeningRecord; t: ProcessingTranslate }) {
  const values = {
    sampleCode: record.sampleCode,
    unitCode: record.unitCode,
    applicant: record.applicantName,
    document: record.documentNumber,
    number: record.applicationNumber,
    collectedOn: record.collectedOn,
    sampleType: record.sampleType,
    sampleContainer: record.sampleContainer,
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
export function ScreeningReport({ record, t }: { record: ScreeningRecord; t: ProcessingTranslate }) {
  return (
    <article className={styles.report}>
      <p data-demo>{t('printPrototype')}</p>
      <h2>{t('results')}</h2>
      <ScreeningIdentity record={record} t={t} />
      <dl>
        {(['receivedOn', 'receivedBy', 'performedOn', 'performedBy', 'validatedBy', 'validatedAt'] as const).map(
          (key) => (
            <div key={key}>
              <dt>{t(key)}</dt>
              <dd>{record[key] || '—'}</dd>
            </div>
          ),
        )}
      </dl>
      <table>
        <thead>
          <tr>
            {['test', 'result', 'reagent', 'brand', 'lot'].map((key) => (
              <th key={key}>{t(key)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {screeningTests.map((test) => (
            <tr key={test}>
              <td>{t(test)}</td>
              <td>{record.tests[test].result ? t(record.tests[test].result) : '—'}</td>
              <td>{record.tests[test].reagent || '—'}</td>
              <td>{record.tests[test].brand || '—'}</td>
              <td>{record.tests[test].lot || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        {t('globalResult')}: {t(globalScreeningResult(record) || 'pendingResult')}
      </p>
      <p>
        {t('observations')}: {record.observations || '—'}
      </p>
      <footer>
        <p>{t('screeningWarning')}</p>
        <p>{t('signature')}: __________________________</p>
      </footer>
    </article>
  );
}
