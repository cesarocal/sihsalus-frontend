import type { ProcessingTranslate } from '../../../shared/processing-page.component';
import { formatScreeningCollectionTime, globalScreeningResult, screeningOriginLabel } from './screening-rules';
import { consolidatedScreening, screeningReportCode, screeningReportedTests } from './screening-repeat-rules';
import {
  screeningBloodFields,
  screeningSpecialties,
  type ScreeningRecord,
  type ScreeningRepeatRound,
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
  review = false,
  round,
  current = false,
}: {
  record: ScreeningRecord;
  t: ProcessingTranslate;
  review?: boolean;
  round?: ScreeningRepeatRound;
  current?: boolean;
}) {
  const reportData = current ? consolidatedScreening(record) : record;
  const audit = round ?? reportData;
  const result = round ? consolidatedScreening(record, round.number).result : globalScreeningResult(reportData);
  const metadata = [
    'performedOn',
    'performedBy',
    ...(!review && audit.status === 'validated' ? (['validatedBy', 'validatedAt'] as const) : []),
  ] as const;
  return (
    <article className={styles.report}>
      <h2>
        {round
          ? t('screeningRepeatNumber', { number: String(round.number - 1) })
          : t(current ? 'screeningCurrentResults' : 'results')}
      </h2>
      <ScreeningIdentity record={record} t={t} showSampleDetails />
      <dl>
        {!current && (
          <div>
            <dt>{t('screeningReportNumber')}</dt>
            <dd>{screeningReportCode(record, round?.number)}</dd>
          </div>
        )}
        {round && (
          <div>
            <dt>{t('screeningPreviousReport')}</dt>
            <dd>{screeningReportCode(record, round.number - 1)}</dd>
          </div>
        )}
        {(['receivedOn', 'receivedBy'] as const).map((field) => (
          <div key={field}>
            <dt>{t(field)}</dt>
            <dd>{(field === 'receivedOn' ? formatScreeningCollectionTime(record[field]) : record[field]) || '—'}</dd>
          </div>
        ))}
        {metadata.map((key) => (
          <div key={key}>
            <dt>{t(key)}</dt>
            <dd>{(key === 'performedOn' ? formatScreeningCollectionTime(audit[key]) : audit[key]) || '—'}</dd>
          </div>
        ))}
      </dl>
      {!round && record.bloodData && (
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
          {screeningReportedTests(reportData, round).map(({ test, labelKey, name, result }) => (
            <tr key={test}>
              <td>{name || t(labelKey)}</td>
              <td>{result ? t(result) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {(!round || round.status === 'validated') && (
        <p>
          {t('globalResult')}: {t(result || 'pendingResult')}
        </p>
      )}
      {!round && record.recommendations && (
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
        {!review && <p>{t(record.unitCode ? 'screeningWarning' : 'sampleScreeningWarning')}</p>}
        {!current && <p>{t('signature')}: __________________________</p>}
      </footer>
    </article>
  );
}
