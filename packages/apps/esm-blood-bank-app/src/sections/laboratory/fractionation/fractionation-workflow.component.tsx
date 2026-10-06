import {
  Button,
  Checkbox,
  ComposedModal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  TextArea,
  TextInput,
} from '@carbon/react';
import { Printer } from '@carbon/react/icons';
import { useState } from 'react';
import type { FractionationApi } from '../../../api/fractionation.api';
import { notifySuccess } from '../../../shared/notify-success';
import { ProcessingModal } from '../../../shared/processing-modal.component';
import type { ProcessingTranslate } from '../../../shared/processing-page.component';
import { printDocument } from '../../../shared/print-document';
import { FractionationLabels, FractionationReview } from './fractionation-documents.component';
import { FractionationContent } from './fractionation-content.component';
import { componentDefinitions, finalNodes, splitNode, validateFractionation } from './fractionation-rules';
import { FractionationTree } from './fractionation-tree.component';
import {
  fractionationSteps,
  type ComponentLabel,
  type FractionationBatch,
  type FractionationNode,
} from './fractionation.types';
import shared from '../../applicant-selection/selection.scss';
import styles from './fractionation.scss';

export function FractionationWorkflow({
  initial,
  api,
  onClose,
  onSaved,
  t,
}: {
  initial: FractionationBatch;
  api: FractionationApi;
  onClose: () => void;
  onSaved: () => void;
  t: ProcessingTranslate;
}) {
  const [batch, setBatch] = useState(initial);
  const [step, setStep] = useState(Math.min(initial.completedSteps.length, 3));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [failed, setFailed] = useState('');
  const [confirm, setConfirm] = useState(false);
  const leaves = finalNodes(batch);
  const change = (next: FractionationBatch) => {
    setBatch(next);
    setDirty(true);
    setFailed('');
  };
  const updateNode = (id: string, update: Partial<FractionationNode>) =>
    change({
      ...batch,
      finalChecks: false,
      labelsVerified: update.label || update.estimatedVolume !== undefined ? false : batch.labelsVerified,
      nodes: batch.nodes.map((node) => (node.id === id ? { ...node, ...update } : node)),
    });
  const save = async (advance = false) => {
    if (saving) return false;
    const missing = advance ? validateFractionation(batch, fractionationSteps[step]) : [];
    setErrors(missing);
    setFailed('');
    if (missing.length) return false;
    if (!dirty && !advance) return true;
    setSaving(true);
    try {
      const result = await api.save(batch, advance ? fractionationSteps[step] : undefined);
      setBatch(result);
      setDirty(false);
      if (result.revision !== batch.revision)
        notifySuccess(
          t(
            advance
              ? ['fractionationPlanSaved', 'fractionationLabelsSaved', 'fractionationVolumesSaved'][step]
              : 'fractionationDraftSaved',
          ),
        );
      onSaved();
      if (advance) setStep((value) => value + 1);
      return true;
    } catch {
      setFailed('fractionationSaveFailed');
      return false;
    } finally {
      setSaving(false);
    }
  };
  const print = () => {
    setFailed('');
    const missing = validateFractionation(batch, 'fractionationLabels').filter(
      (key) => key !== 'fractionationVerifyLabels',
    );
    if (step >= 2)
      missing.push(...validateFractionation(batch, 'fractionationVolumes').filter((key) => !missing.includes(key)));
    setErrors(missing);
    if (missing.length) return;
    try {
      printDocument(<FractionationLabels batch={batch} actual={step >= 2} t={t} />, t('fractionationPrint'));
    } catch {
      setFailed('printFailed');
    }
  };
  const labelInput = (
    node: FractionationNode,
    field: keyof Pick<
      ComponentLabel,
      | 'anticoagulant'
      | 'preservative'
      | 'sedimentingAgent'
      | 'collectionService'
      | 'processingService'
      | 'storageTemperature'
      | 'expiresAt'
      | 'antibodies'
    >,
    key: string,
  ) => (
    <TextInput
      key={field}
      id={`${node.id}-${field}`}
      labelText={t(key)}
      value={node.label[field]}
      disabled={saving}
      type={field === 'expiresAt' ? 'datetime-local' : 'text'}
      onChange={(event) =>
        updateNode(node.id, {
          label: { ...node.label, [field]: event.target.value },
        })
      }
    />
  );
  return (
    <>
      <ProcessingModal
        title={`${t('fractionationTitle')} — ${batch.id}`}
        steps={fractionationSteps}
        step={step}
        completed={batch.completedSteps}
        finalized={false}
        closeDisabled={confirm}
        saving={saving}
        errors={errors}
        failed={failed}
        saveErrorText={t('fractionationSaveFailed')}
        onClose={onClose}
        onSaveBeforeExit={async () => (!dirty ? 'unchanged' : (await save()) ? 'saved' : 'failed')}
        onPrevious={() => {
          setStep((value) => value - 1);
          setErrors([]);
          setFailed('');
        }}
        onAdvance={() => {
          if (step < 3) {
            void save(true);
            return;
          }
          const missing = validateFractionation(batch, 'fractionationReview');
          setErrors(missing);
          setFailed('');
          if (!missing.length) setConfirm(true);
        }}
        advanceLabel={t(step === 3 ? 'fractionationFinish' : 'next')}
        t={t}
        extraActions={
          step > 0 && (
            <Button kind="ghost" renderIcon={Printer} disabled={saving} onClick={print}>
              {t('fractionationPrint')}
            </Button>
          )
        }
      >
        <FractionationContent>
          {step === 0 && (
            <>
              <div className={shared.fields}>
                <TextInput
                  id="fractionation-operator"
                  labelText={t('fractionationOperator')}
                  value={batch.operator}
                  disabled={saving}
                  onChange={(event) =>
                    change({
                      ...batch,
                      operator: event.target.value,
                      finalChecks: false,
                    })
                  }
                />
                <TextInput
                  id="fractionation-service"
                  labelText={t('fractionationService')}
                  value={batch.service}
                  disabled={saving}
                  onChange={(event) =>
                    change({
                      ...batch,
                      service: event.target.value,
                      finalChecks: false,
                      nodes: batch.nodes.map((node) =>
                        node.parentId === null
                          ? node
                          : {
                              ...node,
                              label: {
                                ...node.label,
                                processingService: event.target.value,
                              },
                            },
                      ),
                    })
                  }
                />
                <Select
                  id="fractionation-system"
                  labelText={t('fractionationSystem')}
                  value={batch.system}
                  disabled={saving}
                  onChange={(event) =>
                    change({
                      ...batch,
                      system: event.target.value as FractionationBatch['system'],
                      finalChecks: false,
                    })
                  }
                >
                  <SelectItem value="" text={t('choose')} />
                  <SelectItem value="closed" text={t('fractionationClosed')} />
                  <SelectItem value="open" text={t('fractionationOpen')} />
                </Select>
              </div>
              <p className={styles.help}>{t('fractionationSystemHelp')}</p>
              <p className={styles.help}>{t('fractionationTreeHelp')}</p>
              <FractionationTree
                batch={batch}
                t={t}
                disabled={saving}
                onSplit={(id, option) => {
                  const next = splitNode(batch, id, option);
                  next.nodes = next.nodes.map((node) =>
                    node.parentId === null
                      ? node
                      : {
                          ...node,
                          label: {
                            ...node.label,
                            processingService: batch.service,
                          },
                        },
                  );
                  change(next);
                }}
              />
              <TextArea
                id="fractionation-observations"
                labelText={t('observations')}
                value={batch.observations}
                disabled={saving}
                onChange={(event) =>
                  change({
                    ...batch,
                    observations: event.target.value,
                    finalChecks: false,
                  })
                }
              />
            </>
          )}
          {step === 1 && (
            <>
              <p className={styles.help}>{t('fractionationLabelHelp')}</p>
              {leaves.map((node) => (
                <section className={styles.labelCard} key={node.id} aria-label={node.code}>
                  <h4>
                    {t(componentDefinitions[node.component].key)} — {node.code}
                  </h4>
                  <p className={styles.help}>
                    {t('fractionationOrigin')}:{' '}
                    {batch.sources.find((source) => source.id === node.sourceId)?.originalWholeBloodCode} ·{' '}
                    {node.label.bloodGroup}
                  </p>
                  <div className={shared.fields}>
                    <TextInput
                      id={`${node.id}-estimated`}
                      labelText={t('fractionationVolumeEstimated')}
                      value={node.estimatedVolume}
                      inputMode="decimal"
                      disabled={saving}
                      onChange={(event) =>
                        updateNode(node.id, {
                          estimatedVolume: event.target.value,
                        })
                      }
                    />
                    {labelInput(node, 'anticoagulant', 'anticoagulant')}
                    {labelInput(node, 'preservative', 'preservative')}
                    {labelInput(node, 'sedimentingAgent', 'sedimentingAgent')}
                    {labelInput(node, 'collectionService', 'service')}
                    {labelInput(node, 'processingService', 'fractionationService')}
                    {labelInput(node, 'storageTemperature', 'fractionationTemperature')}
                    {labelInput(node, 'expiresAt', 'fractionationExpiration')}
                    {node.component !== 'cryoprecipitate' && labelInput(node, 'antibodies', 'fractionationAntibodies')}
                  </div>
                  {node.label.autologous && (
                    <p className={styles.help}>
                      {t('fractionationAutologousOnly')}: {node.label.recipientName} — {node.label.recipientDocument}
                    </p>
                  )}
                </section>
              ))}
              <Checkbox
                id="fractionation-labels-verified"
                labelText={t('fractionationLabelsChecked')}
                checked={batch.labelsVerified}
                disabled={saving}
                onChange={(_event, { checked }) =>
                  change({
                    ...batch,
                    labelsVerified: checked,
                    finalChecks: false,
                  })
                }
              />
            </>
          )}
          {step === 2 && (
            <>
              {batch.sources.map((source) => (
                <section className={styles.source} key={source.id} aria-label={source.code}>
                  <h4>
                    {source.code} — {t(componentDefinitions[source.component].key)}
                  </h4>
                  <p className={styles.help}>
                    {t('fractionationBalance')}: {source.volume} /{' '}
                    {leaves
                      .filter((node) => node.sourceId === source.id)
                      .reduce(
                        (sum, node) => sum + (Number.isFinite(Number(node.volume)) ? Number(node.volume) : 0),
                        0,
                      )}{' '}
                    mL
                  </p>
                  <div className={shared.fields}>
                    {leaves
                      .filter((node) => node.sourceId === source.id)
                      .map((node) => (
                        <TextInput
                          key={node.id}
                          id={`${node.id}-actual`}
                          labelText={`${t(componentDefinitions[node.component].key)} — ${t('fractionationActualVolume')}`}
                          value={node.volume}
                          inputMode="decimal"
                          disabled={saving}
                          invalid={errors.includes('fractionationVolumesRequired')}
                          invalidText={t('fractionationVolumesRequired')}
                          onChange={(event) => updateNode(node.id, { volume: event.target.value })}
                        />
                      ))}
                  </div>
                </section>
              ))}
            </>
          )}
          {step === 3 && (
            <>
              <FractionationReview batch={batch} t={t} />
              <Checkbox
                id="fractionation-final-checked"
                labelText={t('fractionationFinalChecked')}
                checked={batch.finalChecks}
                disabled={saving}
                onChange={(_event, { checked }) => change({ ...batch, finalChecks: checked })}
              />
            </>
          )}
        </FractionationContent>
      </ProcessingModal>
      {confirm && (
        <ComposedModal
          open
          size="sm"
          preventCloseOnClickOutside
          className={styles.confirmation}
          aria-label={t('fractionationFinalWarning')}
          onClose={() => {
            if (!saving) setConfirm(false);
          }}
        >
          <ModalHeader
            title={t('fractionationFinalWarning')}
            iconDescription={t('close')}
            closeModal={() => {
              if (!saving) setConfirm(false);
            }}
          />
          <ModalBody>
            <p>{t('fractionationFinalWarningHelp')}</p>
            {failed && <p role="alert">{t(failed)}</p>}
          </ModalBody>
          <ModalFooter className={shared.footer}>
            <div>
              <Button kind="secondary" disabled={saving} onClick={() => setConfirm(false)}>
                {t('fractionationKeepReviewing')}
              </Button>
              <Button
                disabled={saving}
                onClick={async () => {
                  if (saving) return;
                  setSaving(true);
                  setFailed('');
                  try {
                    await api.finalize(batch);
                    notifySuccess(t('fractionationFinalized'));
                    onSaved();
                    onClose();
                  } catch {
                    setFailed('fractionationSaveFailed');
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                {saving ? t('saving') : t('fractionationConfirm')}
              </Button>
            </div>
          </ModalFooter>
        </ComposedModal>
      )}
    </>
  );
}
