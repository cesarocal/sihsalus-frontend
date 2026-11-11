import { printDocument, processingPrintCss } from '../../../shared/print-document';
import type { ProcessingTranslate } from '../../../shared/processing-page.component';
import { formatScreeningCollectionTime } from './screening-rules';
import { screeningReportCode, screeningReportedTests } from './screening-repeat-rules';
import {
  screeningBloodFields,
  screeningSpecialties,
  type ScreeningRecord,
  type ScreeningRepeatRound,
} from './screening.types';

export const screeningAnalysisPrintCss = `${processingPrintCss}
  @page {
    size: A4; margin: 14mm 10mm;
    @top-left { content: ""; }
    @top-right { content: counter(page) " / " counter(pages); font: 8pt Arial, sans-serif; }
    @bottom-left { content: ""; }
  }
  [data-screening-analysis] {
    max-width: none; min-height: 250mm; display: flex; flex-direction: column; font: 10pt/1.35 Arial, sans-serif;
  }
  [data-screening-analysis] h1 { font-size: 13pt; margin: 0 0 13mm; }
  [data-screening-analysis] dl { display: block; margin: 0 0 6mm; }
  [data-screening-analysis] dl > div { display: flex; align-items: baseline; gap: 3mm; margin: 1mm 0; }
  [data-screening-analysis] dt { font-weight: normal; }
  [data-screening-analysis] dd { border-bottom: 1px solid #444; min-height: 4mm; margin: 0; padding-inline: 1mm; }
  [data-screening-analysis] [data-analysis-identity] dd { flex: 1; min-width: 0; }
  [data-screening-analysis] [data-analysis-collection] { gap: 4mm; }
  [data-screening-analysis] [data-analysis-collection] dd { flex: 0 1 36mm; }
  [data-screening-analysis] [data-analysis-blood] dd { min-width: 34mm; }
  [data-screening-analysis] table { table-layout: fixed; }
  [data-screening-analysis] table colgroup:first-child col { width: 55%; }
  [data-screening-analysis] table colgroup:last-child col { width: 22.5%; }
  [data-screening-analysis] th, [data-screening-analysis] td {
    border: 1px solid #222; padding: 1.6mm 2mm; vertical-align: middle;
  }
  [data-screening-analysis] th { text-transform: uppercase; }
  [data-screening-analysis] td { height: 8mm; }
  [data-screening-analysis] td:not(:first-child) { text-align: center; }
  [data-screening-analysis] h2 { margin: 0 0 1.5mm; font-size: inherit; text-align: left; }
  [data-analysis-recommendations] { margin-top: 7mm; break-inside: avoid; }
  [data-analysis-recommendations] ul { list-style: none; margin: 0; padding: 0; }
  [data-analysis-recommendations] li { display: grid; grid-template-columns: 52mm 22mm 22mm; gap: 3mm; margin: 0.6mm 0; }
  [data-analysis-signature] { border: 0; margin: auto 0 0 auto; padding: 20mm 0 0; width: 93mm; text-align: center; break-inside: avoid; }
  [data-analysis-signature] p { border-top: 1px solid #222; margin: 0; padding-top: 1mm; font-size: 9pt; }
`;

export function ScreeningAnalysisDocument({
  record,
  round,
  t,
}: {
  record: ScreeningRecord;
  round?: ScreeningRepeatRound;
  t: ProcessingTranslate;
}) {
  const [sampleDate, sampleTime] = formatScreeningCollectionTime(record.collectedOn).split(' ');
  const [hour, minute] = (sampleTime ?? '').split(':');
  const hourNumber = Number(hour);
  const time = minute
    ? `${String(hourNumber % 12 || 12).padStart(2, '0')}:${minute} ${hourNumber < 12 ? 'A.M.' : 'P.M.'}`
    : '';
  const rows = screeningReportedTests(record, round).map(({ test, labelKey, name, result }) => ({
    key: test,
    label: name ? `${t('screeningAnalysisOther')}: ${name}` : t(labelKey),
    result,
  }));
  if (!round && !rows.some(({ key }) => key === 'additional'))
    rows.push({ key: 'additional', label: t('screeningAnalysisOther'), result: undefined });
  const signer = round ?? record;
  return (
    <article data-screening-analysis>
      <h1>{t('screeningAnalysisTitle')}</h1>
      <dl data-analysis-identity>
        <div>
          <dt>{t(record.origin?.type === 'followUp' ? 'person' : 'screeningAnalysisApplicant')}</dt>
          <dd>{record.applicantName}</dd>
        </div>
        <div data-analysis-collection>
          <dt>{t('screeningAnalysisCollectionDate')}</dt>
          <dd>{sampleDate.replaceAll('-', '/')}</dd>
          <dt>{t('screeningAnalysisTime')}</dt>
          <dd>{time}</dd>
        </div>
        <div>
          <dt>{t('sampleCode')}</dt>
          <dd>{record.sampleCode}</dd>
        </div>
        <div>
          <dt>{t('screeningReportNumber')}</dt>
          <dd>{screeningReportCode(record, round?.number)}</dd>
        </div>
        {round && (
          <>
            <div>
              <dt>{t('screeningPreviousReport')}</dt>
              <dd>{screeningReportCode(record, round.number - 1)}</dd>
            </div>
            <div>
              <dt>{t('performedOn')}</dt>
              <dd>{formatScreeningCollectionTime(round.performedOn)}</dd>
            </div>
            <div>
              <dt>{t('performedBy')}</dt>
              <dd>{round.performedBy}</dd>
            </div>
          </>
        )}
      </dl>
      {!round && (
        <dl data-analysis-blood>
          {screeningBloodFields.map((field) => (
            <div key={field}>
              <dt>{t(field)}</dt>
              <dd>{record.bloodData?.[field]}</dd>
            </div>
          ))}
        </dl>
      )}
      <table aria-label={t('results')}>
        <colgroup>
          <col />
        </colgroup>
        <colgroup>
          <col />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th rowSpan={2} scope="col">
              {t('screeningTestPerformed')}
            </th>
            <th colSpan={2} scope="colgroup">
              {t('result')}
            </th>
          </tr>
          <tr>
            <th scope="col">{t('reactive')}</th>
            <th scope="col">{t('nonReactive')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ key, label, result }) => (
            <tr key={key}>
              <td>{label}</td>
              {result === 'inconclusive' ? (
                <td colSpan={2}>{t(result)}</td>
              ) : (
                <>
                  <td>{result === 'reactive' ? 'X' : ''}</td>
                  <td>{result === 'nonReactive' ? 'X' : ''}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {!round && (
        <section data-analysis-recommendations>
          <h2>{t('screeningAnalysisRecommendations')}</h2>
          <ul>
            {screeningSpecialties.map((specialty) => (
              <li key={specialty}>
                <span>{t(specialty)}</span>
                <span>
                  {t('yes')} ({record.recommendations?.[specialty] === 'yes' ? 'X' : ' '})
                </span>
                <span>
                  {t('no')} ({record.recommendations?.[specialty] === 'no' ? 'X' : ' '})
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <footer data-analysis-signature>
        <p>{t('screeningAnalysisSignature')}</p>
        {signer.status === 'validated' && signer.validatedBy && <div>{signer.validatedBy}</div>}
      </footer>
    </article>
  );
}

export function printScreeningAnalysis(
  record: ScreeningRecord,
  t: ProcessingTranslate,
  onError: () => void,
  round?: ScreeningRepeatRound,
) {
  printDocument(
    <ScreeningAnalysisDocument record={record} round={round} t={t} />,
    t('screeningAnalysisTitle'),
    onError,
    screeningAnalysisPrintCss,
  );
}
