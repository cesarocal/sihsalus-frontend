import type { ProcessingTranslate } from '../../shared/processing-page.component';
import { BloodGroupLabel } from '../../shared/blood-group-label.component';
import { processingPrintCss } from '../../shared/print-document';
import {
  finalComponentLabelFields,
  FinalComponentLabelNotes,
  FinalComponentTransfusionInstructions,
} from '../laboratory/fractionation/fractionation-documents.component';
import { formatScreeningCollectionTime } from '../laboratory/screening/screening-rules';
import hospitalLogo from '../collection/hospital-santa-clotilde.png';
import { inventoryDisplayDate, qualitySealCode } from './inventory-rules';
import type { InventoryOperation } from './inventory.types';
import shared from '../applicant-selection/selection.scss';
import styles from './inventory.scss';
import { disposalCauseText } from './disposal-causes';
import { disposalActPrintCss } from './disposal-act-print';

// Stable positions of the empty ruled rows in the printed form, not editable records.
const emptyActRows = Array.from({ length: 20 }, (_, index) => `blank-${index + 1}`);

export const qualitySealPrintCss = `${processingPrintCss}
  @page { @bottom-left { content: ""; } }
  [data-quality-seal] { margin-block-end: 5mm; break-inside: avoid; padding: 4mm; }
  [data-quality-seal] header { display: grid; grid-template-columns: 15mm 1fr; align-items: center; gap: 3mm; }
  [data-quality-seal] img { width: 100%; height: auto; }
  [data-quality-seal] h2 { margin: 0; text-transform: uppercase; }
  [data-quality-seal] header strong { display: block; text-align: center; font-size: 14pt; overflow-wrap: anywhere; }
  [data-quality-seal] h3 { margin-block: 5pt; text-align: center; }
  [data-quality-seal] dl { gap: 5pt; font-size: 9pt; }
  [data-quality-seal] footer { margin-top: 6pt; font-size: 8pt; }
  [data-quality-seal] footer p { margin: 2pt 0; }
`;

// Fixture markers are presentation text. Unit identifiers remain verbatim for traceability.
const labelText = (value?: string) => value?.replace(/\s*\(DEMO\)|\bDEMO\b|datos sint[eé]ticos/gi, '').trim();

export function QualitySeals({
  operation,
  t,
  unitIds,
}: {
  operation: InventoryOperation;
  t: ProcessingTranslate;
  unitIds?: string[];
}) {
  return (
    <div className={styles.seals}>
      {operation.units
        .filter((unit) => !unitIds || unitIds.includes(unit.id))
        .map((unit) => {
          const snapshot = operation.sealLabels?.[unit.id];
          const label = snapshot?.details;
          const lowVolume = snapshot?.lowVolume;
          const expiry = unit.expiresAt.includes('T')
            ? formatScreeningCollectionTime(unit.expiresAt)
            : inventoryDisplayDate(unit.expiresAt);
          return (
            <article key={unit.id} data-label data-quality-seal className={styles.seal}>
              <header>
                <img src={hospitalLogo} width={185} height={185} alt={t('certificateHospital')} />
                <div>
                  <h2>{t('inventoryQualitySeal')}</h2>
                  <strong>{qualitySealCode(operation, unit.id)}</strong>
                </div>
              </header>
              <h3>{labelText(unit.component)}</h3>
              <BloodGroupLabel value={unit.bloodGroup} t={t} />
              <dl>
                {Object.entries({
                  fractionationCode: unit.id,
                  fractionationOrigin: snapshot?.originalCode !== unit.id ? snapshot?.originalCode : '',
                  fractionationVolume: unit.volume && !lowVolume ? `${unit.volume} mL` : '',
                  ...finalComponentLabelFields(label, t),
                  fractionationExpiration: expiry,
                })
                  .filter(([, value]) => labelText(value))
                  .map(([key, value]) => (
                    <div key={key}>
                      <dt>{t(key)}</dt>
                      <dd>{key === 'fractionationCode' || key === 'fractionationOrigin' ? value : labelText(value)}</dd>
                    </div>
                  ))}
              </dl>
              {lowVolume && (
                <p>
                  {t('fractionationLowVolumeLabel')} <span data-manual-volume aria-hidden="true" />{' '}
                  {t('fractionationLowVolumeLabelUnit')}
                </p>
              )}
              <FinalComponentLabelNotes label={label} t={t} />
              <footer>
                <FinalComponentTransfusionInstructions t={t} />
                <p>{t('inventoryNotTransfusionClearance')}</p>
              </footer>
            </article>
          );
        })}
    </div>
  );
}

export function QualitySealReprintHistory({ operation, t }: { operation: InventoryOperation; t: ProcessingTranslate }) {
  if (!operation.sealReprints?.length) return null;
  return (
    <section>
      <h4>{t('inventoryReprintHistory')}</h4>
      <div className={shared.tableScroll}>
        <table className="cds--data-table cds--data-table--zebra" aria-label={t('inventoryReprintHistory')}>
          <thead>
            <tr>
              {[
                'inventoryReprintNumber',
                'inventoryDate',
                'inventoryProcedureResponsible',
                'inventoryUnits',
                'inventoryReprintReason',
              ].map((key) => (
                <th key={key} scope="col">
                  {t(key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {operation.sealReprints.map((attempt) => (
              <tr key={attempt.number}>
                <td>{attempt.number}</td>
                <td>{new Date(attempt.requestedAt).toLocaleString()}</td>
                <td>{attempt.operator}</td>
                <td>{attempt.unitIds.join(', ')}</td>
                <td>{attempt.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
export function DisposalAct({
  operation,
  t,
  print = false,
}: {
  operation: InventoryOperation;
  t: ProcessingTranslate;
  print?: boolean;
}) {
  return (
    <article className={styles.review} data-disposal-act>
      {print && <style>{disposalActPrintCss}</style>}
      {print && <p data-demo>{t('printPrototype')}</p>}
      {operation.stage !== 'completed' && <p data-act-draft>{t('inventoryDraftAct')}</p>}
      <h2>EG010-FR02: {t('inventoryActTitle')}</h2>
      <p data-act-date className={styles.help}>
        {t('inventoryActDateLead')} <strong>{inventoryDisplayDate(operation.date)}</strong>, {t('inventoryActTimeLead')}{' '}
        <strong>{operation.time || '—'}</strong> {t('inventoryActWitnessLead')}
      </p>
      <p data-act-witnesses className={styles.witnesses}>
        {operation.witnesses || '—'}
      </p>
      <p data-act-introduction className={styles.help}>
        {t('inventoryActIntroduction')}
      </p>
      <div className={shared.tableScroll}>
        <table className="cds--data-table cds--data-table--zebra" aria-label={t('inventoryActTitle')}>
          <colgroup>
            <col style={{ width: '16%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '27%' }} />
            <col style={{ width: '36%' }} />
          </colgroup>
          <thead>
            <tr>
              {[
                'inventoryUnitNumber',
                'inventoryAbo',
                'inventoryRh',
                'inventoryDisposedComponent',
                'inventoryDisposalCause',
              ].map((key) => (
                <th key={key}>{t(key)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {operation.units.map((unit) => (
              <tr key={unit.id}>
                <td>{unit.id}</td>
                <td>{unit.bloodGroup.replace(/[+−-]$/, '') || '—'}</td>
                <td>{/[+−-]$/.exec(unit.bloodGroup)?.[0] || '—'}</td>
                <td>{unit.component}</td>
                <td>{disposalCauseText(operation.causes[unit.id], t)}</td>
              </tr>
            ))}
            {print &&
              emptyActRows.slice(operation.units.length).map((rowId) => (
                <tr key={rowId} data-act-blank>
                  <td>&nbsp;</td>
                  <td />
                  <td />
                  <td />
                  <td />
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {operation.stage === 'completed' && <p className={styles.help}>{t('inventoryEliminated')}</p>}
      <footer>
        <p className={styles.signature} data-signature>
          <span>{t('inventoryServiceSignature')}:</span>
          <span data-signature-name>{operation.serviceResponsible}</span>
        </p>
        <p className={styles.signature} data-signature>
          <span>{t('inventoryEpidemiologySignature')}:</span>
          <span data-signature-name>{operation.epidemiologyResponsible}</span>
        </p>
      </footer>
    </article>
  );
}
