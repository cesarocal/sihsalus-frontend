import type { ProcessingTranslate } from '../../shared/processing-page.component';
import type { FollowUpCase } from './follow-up.types';
import styles from './follow-up.scss';

const date = (value: string) => {
  const parts = value.slice(0, 10).split('-');
  return parts.length === 3 ? parts.reverse().join('/') : '';
};
const blanks = (count: number) => Array.from({ length: Math.max(0, count) }, (_, i) => i);
const components = [
  'Paquete globular',
  'Plasma fresco congelado',
  'Plasma residual',
  'Crioprecipitado',
  'Plaquetas simples',
  'Plaquetas aféresis',
  'Fracción pediátrica',
];

/** Presentational snapshot of FR13 / FR14; printing never saves, notifies or closes a case. */
export function FollowUpReport({
  record,
  t,
  print = false,
}: {
  record: FollowUpCase;
  t: ProcessingTranslate;
  print?: boolean;
}) {
  const donor = record.kind === 'donor';
  const p = record.detection.person;
  const d = record.detection;
  return (
    <article className={styles.report} data-follow-up-report>
      {print && (
        <style>{`
        @page { size: A4; margin: 12mm; }
        [data-follow-up-report] { font: 10pt Arial, sans-serif; color:#111; max-width:184mm; }
        [data-follow-up-report] h2 { font: bold 12pt Arial, sans-serif; text-align:left; margin:0 0 7mm; }
        [data-follow-up-report] h2 small { font: 8pt Arial, sans-serif; }
        [data-follow-up-report] p { margin:3mm 0; }
        [data-follow-up-report] table { width:100%; border-collapse:collapse; table-layout:fixed; font:9pt Arial, sans-serif; margin:2mm 0; }
        [data-follow-up-report] td, [data-follow-up-report] th { border:1px solid #111; padding:1mm; height:5mm; vertical-align:middle; }
        [data-follow-up-report] th { text-align:center; font-weight:bold; }
        [data-follow-up-report] .signature { margin:14mm 0 0 auto; width:64%; border-top:1px solid #111; text-align:center; padding:2mm 0; font-size:9pt; }
        [data-follow-up-report] .demo { margin-top:4mm; text-align:center; font-size:8pt; }
      `}</style>
      )}
      <h2>
        {donor ? t('fr13') : t('fr14')} <small>({t('onePage')})</small>
      </h2>
      <p>
        {t('reportDate')}: <span className={styles.dateBoxes}>{date(record.reportDate)}</span>
      </p>
      <table aria-label={t('originIdentity')}>
        <tbody>
          <tr>
            <td colSpan={4}>
              {t(donor ? 'recipientName' : 'donorName')}: {p.name}
            </td>
          </tr>
          <tr>
            <td>
              {t('age')}: {p.age} {t('years')}
            </td>
            <td colSpan={2}>
              {t('sex')}: {t('male')} {p.sex === 'male' ? '☒' : '□'} / {t('female')} {p.sex === 'female' ? '☒' : '□'}
            </td>
            <td>
              {t('historyNumber')}: {p.history}
            </td>
          </tr>
          <tr>
            <td colSpan={2}>
              {t('address')}: {p.address}
            </td>
            <td>
              {t('phone')}: {p.phone}
            </td>
            <td>
              {t('mobile')}: {p.mobile}
            </td>
          </tr>
          <tr>
            <td colSpan={4}>
              {t('reactiveTest')}: {d.test}
            </td>
          </tr>
          <tr>
            <td colSpan={4}>
              {t('testDate')}: {date(d.testedOn)}
            </td>
          </tr>
          <tr>
            <td colSpan={2}>
              {t('reagent')}: {d.reagent}
            </td>
            <td>
              {t('brand')}: {d.brand}
            </td>
            <td>
              {t('lot')}: {d.lot}
            </td>
          </tr>
        </tbody>
      </table>
      <table aria-label={t('traceTable')}>
        <thead>
          <tr>
            {[
              donor ? 'transfusionDate' : 'donationDate',
              'unitCode',
              'component',
              donor ? 'donorName' : 'recipientName',
              donor ? 'donationDate' : 'transfusionDate',
            ].map((key) => (
              <th key={key}>{t(key)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {record.traces.map((row) => (
            <tr key={row.id}>
              <td>{date(donor ? row.transfusionDate : row.donationDate)}</td>
              <td>{row.unit}</td>
              <td>{row.component}</td>
              <td>{donor ? row.donor.name : row.recipient.name}</td>
              <td>{date(donor ? row.donationDate : row.transfusionDate)}</td>
            </tr>
          ))}
          {blanks(6 - record.traces.length).map((i) => (
            <tr key={`blank-${i}`}>
              <td>&nbsp;</td>
              <td />
              <td />
              <td />
              <td />
            </tr>
          ))}
        </tbody>
      </table>
      {donor ? (
        <table aria-label={t('relatedRecipients')}>
          <thead>
            <tr>
              {['unitCode', 'qualitySeal', 'recipientName', 'transfusionDate'].map((key) => (
                <th key={key}>{t(key)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {components.flatMap((component) => {
              const rows = record.relatedTraces.filter(
                (row) => row.component.toLocaleLowerCase() === component.toLocaleLowerCase(),
              );
              return rows.length
                ? rows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        {row.unit}
                        <br />
                        {component}
                      </td>
                      <td>{row.seal}</td>
                      <td>{row.recipient.name}</td>
                      <td>{date(row.transfusionDate)}</td>
                    </tr>
                  ))
                : [
                    <tr key={component}>
                      <td>{component}</td>
                      <td />
                      <td />
                      <td />
                    </tr>,
                  ];
            })}
          </tbody>
        </table>
      ) : (
        <table aria-label={t('recipientAntecedents')}>
          <thead>
            <tr>
              <th rowSpan={2}>{t('recipientName')}</th>
              <th colSpan={2}>{t('previousHere')}</th>
              <th colSpan={2}>{t('previousElsewhere')}</th>
            </tr>
            <tr>
              <th>{t('yes')}</th>
              <th>{t('no')}</th>
              <th>{t('yes')}</th>
              <th>{t('no')}</th>
            </tr>
          </thead>
          <tbody>
            {[...new Map(record.traces.map((row) => [row.recipient.id, row])).values()].map((row) => (
              <tr key={row.recipient.id}>
                <td>{row.recipient.name}</td>
                <td>{row.previousHere === 'yes' ? 'X' : ''}</td>
                <td>{row.previousHere === 'no' ? 'X' : ''}</td>
                <td>{row.previousElsewhere === 'yes' ? 'X' : ''}</td>
                <td>{row.previousElsewhere === 'no' ? 'X' : ''}</td>
              </tr>
            ))}
            {blanks(7 - record.subjects.length).map((i) => (
              <tr key={`blank-${i}`}>
                <td>&nbsp;</td>
                <td />
                <td />
                <td />
                <td />
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="signature">
        {record.responsible}
        <br />
        {t('signature')}
      </p>
      {print && <p className="demo">{t('syntheticPrint')}</p>}
    </article>
  );
}
