import type { ProcessingTranslate } from '../../shared/processing-page.component';
import { inventoryDisplayDate } from './inventory-rules';
import type { InventoryOperation } from './inventory.types';
import shared from '../applicant-selection/selection.scss';
import styles from './inventory.scss';
import { disposalCauseText } from './disposal-causes';
import { disposalActPrintCss } from './disposal-act-print';

// Stable positions of the empty ruled rows in the printed form, not editable records.
const emptyActRows = Array.from({ length: 20 }, (_, index) => `blank-${index + 1}`);

export function QualitySeals({
  operation,
  t,
  print = false,
}: {
  operation: InventoryOperation;
  t: ProcessingTranslate;
  print?: boolean;
}) {
  return (
    <div className={styles.seals}>
      {operation.units.map((unit) => (
        <article key={unit.id} data-label data-quality-seal className={styles.seal}>
          {print && <p data-demo>{t('printPrototype')}</p>}
          <h2>{t('inventoryQualitySeal')}</h2>
          <dl>
            {Object.entries({
              inventoryOperation: `${operation.id}/${unit.id}`,
              fractionationCode: unit.id,
              fractionationComponent: unit.component,
              bloodGroup: unit.bloodGroup,
              inventoryExpiration: inventoryDisplayDate(unit.expiresAt),
              inventoryDate: `${inventoryDisplayDate(operation.date)} ${operation.time}`,
              inventoryServiceResponsible: operation.serviceResponsible,
            }).map(([key, value]) => (
              <div key={key}>
                <dt>{t(key)}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <p>{t('inventoryNotTransfusionClearance')}</p>
        </article>
      ))}
    </div>
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
