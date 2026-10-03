import { renderToStaticMarkup } from 'react-dom/server';
import { ageOnDate, calculateReturnDate } from './selection-rules';
import { interviewQuestions, personalFields, physicalFields, stiQuestions } from './selection-fields';
import type { SelectionApplication, SelectionTranslate } from './selection.types';
import styles from './selection.scss';

export function SelectionReport({ application: a, t }: { application: SelectionApplication; t: SelectionTranslate }) {
  const value = (text: string | number | null | undefined) =>
    text === null || text === undefined || text === '' ? t('notRecorded') : String(text);
  const item = (key: string, text: string | number | null | undefined) => (
    <div key={key}>
      <dt>{t(key)}</dt>
      <dd>{value(text)}</dd>
    </div>
  );
  const question = (id: string) => (
    <tr key={id}>
      <td>{t(id)}</td>
      <td>{value(a.interview.answers[id] ? t(a.interview.answers[id]) : '')}</td>
    </tr>
  );
  return (
    <article className={styles.report} data-selection-report>
      <header>
        <p>{t('hospital')}</p>
        <h2>{t('reportTitle')}</h2>
        <p>{t('mockDocument')}</p>
      </header>
      <h3>{t('admission')}</h3>
      <dl>
        {item('number', a.number)}
        {item('date', a.admission.date)}
        {item('donorCode', a.admission.donorCode)}
        {item('documentType', t(a.admission.documentType))}
        {item('documentNumber', a.admission.documentNumber)}
        {item('donationType', a.admission.donationType ? t(a.admission.donationType) : '')}
        {item('modality', a.admission.modality ? t(a.admission.modality) : '')}
        {a.admission.donationType === 'replacement' && (
          <>
            {item('beneficiaryName', a.admission.beneficiaryName)}
            {item('beneficiaryDocument', a.admission.beneficiaryDocument)}
          </>
        )}
      </dl>
      <h3>{t('personal')}</h3>
      <dl>
        {personalFields.map(({ key }) => item(key, a.personal[key]))}
        {item('sex', a.personal.sex ? t(a.personal.sex) : '')}
        {item('age', ageOnDate(a.personal.birthDate, a.admission.date))}
        {item('maritalStatus', a.personal.maritalStatus ? t(a.personal.maritalStatus) : '')}
      </dl>
      <h3>{t('physical')}</h3>
      <dl>
        {physicalFields.map(({ key, unit }) => item(key, a.physical[key] ? `${a.physical[key]} ${unit}` : ''))}
        {item('bloodGroup', a.physical.bloodGroup)}
        {item('rh', a.physical.rh)}
        {item('armInspection', a.physical.armInspection ? t(a.physical.armInspection) : '')}
        {item('observations', a.physical.observations)}
        {item('warningAcknowledgement', a.physical.warningAcknowledgement)}
      </dl>
      {a.stoppedAfterPhysical && <p>{t('stoppedAfterPhysical')}</p>}
      <h3>{t('interview')}</h3>
      {['general', 'nextDay', 'lastTwoWeeks', 'lastMonth', 'lastYear', 'lifetime', 'withInterviewer'].map((group) => (
        <section key={group}>
          <h4>{t(group)}</h4>
          <table>
            <tbody>
              {interviewQuestions
                .filter((q) => q.group === group)
                .map((q) => (
                  <tr key={q.id}>
                    <td>
                      {t(q.id)}
                      {q.detail && a.interview.answers[q.id] === 'yes' && (
                        <p>
                          {t(q.detail)}: {value(a.interview.details[q.detail])}
                        </p>
                      )}
                    </td>
                    <td>{value(a.interview.answers[q.id] ? t(a.interview.answers[q.id]) : '')}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
      ))}
      {a.interview.answers.sti === 'yes' && (
        <table>
          <tbody>{stiQuestions.map(question)}</tbody>
        </table>
      )}
      {a.interview.answers.sti === 'yes' && a.interview.answers.otherSti === 'yes' && (
        <p>
          {t('otherSti')}: {value(a.interview.details.otherSti)}
        </p>
      )}
      {a.personal.sex === 'F' && (
        <section>
          <h4>{t('women')}</h4>
          <dl>
            {item('lastPeriod', a.interview.lastPeriod)}
            {item('lastDelivery', a.interview.lastDelivery)}
            {item('pregnancies', a.interview.pregnancies)}
            {item('pregnant', a.interview.pregnant ? t(a.interview.pregnant) : '')}
            {item('breastfeeding', a.interview.breastfeeding ? t(a.interview.breastfeeding) : '')}
          </dl>
        </section>
      )}
      <p>
        {t('observations')}: {value(a.interview.observations)}
      </p>
      <h3>{t('qualification')}</h3>
      <dl>
        {item('result', a.qualification.result ? t(a.qualification.result) : '')}
        {a.qualification.result === 'temporary' && (
          <>
            {item('duration', `${a.qualification.duration} ${t(a.qualification.durationUnit)}`)}
            {item(
              'returnDate',
              calculateReturnDate(a.admission.date, a.qualification.duration, a.qualification.durationUnit),
            )}
          </>
        )}
        {a.qualification.result !== 'eligible' && item('reason', a.qualification.reason)}
        {item('applicantName', a.qualification.applicantName)}
        {item('interviewerName', a.qualification.interviewerName)}
        {item('interviewerLicense', a.qualification.interviewerLicense)}
        {item('validatedBy', a.qualification.validatedBy)}
        {item('observations', a.qualification.observations)}
      </dl>
      <div data-signatures>
        <p>{t('applicantSignature')}: ______________________________</p>
        <p>{t('interviewerSignature')}: ____________________________</p>
        <p>{t('validatorSignature')}: ______________________________</p>
        <p>
          {t('fingerprint')}: <span data-fingerprint />
        </p>
      </div>
      <footer>{t('selectionIsNotTransfusionClearance')}</footer>
    </article>
  );
}

export const selectionPrintCss = `
  @page { size: A4; margin: 12mm; }
  body { font: 10pt Arial, sans-serif; color: #111; margin: 0; }
  header { text-align: center; } h2 { font-size: 13pt; } h3 { font-size: 11pt; padding: 5pt; background: #eee; }
  h3,h4 { break-after: avoid; } h4 { margin: 7pt 0 3pt; } dl { display: grid; grid-template-columns: 1fr 1fr; gap: 4pt 12pt; }
  dl > div { break-inside: avoid; } dt { font-weight: bold; } dd { margin: 2pt 0 4pt; white-space: pre-wrap; overflow-wrap: anywhere; }
  table { border-collapse: collapse; width: 100%; } td { border: 1px solid #ccc; padding: 4pt; } td:last-child { width: 75pt; }
  tr { break-inside: avoid; } p { overflow-wrap: anywhere; } [data-signatures] { break-inside: avoid; margin-top: 20pt; }
  [data-fingerprint] { display: inline-block; border: 1px solid #111; width: 20mm; height: 20mm; vertical-align: middle; }
  footer { margin-top: 15pt; font-size: 9pt; border-top: 1px solid #777; padding-top: 6pt; }
`;

/** Isolated print document: no global shell CSS, no pop-up, and React escapes every value. */
export function printSelectionReport(application: SelectionApplication, t: SelectionTranslate) {
  const frame = document.createElement('iframe');
  frame.title = t('reportTitle');
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0;';
  const remove = () => frame.remove();
  frame.onload = () => {
    frame.contentWindow?.addEventListener('afterprint', remove, { once: true });
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
  };
  frame.srcdoc = `<!doctype html><html lang="${document.documentElement.lang || 'es'}"><head><meta charset="utf-8"><style>${selectionPrintCss}</style></head><body>${renderToStaticMarkup(<SelectionReport application={application} t={t} />)}</body></html>`;
  document.body.appendChild(frame);
  setTimeout(remove, 120000);
}
