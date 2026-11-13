import { Accordion, AccordionItem } from '@carbon/react';
import { BloodGroupLabel } from '../../../shared/blood-group-label.component';
import type { ProcessingTranslate } from '../../../shared/processing-page.component';
import { componentDefinitions, finalNodes } from './fractionation-rules';
import type { ComponentLabel, FractionationBatch } from './fractionation.types';
import { FractionationTree } from './fractionation-tree.component';
import { fractionationDateTime } from './fractionation-format';
import shared from '../../applicant-selection/selection.scss';
import styles from './fractionation.scss';

export function finalComponentLabelFields(label: ComponentLabel | undefined, t: ProcessingTranslate) {
  if (!label) return {};
  return {
    anticoagulant: label.anticoagulant,
    preservative: label.preservative,
    sedimentingAgent: label.sedimentingAgent,
    service: label.collectionService,
    fractionationService: label.processingService,
    fractionationTemperature: label.storageTemperature,
    fractionationAntibodies: label.antibodies,
    fractionationCmvSeronegative: label.cmvIgGResult
      ? t(
          label.cmvIgGResult === 'nonReactive'
            ? 'fractionationCmvYes'
            : label.cmvIgGResult === 'reactive'
              ? 'fractionationCmvNo'
              : 'inconclusive',
        )
      : '',
    ...(label.autologous
      ? {
          recipientName: label.recipientName,
          recipientDocument: label.recipientDocument,
          recipientService: label.recipientService,
          recipientHistory: label.recipientHistory,
        }
      : {}),
  };
}

export function FinalComponentLabelNotes({ label, t }: { label?: ComponentLabel; t: ProcessingTranslate }) {
  return (
    <>
      {label?.voluntary && <p>{t('fractionationVoluntary')}</p>}
      {label?.remunerated && <p>{t('fractionationRemunerated')}</p>}
      {label?.leukocytesReduced && <p>{t('leukocytesReduced')}</p>}
      {label?.autologous && <p>{t('fractionationAutologousOnly')}</p>}
    </>
  );
}

export function FinalComponentTransfusionInstructions({ t }: { t: ProcessingTranslate }) {
  return (
    <>
      <p>{t('fractionationCircular')}</p>
      <p>{t('fractionationRecipientCheck')}</p>
      <p>{t('fractionationInfectionWarning')}</p>
      <p>{t('fractionationRx')}</p>
    </>
  );
}

export function FractionationLabels({
  batch,
  actual = false,
  print = false,
  nodeId,
  showDemoMark = true,
  t,
}: {
  batch: FractionationBatch;
  actual?: boolean;
  print?: boolean;
  nodeId?: string;
  showDemoMark?: boolean;
  t: ProcessingTranslate;
}) {
  return (
    <>
      {finalNodes(batch)
        .filter((node) => !nodeId || node.id === nodeId)
        .map((node) => {
          const label = node.label;
          const source = batch.sources.find((unit) => unit.id === node.sourceId);
          const values = {
            fractionationCode: node.code,
            fractionationOrigin: source?.originalWholeBloodCode,
            fractionationSource: source?.code,
            fractionationVolume: !print && actual && node.component !== 'lowVolumeRedCells' ? node.volume : '',
            ...finalComponentLabelFields(label, t),
            fractionationExpiration: label.expiresAt ? fractionationDateTime(label.expiresAt) : '',
          };
          return (
            <article data-label key={node.id} className={shared.report} style={{ breakAfter: 'page' }}>
              {showDemoMark && <p data-demo>{t('printPrototype')}</p>}
              <h2>{t(componentDefinitions[node.component].key)}</h2>
              <BloodGroupLabel value={label.bloodGroup} t={t} />
              <dl>
                {Object.entries(values)
                  .filter(([, value]) => value)
                  .map(([key, value]) => (
                    <div key={key}>
                      <dt>{t(key)}</dt>
                      <dd>
                        {value}
                        {key === 'fractionationVolume' && ' mL'}
                      </dd>
                    </div>
                  ))}
                {print && node.component !== 'lowVolumeRedCells' && (
                  <div>
                    <dt>{t('fractionationVolume')}</dt>
                    <dd>
                      <span data-manual-volume aria-hidden="true" /> mL
                    </dd>
                  </div>
                )}
              </dl>
              {node.component === 'lowVolumeRedCells' && (print || actual) && (
                <p data-low-volume-label>
                  {t('fractionationLowVolumeLabel')}{' '}
                  {print ? <span data-manual-volume aria-hidden="true" /> : node.volume}{' '}
                  {t('fractionationLowVolumeLabelUnit')}
                </p>
              )}
              <FinalComponentLabelNotes label={label} t={t} />
              <footer>
                <FinalComponentTransfusionInstructions t={t} />
                <p>
                  {t('quarantine')} — {t('fractionationQuarantineHelp')}
                </p>
              </footer>
            </article>
          );
        })}
    </>
  );
}

export function FractionationReview({ batch, t }: { batch: FractionationBatch; t: ProcessingTranslate }) {
  const values = {
    fractionationProcess: batch.id,
    fractionationOperator: batch.operator,
    fractionationService: batch.service,
    fractionationSystem: batch.system ? t(batch.system === 'open' ? 'fractionationOpen' : 'fractionationClosed') : '—',
    fractionationStartedAt: fractionationDateTime(batch.startedAt),
    fractionationCompletedAt: batch.completedAt ? fractionationDateTime(batch.completedAt) : '',
    observations: batch.observations,
  };
  return (
    <div className={styles.review}>
      <dl className={shared.fields}>
        {Object.entries(values)
          .filter(([, value]) => value)
          .map(([key, value]) => (
            <div key={key}>
              <dt>{t(key)}</dt>
              <dd>{value}</dd>
            </div>
          ))}
      </dl>
      <FractionationTree batch={batch} t={t} />
      <div className={shared.tableScroll}>
        <table className="cds--data-table cds--data-table--zebra" aria-label={t('fractionationResults')}>
          <thead>
            <tr>
              {[
                'fractionationSource',
                'fractionationCode',
                'fractionationComponent',
                'fractionationVolume',
                'fractionationExpiration',
                'fractionationDestination',
              ].map((key) => (
                <th key={key}>{t(key)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {finalNodes(batch).map((node) => (
              <tr key={node.id}>
                <td>{batch.sources.find((source) => source.id === node.sourceId)?.code}</td>
                <td>{node.code}</td>
                <td>{t(componentDefinitions[node.component].key)}</td>
                <td>{node.volume || '—'}</td>
                <td>{fractionationDateTime(node.label.expiresAt)}</td>
                <td>{t('quarantine')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Accordion className={styles.componentDetails}>
        {finalNodes(batch)
          .filter((node) => node.parentId !== null)
          .map((node) => (
            <AccordionItem key={node.id} title={`${t(componentDefinitions[node.component].key)} — ${node.code}`}>
              <FractionationLabels batch={batch} nodeId={node.id} actual showDemoMark={false} t={t} />
            </AccordionItem>
          ))}
      </Accordion>
      <p className={styles.help}>{t('fractionationQuarantineHelp')}</p>
    </div>
  );
}
