import type { useConsentTranslation } from './paper-consent.component';
import type { ConsentSubject } from './paper-consent.resource';

export const recipientConsentPrintCss = `
  @page { size: A4; margin: 23mm 20mm 18mm; }
  body { margin: 0; color: #141414; font: 10pt/1.4 Arial, sans-serif; }
  article { max-width: 170mm; margin: auto; }
  h1 { margin: 0; font-size: 12pt; text-transform: uppercase; }
  h1 small { margin-inline-start: 2mm; font-size: 8pt; font-weight: normal; text-transform: none; white-space: nowrap; }
  h2 { margin: 0 0 1.5mm; font-size: 9pt; text-transform: uppercase; }
  p { margin: 0; }
  .fr12-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 2mm 5mm; margin: 10mm 0 6mm; }
  .fr12-part { display: inline-flex; align-items: center; gap: 1.1mm; }
  .fr12-digits { display: inline-flex; }
  .fr12-digit, .fr12-mark { display: inline-grid; place-items: center; width: 4mm; height: 4mm; border: .25mm solid; }
  .fr12-digit + .fr12-digit { border-inline-start: 0; }
  .fr12-line { display: inline-block; min-width: 22mm; height: 3.8mm; border-bottom: .25mm solid; vertical-align: baseline; }
  .fr12-meta .fr12-facility { flex-basis: 100%; }
  .fr12-facility .fr12-line { width: 62mm; }
  .fr12-order { margin-inline-start: auto; overflow-wrap: anywhere; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  td { border: .25mm solid; padding: 1.45mm 1.8mm; overflow-wrap: anywhere; }
  tr { break-inside: avoid; }
  .fr12-choice { display: inline-flex; align-items: center; gap: 1mm; white-space: nowrap; }
  .fr12-choice + .fr12-choice { margin-inline-start: 3mm; }
  .fr12-personal, .fr12-signatures { break-inside: avoid; }
  .fr12-consent { margin-top: 10mm; }
  .fr12-consent > p { text-align: justify; }
  .fr12-conversation { margin-top: 3mm; }
  .fr12-conversation p { margin: 1.2mm 0; min-height: 5.5mm; border-bottom: .25mm solid #666; }
  .fr12-decision { margin: 4mm 0; display: flex; flex-wrap: wrap; align-items: center; gap: 2mm 3mm; }
  .fr12-representative { display: flex; flex-wrap: wrap; align-items: baseline; gap: 1mm; }
  .fr12-representative .fr12-line { flex: 1; }
  .fr12-signatures { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 4mm 10mm; margin: 11mm 3mm 0; }
  .fr12-signature { width: 86%; margin: 0 auto; border-top: .25mm solid; text-align: center; padding-top: 1.2mm; font-size: 9pt; }
  .fr12-fingerprint { display: flex; align-items: center; gap: 2mm; font-size: 8pt; }
  .fr12-fingerprint-box { width: 30mm; height: 34mm; border: .25mm solid; }
  .fr12-clinician { grid-column: 1 / -1; width: 50%; margin-top: 13mm; }
  .fr12-clinician p { margin-top: 1.4mm; }
`;

const twoDigits = ['tens', 'units'];
const fourDigits = ['thousands', 'hundreds', ...twoDigits];

function digits(positions: readonly string[]) {
  return (
    <span className="fr12-digits" aria-hidden="true">
      {positions.map((position) => (
        <span className="fr12-digit" key={position} />
      ))}
    </span>
  );
}

function choice(label: string, selected = false) {
  return (
    <span className="fr12-choice" key={label}>
      <span className="fr12-mark">{selected ? '×' : ''}</span>
      {label}
    </span>
  );
}

export function RecipientConsentDocument({
  subject,
  t,
}: {
  subject: ConsentSubject;
  t: ReturnType<typeof useConsentTranslation>;
}) {
  const blank = <span className="fr12-line" aria-hidden="true" />;
  return (
    <article data-fr12>
      <header>
        <h1>
          EG05 - FR12: {t('recipientTitle')} <small>({t('fr12Page')})</small>
        </h1>
      </header>
      <div className="fr12-meta">
        <span className="fr12-facility">
          {t('fr12Facility')} {blank}
        </span>
        <span className="fr12-part">
          {t('fr12Date')} {digits(twoDigits)} {digits(twoDigits)} {digits(fourDigits)}
        </span>
        <span className="fr12-part">
          {t('fr12Time')} {blank}
        </span>
        <span className="fr12-order">
          {t('requestNumber')} <strong>{subject.number}</strong>
        </span>
        <span>
          {t('folio')} {blank}
        </span>
      </div>
      <section className="fr12-personal">
        <h2>I. {t('fr12PersonalDetails')}</h2>
        <table>
          <colgroup>
            <col style={{ width: '22%' }} />
            <col style={{ width: '40%' }} />
            <col style={{ width: '38%' }} />
          </colgroup>
          <tbody>
            <tr>
              <td colSpan={3}>
                {t('fullName')}: <strong>{subject.name}</strong>
              </td>
            </tr>
            <tr>
              <td>
                {t('fr12Age')}: {subject.age ? `${subject.age} ${t('fr12Years')}` : blank}
              </td>
              <td>
                {t('fr12Sex')}: {choice(t('fr12Male'), subject.sex === 'M')}{' '}
                {choice(t('fr12Female'), subject.sex === 'F')}
              </td>
              <td>
                {t('historyNumber')}: <strong>{subject.identification}</strong>
              </td>
            </tr>
            <tr>
              <td colSpan={2}>
                {t('service')}: {subject.service || blank}
              </td>
              <td>
                {t('bed')}: {subject.bed || blank}
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
        <div className="fr12-conversation">
          <p>{t('fr12IndicationAndBenefits')}</p>
          <p>{t('fr12RisksAndEffects')}</p>
          <p aria-hidden="true" />
          <p>{t('fr12AlternativesAndConsequences')}</p>
        </div>
        <div className="fr12-decision">
          <strong>{t('decision')}</strong>
          {choice(t('fr12Accept'))}
          {choice(t('fr12Decline'))}
          {choice(t('fr12Revoke'))}
        </div>
        <p className="fr12-representative">
          {t('representativeDetails')} {blank}
        </p>
      </section>
      <div className="fr12-signatures">
        <p className="fr12-signature">{t('recipientSignature')}</p>
        <div className="fr12-fingerprint">
          {t('fr12Fingerprint')} <span className="fr12-fingerprint-box" aria-hidden="true" />
        </div>
        <div className="fr12-signature fr12-clinician">
          {t('fr12MedicalSignature')}
          <p>
            {t('fr12MedicalRegistration')} {blank}
          </p>
        </div>
      </div>
    </article>
  );
}
