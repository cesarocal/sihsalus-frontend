import type { ProcessingTranslate } from '../../../shared/processing-page.component';
import { formatScreeningCollectionTime, globalScreeningResult, screeningOriginLabel } from './screening-rules';
import {
  screeningBloodFields,
  screeningSpecialties,
  screeningTableTests,
  type ScreeningRecord,
} from './screening.types';
import styles from '../../applicant-selection/selection.scss';

export function ScreeningIdentity({
  record,
  t,
  showSampleDetails = false,
}: {
  record: ScreeningRecord;
  t: ProcessingTranslate;
  showSampleDetails?: boolean;
}) {
  const values = {
    sampleCode: record.sampleCode,
    sampleOrigin: t(screeningOriginLabel(record)),
    ...(record.unitCode ? { unitCode: record.unitCode } : {}),
    ...(record.origin?.type === 'followUp' ? { person: record.applicantName } : { applicant: record.applicantName }),
    document: record.documentNumber,
    ...(record.historyNumber ? { historyNumber: record.historyNumber } : {}),
    ...(record.collectedBy ? { collectedBy: record.collectedBy } : {}),
    ...(record.applicationNumber ? { applicantNumber: record.applicationNumber } : {}),
    ...(record.origin?.type === 'followUp' ? { followUpReference: record.origin.followUpId } : {}),
    collectedOn: formatScreeningCollectionTime(record.collectedOn),
    ...(showSampleDetails ? { sampleType: record.sampleType, sampleContainer: record.sampleContainer } : {}),
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
export function ScreeningReport({
  record,
  t,
  showWarning = true,
}: {
  record: ScreeningRecord;
  t: ProcessingTranslate;
  showWarning?: boolean;
}) {
  return (
    <article className={styles.report}>
      <p data-demo>{t('printPrototype')}</p>
      <h2>{t('results')}</h2>
      <ScreeningIdentity record={record} t={t} showSampleDetails />
      <dl>
        {(['receivedOn', 'receivedBy', 'performedOn', 'performedBy', 'validatedBy', 'validatedAt'] as const).map(
          (key) => (
            <div key={key}>
              <dt>{t(key)}</dt>
              <dd>
                {(key === 'performedOn' || key === 'receivedOn'
                  ? formatScreeningCollectionTime(record[key])
                  : record[key]) || '—'}
              </dd>
            </div>
          ),
        )}
      </dl>
      {record.bloodData && (
        <>
          <h3>{t('screeningBloodData')}</h3>
          <dl>
            {screeningBloodFields.map((field) => (
              <div key={field}>
                <dt>{t(field)}</dt>
                <dd>{record.bloodData?.[field] || '—'}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
      <table>
        <thead>
          <tr>
            <th scope="col">{t('screeningTestPerformed')}</th>
            <th scope="col">{t('result')}</th>
          </tr>
        </thead>
        <tbody>
          {screeningTableTests.map((test) => (
            <tr key={test}>
              <td>{t(`screeningTest_${test}`)}</td>
              <td>{record.tests[test]?.result ? t(record.tests[test].result) : '—'}</td>
            </tr>
          ))}
          {record.additionalTest?.name.trim() && (
            <tr>
              <td>{record.additionalTest.name}</td>
              <td>{record.additionalTest.result ? t(record.additionalTest.result) : '—'}</td>
            </tr>
          )}
        </tbody>
      </table>
      <p>
        {t('globalResult')}: {t(globalScreeningResult(record) || 'pendingResult')}
      </p>
      {record.recommendations && (
        <>
          <h3>{t('screeningRecommendations')}</h3>
          <dl>
            {screeningSpecialties.map((specialty) => {
              const indicated = record.recommendations?.[specialty];
              return (
                <div key={specialty}>
                  <dt>{t(specialty)}</dt>
                  <dd>{indicated ? t(indicated) : '—'}</dd>
                </div>
              );
            })}
          </dl>
        </>
      )}
      <footer>
        {showWarning && <p>{t(record.unitCode ? 'screeningWarning' : 'sampleScreeningWarning')}</p>}
        <p>{t('signature')}: __________________________</p>
      </footer>
    </article>
  );
}
