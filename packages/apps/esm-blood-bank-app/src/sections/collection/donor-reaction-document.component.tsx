import type { ReactNode } from 'react';
import { formatListDate } from '../../shared/format-list-date';
import { processingPrintCss } from '../../shared/print-document';
import type { ProcessingTranslate } from '../../shared/processing-page.component';
import { formatDonorDate } from '../donors/donor-utils';
import hemoStyles from '../hemovigilance/hemovigilance.scss';
import {
  type DonorBloodPressure,
  type DonorReaction,
  type DonorReactionIdentity,
  donorReactionOptions,
  donorVitalFields,
} from './donor-reaction';
import styles from './donor-reaction.scss';
import hospitalLogo from './hospital-santa-clotilde.png?inline';

export const donorReactionPrintCss = `${processingPrintCss}
  @page { size: A4; margin: 8mm 10mm; }
  body { font-size: 8.5pt; line-height: 1.12; }
  article { max-width: 185mm; }
  .rad-letterhead { display: flex; align-items: center; gap: 10pt; padding-bottom: 4pt; border-bottom: 2px solid #222; }
  .rad-letterhead img { width: 36pt; height: 36pt; object-fit: contain; }
  .rad-letterhead div { display: grid; gap: 1pt; }
  .rad-letterhead small { margin-inline-start: auto; }
  h1 { margin: 6pt 0 2pt; font-size: 13pt; text-align: center; }
  .rad-print-status { margin: 0 0 4pt; text-align: center; }
  .rad-print-section { margin-top: 4pt; border: 1px solid #666; break-inside: avoid; }
  .rad-print-section h2 { margin: 0; padding: 2pt 5pt; border-bottom: 1px solid #888; font-size: 9pt; text-align: left; }
  .rad-facts { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 2pt 6pt; padding: 3pt 5pt; margin: 0; }
  .rad-facts dt { font-size: 8pt; }
  .rad-facts dd { margin: 1pt 0; }
  .rad-print-narrative { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .rad-marks { margin: 0; padding: 1pt 5pt; display: flex; flex-wrap: wrap; gap: 1pt 7pt; align-items: baseline; }
  .rad-vitals { margin-top: 2pt; font-size: 8pt; }
  .rad-vitals th, .rad-vitals td { padding: 2pt 4pt; text-align: center; }
  .rad-vitals th:first-child { text-align: left; }
  .rad-mark { display: inline-flex; align-items: center; gap: 3pt; }
  .rad-mark-box { display: inline-grid; place-items: center; width: 8pt; height: 8pt; border: 1px solid #333; font-size: 7pt; line-height: 1; }
  .rad-signature { width: 45%; margin: 9pt 4pt 3pt auto; text-align: center; border-top: 1px solid #666; padding-top: 2pt; }
  [data-demo] { font-size: 8pt; padding: 3pt; font-weight: normal; }
`;

type Facts = Array<[string, string | undefined]>;
const displayPressure = (pressure?: DonorBloodPressure) =>
  pressure?.systolic || pressure?.diastolic ? `${pressure.systolic || '—'}/${pressure.diastolic || '—'} mmHg` : '';

function donorFacts(identity: DonorReactionIdentity, t: ProcessingTranslate): Facts {
  return [
    ['applicantNumber', identity.applicationNumber],
    ['radIdentityDocument', identity.document],
    ['age', identity.age],
    ['sex', identity.sex && t(identity.sex === 'F' ? 'female' : 'male')],
    ['hemoglobin', identity.hemoglobin],
    ['hematocrit', identity.hematocrit],
    ['radWeight', identity.weight],
    ['radHeight', identity.height],
  ];
}

function donationFacts(identity: DonorReactionIdentity, t: ProcessingTranslate): Facts {
  return [
    ['radDonationDate', formatDonorDate(identity.donationDate ?? '')],
    ['modality', identity.modality && t(identity.modality)],
    ['radDonorType', identity.donationType && t(`radDonorType_${identity.donationType}`)],
    ['unitCode', identity.unitCode],
    ['bagLot', identity.bagLot],
    ['service', identity.collectionService],
  ];
}

function eventFacts(report: DonorReaction, t: ProcessingTranslate): Facts {
  return [
    ['radType', t(`radType_${report.type}`)],
    ['radPhase', t(`radPhase_${report.phase}`)],
    ['radOccurredAt', formatListDate(report.occurredAt)],
    ['radNotifiedTo', report.notifiedTo],
    ['radNotifiedAt', formatListDate(report.notifiedAt)],
  ];
}

function assessmentFacts(assessment: NonNullable<DonorReaction['assessment']>, t: ProcessingTranslate): Facts {
  return [
    ['radEvaluatedBy', assessment.evaluatedBy],
    ['radEvaluatedAt', formatListDate(assessment.evaluatedAt)],
    ['radDecision', t(`radDecision_${assessment.collectionDecision}`)],
    ['radDiagnosis', assessment.diagnosis],
    ['radCare', assessment.care],
    ['radOutcome', assessment.outcome],
    ['radRecommendations', assessment.recommendations],
  ];
}

function vitalFacts(values: DonorReaction['initialVitals']): Facts {
  return donorVitalFields.map((key) => [`radVital_${key}`, values[key]]);
}

function recordedVitals(report: DonorReaction): Array<[string, DonorReaction['initialVitals']]> {
  return [
    ['radInitialVitals', report.initialVitals],
    ['radFinalVitals', report.finalVitals],
  ];
}

function staffFacts(report: DonorReaction): Facts {
  return [
    ['radReportedBy', report.reportedBy],
    ['radProfession', report.institutional?.profession],
    ['radRecordedAt', formatListDate(report.reportedAt)],
  ];
}

function FactList({ values, t, className }: { values: Facts; t: ProcessingTranslate; className?: string }) {
  return (
    <dl className={className}>
      {values.map(([key, value]) => (
        <div key={key}>
          <dt>{t(key)}</dt>
          <dd>{value || '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

export function DonorReactionSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={hemoStyles.sheetCard}>
      <header className={hemoStyles.cardHeader}>
        <h3>{title}</h3>
      </header>
      {children}
    </section>
  );
}

export function DonorReactionSummary({ identity, t }: { identity: DonorReactionIdentity; t: ProcessingTranslate }) {
  return (
    <DonorReactionSection title={t('radDonorData')}>
      <div className={hemoStyles.summaryGrid}>
        <div>
          <span className={hemoStyles.summaryLabel}>{t('donorName')}</span>
          <p className={hemoStyles.recipientName}>{identity.name}</p>
          <FactList values={donorFacts(identity, t)} t={t} className={styles.facts} />
        </div>
        <div className={hemoStyles.unitSummary}>
          <h4>{t('radDonationDetails')}</h4>
          <FactList values={donationFacts(identity, t)} t={t} className={styles.facts} />
        </div>
      </div>
    </DonorReactionSection>
  );
}

export function DonorReactionRecordedDetails({ report, t }: { report: DonorReaction; t: ProcessingTranslate }) {
  const details = report.institutional;
  const options = (group: keyof typeof donorReactionOptions) =>
    [details?.[group] ?? []]
      .flat()
      .map((key) => t(`radOption_${key}`))
      .join(', ');
  const pressure: Facts = [
    ['radDonationStartPressure', displayPressure(details?.donationStartPressure)],
    ['radTwentyMinutePressure', displayPressure(details?.twentyMinutePressure)],
  ];
  return (
    <>
      <DonorReactionSection title={t('radDonationConditions')}>
        <FactList
          className={styles.facts}
          t={t}
          values={[
            ['radSite', options('site')],
            ['radDonorFrequency', options('donorFrequency')],
            ['radDonorConditions', options('donorConditions')],
            ['radEnvironment', options('environment')],
            ...pressure,
          ]}
        />
      </DonorReactionSection>
      <DonorReactionSection title={t('radEventData')}>
        <FactList
          className={styles.facts}
          t={t}
          values={[
            ...eventFacts(report, t),
            ['radLocalReactions', options('localReactions')],
            ...(report.type === 'vasovagal'
              ? ([
                  ['radConsciousness', options('consciousness')],
                  ['radVasovagalSite', options('vasovagalSite')],
                ] satisfies Facts)
              : []),
            ['radGeneralSymptoms', options('generalSymptoms')],
            ['radSevereSymptoms', options('severeSymptoms')],
          ]}
        />
        <FactList
          className={styles.narrative}
          t={t}
          values={[
            ['radSigns', report.signs],
            ['radInitialCare', report.initialCare],
          ]}
        />
        {recordedVitals(report).map(([key, values]) =>
          Object.values(values).some(Boolean) ? (
            <div className={styles.detailGroup} key={key}>
              <h4>{t(key)}</h4>
              <FactList className={styles.facts} t={t} values={vitalFacts(values)} />
            </div>
          ) : null,
        )}
      </DonorReactionSection>
      <DonorReactionSection title={t('radReportingStaff')}>
        <FactList className={styles.facts} t={t} values={staffFacts(report)} />
      </DonorReactionSection>
      {report.assessment && (
        <DonorReactionSection title={t('radAssessment')}>
          <FactList className={styles.facts} t={t} values={assessmentFacts(report.assessment, t).slice(0, 3)} />
          <FactList className={styles.narrative} t={t} values={assessmentFacts(report.assessment, t).slice(3)} />
        </DonorReactionSection>
      )}
    </>
  );
}

export function DonorReactionPrint({
  identity,
  report,
  t,
}: {
  identity: DonorReactionIdentity;
  report: DonorReaction;
  t: ProcessingTranslate;
}) {
  const details = report.institutional;
  const vitals = recordedVitals(report).filter(([, values]) => Object.values(values).some(Boolean));
  const facts = (values: Facts, narrative = false) => (
    <FactList values={values} t={t} className={narrative ? 'rad-facts rad-print-narrative' : 'rad-facts'} />
  );
  const section = (title: string, children: ReactNode) => (
    <section className="rad-print-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
  const marks = (label: string, options: readonly string[], selected: readonly string[], keyPrefix = 'radOption_') => (
    <p className="rad-marks">
      <strong>{t(label)}</strong>
      {options.map((key) => (
        <span className="rad-mark" key={key}>
          <span className="rad-mark-box">{selected.includes(key) ? '✓' : ''}</span>
          {t(`${keyPrefix}${key}`)}
        </span>
      ))}
    </p>
  );
  return (
    <article>
      <header className="rad-letterhead">
        <img src={hospitalLogo} alt="Hospital Santa Clotilde" />
        <div>
          <strong>HOSPITAL II-1 SANTA CLOTILDE</strong>
          <strong>“NERI RIVADENEYRA RAMOS”</strong>
          <span>Río Napo, Maynas, Loreto, Perú</span>
        </div>
        <small data-demo>{t('radMockPrintNotice')}</small>
      </header>
      <h1>{t('radInstitutionalTitle')}</h1>
      <p className="rad-print-status">{t(report.assessment ? 'radEvaluatedStatus' : 'radPending')}</p>
      {section(
        `I. ${t('radDonorData')}`,
        facts([
          ['donorName', identity.name],
          ...donorFacts(identity, t),
          ['radDonationDate', formatDonorDate(identity.donationDate ?? '')],
          ['radDonationStartPressure', displayPressure(details?.donationStartPressure)],
          ['radTwentyMinutePressure', displayPressure(details?.twentyMinutePressure)],
        ]),
      )}
      {section(
        `II. ${t('radDonationConditions')}`,
        <>
          {facts(donationFacts(identity, t).slice(3))}
          {marks('radSite', donorReactionOptions.site, details?.site ? [details.site] : [])}
          {marks(
            'radDonorType',
            ['autologous', 'replacement', 'voluntary'],
            [identity.donationType ?? ''],
            'radDonorType_',
          )}
          {marks('modality', ['wholeBlood', 'apheresis'], [identity.modality], '')}
          {marks(
            'radDonorFrequency',
            donorReactionOptions.donorFrequency,
            details?.donorFrequency ? [details.donorFrequency] : [],
          )}
          {marks('radDonorConditions', donorReactionOptions.donorConditions, details?.donorConditions ?? [])}
          {marks('radEnvironment', donorReactionOptions.environment, details?.environment ? [details.environment] : [])}
        </>,
      )}
      {section(
        `III. ${t('radType')}`,
        <>
          {facts(eventFacts(report, t))}
          {marks('radLocalReactions', donorReactionOptions.localReactions, details?.localReactions ?? [])}
          {report.type === 'vasovagal' && (
            <>
              {marks(
                'radConsciousness',
                donorReactionOptions.consciousness,
                details?.consciousness ? [details.consciousness] : [],
              )}
              {marks(
                'radVasovagalSite',
                donorReactionOptions.vasovagalSite,
                details?.vasovagalSite ? [details.vasovagalSite] : [],
              )}
            </>
          )}
          {marks('radGeneralSymptoms', donorReactionOptions.generalSymptoms, details?.generalSymptoms ?? [])}
          {marks('radSevereSymptoms', donorReactionOptions.severeSymptoms, details?.severeSymptoms ?? [])}
          {facts(
            [
              ['radSigns', report.signs],
              ['radInitialCare', report.initialCare],
            ],
            true,
          )}
          {vitals.length > 0 && (
            <table className="rad-vitals">
              <thead>
                <tr>
                  <th scope="col">{t('radAdditionalVitals')}</th>
                  {donorVitalFields.map((key) => (
                    <th key={key} scope="col">
                      {t(`radVital_${key}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vitals.map(([key, values]) => (
                  <tr key={key}>
                    <th scope="row">{t(key)}</th>
                    {donorVitalFields.map((field) => (
                      <td key={field}>{values[field] || '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>,
      )}
      {section(
        `IV. ${t('reactionSeverity')}`,
        marks(
          'reactionSeverity',
          ['severe', 'moderate', 'mild'],
          report.assessment ? [report.assessment.severity] : [],
          'severity_',
        ),
      )}
      {section(
        `V. ${t('radReportingStaff')}`,
        <>
          {facts(staffFacts(report))}
          <p className="rad-signature">{t('radReporterSignature')}</p>
        </>,
      )}
      {report.assessment &&
        section(
          t('radAssessment'),
          <>
            {facts([
              ['applicantNumber', identity.applicationNumber],
              ...assessmentFacts(report.assessment, t).slice(0, 3),
            ])}
            {facts(assessmentFacts(report.assessment, t).slice(3), true)}
            <p className="rad-signature">{t('radMedicalSignature')}</p>
          </>,
        )}
    </article>
  );
}
