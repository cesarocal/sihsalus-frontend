import { localDateTime } from '../laboratory/screening/screening-rules';
import type { useConsentTranslation } from './paper-consent.component';
import type { ConsentRecord, ConsentSubject } from './paper-consent.resource';

export const recipientConsentPrintCss = `
  @page { size: A4; margin: 24mm 22mm 17mm; }
  body { margin: 0; color: #111; font: 9.5pt/1.45 Arial, sans-serif; }
  article { max-width: 164mm; margin: auto; }
  h1 { margin: 0; font-size: 11pt; text-transform: uppercase; }
  h1 small { margin-inline-start: 1.8mm; font-size: 7.5pt; font-weight: normal; text-transform: none; white-space: nowrap; }
  h2 { margin: 0 0 1.6mm; font-size: 9pt; text-transform: uppercase; }
  p { margin: 0; }
  .fr12-date { display: flex; align-items: center; gap: 2mm; margin: 14mm 0 7mm; }
  .fr12-digits { display: inline-flex; gap: .9mm; }
  .fr12-pair { display: inline-flex; }
  .fr12-digit { display: inline-grid; place-items: center; width: 4mm; height: 4mm; border: .25mm solid; line-height: 1; }
  .fr12-digit + .fr12-digit { border-inline-start: 0; }
  table { width: 100%; border: .25mm solid; border-spacing: 0; table-layout: fixed; }
  td { height: 8.2mm; box-sizing: border-box; padding: 1mm 1.2mm; overflow-wrap: anywhere; }
  td + td { border-inline-start: .25mm solid; }
  tr + tr td { border-block-start: .25mm solid; }
  tr { break-inside: avoid; }
  .fr12-sex { display: flex; flex-wrap: wrap; align-items: center; gap: 1mm; }
  .fr12-choice { display: inline-flex; align-items: center; gap: 1mm; white-space: nowrap; }
  .fr12-choice + .fr12-choice { margin-inline-start: 2mm; }
  .fr12-mark { display: inline-grid; place-items: center; width: 3.7mm; height: 3.7mm; border: .25mm solid; line-height: 1; }
  .fr12-age { display: flex; gap: 1mm; }
  .fr12-age span { margin-inline-start: auto; }
  .fr12-consent { margin-top: 12mm; min-height: 55mm; }
  .fr12-consent p { text-align: justify; overflow-wrap: anywhere; }
  .fr12-decision { display: flex; flex-wrap: wrap; align-items: center; gap: 2mm; margin-top: 3mm; }
  .fr12-signatures { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 10mm; margin: 10mm 4mm 0 8mm; break-inside: avoid; }
  .fr12-signature { margin: 0; border-top: .25mm solid; text-align: center; padding-top: 1mm; font-size: 8.5pt; }
  .fr12-representative { display: block; margin-block-start: 1mm; overflow-wrap: anywhere; }
  .fr12-fingerprint { display: flex; align-items: center; gap: 2mm; font-size: 8pt; }
  .fr12-fingerprint-box { width: 31mm; height: 38mm; border: .25mm solid; }
  .fr12-clinician { width: 46%; margin: 31mm auto 0; break-inside: avoid; }
`;

function choice(label: string, selected: boolean) {
  return (
    <span className="fr12-choice">
      <span className="fr12-mark">{selected ? '×' : ''}</span>
      {label}
    </span>
  );
}

export function RecipientConsentDocument({
  subject,
  record,
  t,
}: {
  subject: ConsentSubject;
  record: ConsentRecord;
  t: ReturnType<typeof useConsentTranslation>;
}) {
  const [year, month, day] = localDateTime(new Date(record.decidedAt)).slice(0, 10).split('-');
  return (
    <article data-fr12>
      <header>
        <h1>
          {t('fr12Heading')} <small>({t('fr12Page')})</small>
        </h1>
      </header>
      <div className="fr12-date">
        {t('fr12Date')}
        <span className="fr12-digits">
          <span className="fr12-pair">
            <span className="fr12-digit">{day[0]}</span>
            <span className="fr12-digit">{day[1]}</span>
          </span>
          <span className="fr12-pair">
            <span className="fr12-digit">{month[0]}</span>
            <span className="fr12-digit">{month[1]}</span>
          </span>
          <span className="fr12-pair">
            <span className="fr12-digit">{year[2]}</span>
            <span className="fr12-digit">{year[3]}</span>
          </span>
        </span>
      </div>
      <section>
        <h2>I. {t('fr12PersonalDetails')}</h2>
        <table>
          <colgroup>
            <col style={{ width: '27%' }} />
            <col style={{ width: '38%' }} />
            <col style={{ width: '35%' }} />
          </colgroup>
          <tbody>
            <tr>
              <td colSpan={3}>
                {t('fr12RecipientName')} {subject.name}
              </td>
            </tr>
            <tr>
              <td>
                <div className="fr12-age">
                  {t('fr12Age')}{' '}
                  <span>
                    {subject.age} {t('fr12Years')}
                  </span>
                </div>
              </td>
              <td>
                <div className="fr12-sex">
                  {t('fr12Sex')} {choice(t('fr12Male'), subject.sex === 'M')}{' '}
                  {choice(t('fr12Female'), subject.sex === 'F')}
                </div>
              </td>
              <td>
                {t('fr12HistoryNumber')} {subject.identification}
              </td>
            </tr>
            <tr>
              <td colSpan={2}>
                {t('fr12Service')} {subject.service}
              </td>
              <td>
                {t('fr12Bed')} {subject.bed}
              </td>
            </tr>
          </tbody>
        </table>
      </section>
      <section className="fr12-consent">
        <h2>II. {t('title')}</h2>
        <p>
          {t('recipientDeclaration')} {t('freeDecision')}
        </p>
        <div className="fr12-decision">
          {choice(t('fr12Accept'), record.decision === 'granted')}
          {choice(t('fr12Decline'), record.decision === 'declined')}
          {choice(t('fr12Revoke'), record.decision === 'revoked')}
        </div>
      </section>
      <div className="fr12-signatures">
        <p className="fr12-signature">
          {t('fr12RecipientSignature')}
          {record.signerRole === 'representative' && <strong className="fr12-representative">{record.signer}</strong>}
        </p>
        <div className="fr12-fingerprint">
          {t('fr12Fingerprint')} <span className="fr12-fingerprint-box" aria-hidden="true" />
        </div>
      </div>
      <p className="fr12-signature fr12-clinician">{t('fr12MedicalSignature')}</p>
    </article>
  );
}
