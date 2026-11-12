import {
  Button,
  Checkbox,
  ComposedModal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  TextInput,
} from '@carbon/react';
import { Printer } from '@carbon/react/icons';
import { useSession } from '@openmrs/esm-framework';
import { useCallback, useState } from 'react';
import type { FractionationApi, FractionationCatalogField } from '../../../api/fractionation.api';
import { notifySuccess } from '../../../shared/notify-success';
import { ProcessingModal } from '../../../shared/processing-modal.component';
import { useProcessingData, type ProcessingTranslate } from '../../../shared/processing-page.component';
import { printDocument } from '../../../shared/print-document';
import { FractionationLabels, FractionationReview } from './fractionation-documents.component';
import { FractionationContent } from './fractionation-content.component';
import {
  componentDefinitions,
  finalNodes,
  isFractionationRemainder,
  splitNode,
  validateFractionation,
} from './fractionation-rules';
import { suggestFractionationExpirations } from './fractionation-expiration';
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
  const { authenticated, user, sessionLocation } = useSession();
  const [operator] = useState(() => initial.operator || (authenticated ? (user?.person?.display?.trim() ?? '') : ''));
  const [storedBatch, setBatch] = useState(initial);
  const [step, setStep] = useState(Math.min(initial.completedSteps.length, 3));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [failed, setFailed] = useState('');
  const [confirm, setConfirm] = useState(false);
  const sessionLocationName = sessionLocation?.display?.trim() ?? '';
  const fallbackLocation = sessionLocationName
    ? sessionLocationName.toLowerCase().includes(t('fractionationBankService').toLowerCase())
      ? sessionLocationName
      : `${t('fractionationBankService')} - ${sessionLocationName}`
    : '';
  const loadService = useCallback(async () => (await api.getModifierLocation?.()) ?? '', [api]);
  const requiresLocation = Boolean(api.getModifierLocation && !storedBatch.service);
  const service = useProcessingData(loadService, requiresLocation);
  const getAnticoagulants = useCallback(() => api.listLabelConcepts('anticoagulant'), [api]);
  const getTemperatures = useCallback(() => api.listLabelConcepts('storageTemperature'), [api]);
  const getAntibodies = useCallback(() => api.listLabelConcepts('antibodies'), [api]);
  const anticoagulants = useProcessingData(getAnticoagulants, step === 1);
  const temperatures = useProcessingData(getTemperatures, step === 1);
  const antibodies = useProcessingData(getAntibodies, step === 1);
  const catalog = { anticoagulant: anticoagulants, storageTemperature: temperatures, antibodies };
  const modifier = storedBatch.service || (api.getModifierLocation ? service.data || '' : fallbackLocation);
  const batch: FractionationBatch = {
    ...storedBatch,
    operator,
    service: modifier,
    nodes: storedBatch.nodes.map((node) =>
      node.parentId === null || node.label.processingService
        ? node
        : { ...node, label: { ...node.label, processingService: modifier } },
    ),
  };
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
      labelsVerified: update.label ? false : batch.labelsVerified,
      nodes: batch.nodes.map((node) => (node.id === id ? { ...node, ...update } : node)),
    });
  const canSave = (advance: boolean) => {
    const missing = advance ? validateFractionation(batch, fractionationSteps[step]) : [];
    setErrors(missing);
    setFailed('');
    return !missing.length;
  };
  const save = async (advance = false) => {
    if (saving || !canSave(advance)) return false;
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
      printDocument(<FractionationLabels batch={batch} print t={t} />, t('fractionationPrint'), () =>
        setFailed('printFailed'),
      );
    } catch {
      setFailed('printFailed');
    }
  };
  const labelInput = (
    node: FractionationNode,
    field: keyof Pick<ComponentLabel, 'preservative' | 'sedimentingAgent' | 'collectionService' | 'expiresAt'>,
    key: string,
  ) => (
    <TextInput
      key={field}
      id={`${node.id}-${field}`}
      labelText={t(key)}
      value={node.label[field]}
      disabled={saving}
      type={field === 'expiresAt' ? 'datetime-local' : 'text'}
      onChange={(event) => {
        const label = {
          ...node.label,
          [field]: event.target.value,
          ...(field === 'expiresAt' ? { expiresAtManual: true } : {}),
        };
        updateLabel(node, label);
      }}
    />
  );
  const updateLabel = (node: FractionationNode, label: ComponentLabel) =>
    change(
      suggestFractionationExpirations({
        ...batch,
        finalChecks: false,
        labelsVerified: false,
        nodes: batch.nodes.map((item) => (item.id === node.id ? { ...item, label } : item)),
      }),
    );
  const labelConcept = (node: FractionationNode, field: FractionationCatalogField, key: string) => {
    const idField = field === 'antibodies' ? 'antibodyConceptUuid' : (`${field}ConceptUuid` as const);
    const resource = catalog[field];
    const options = resource.failed ? [] : (resource.data ?? []);
    const savedValue = node.label[idField] || (node.label[field] ? 'saved' : '');
    const savedOption = savedValue && !options.some(({ uuid }) => uuid === savedValue);
    return (
      <div>
        <Select
          id={`${node.id}-${field}`}
          labelText={t(key)}
          value={savedValue}
          disabled={saving || resource.loading}
          helperText={
            resource.loading
              ? t('laboratoryCatalogLoading')
              : !options.length
                ? t('laboratoryCatalogUnavailable')
                : undefined
          }
          onChange={({ target: { value } }) => {
            const selected = options.find(({ uuid }) => uuid === value);
            updateLabel(node, { ...node.label, [field]: selected?.display ?? '', [idField]: selected?.uuid });
          }}
        >
          <SelectItem
            value=""
            disabled={field === 'storageTemperature'}
            text={t(
              field === 'antibodies'
                ? 'fractionationNoAntibodiesRecorded'
                : field === 'anticoagulant'
                  ? 'fractionationNoAnticoagulant'
                  : 'fractionationChooseTemperature',
            )}
          />
          {savedOption && <SelectItem disabled value={savedValue} text={node.label[field]} />}
          {options.map(({ uuid, display }) => (
            <SelectItem key={uuid} value={uuid} text={display} />
          ))}
        </Select>
        {resource.failed && (
          <Button kind="ghost" size="sm" onClick={resource.reload}>
            {t('retry')}
          </Button>
        )}
      </div>
    );
  };
  return (
    <>
      <ProcessingModal
        title={`${t('fractionationTitle')} - ${batch.id}`}
        compactHeader
        hideStepHeading
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
          if (canSave(true)) setConfirm(true);
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
                  readOnly
                />
                <TextInput
                  id="fractionation-service"
                  labelText={t('fractionationService')}
                  value={batch.service}
                  readOnly
                  helperText={
                    requiresLocation && service.loading
                      ? t('laboratoryCatalogLoading')
                      : !modifier
                        ? t('fractionationLocationUnavailable')
                        : undefined
                  }
                />
              </div>
              {service.failed && (
                <Button kind="ghost" size="sm" onClick={service.reload}>
                  {t('retry')}
                </Button>
              )}
              <p className={styles.help}>{t('fractionationTreeHelp')}</p>
              <FractionationTree
                batch={batch}
                t={t}
                disabled={saving}
                onSplit={(id, option) => change(suggestFractionationExpirations(splitNode(batch, id, option)))}
              />
            </>
          )}
          {step === 1 && (
            <>
              <p className={styles.help}>{t('fractionationLabelHelp')}</p>
              <p className={styles.help}>{t('fractionationExpirationHelp')}</p>
              {leaves.map((node) => (
                <section className={styles.labelCard} key={node.id} aria-label={node.code}>
                  <h4>
                    {t(componentDefinitions[node.component].key)} - {node.code}
                  </h4>
                  <p className={styles.help}>
                    {t('fractionationOrigin')}:{' '}
                    {batch.sources.find((source) => source.id === node.sourceId)?.originalWholeBloodCode} ·{' '}
                    {node.label.bloodGroup}
                  </p>
                  <div className={shared.fields}>
                    {labelConcept(node, 'anticoagulant', 'anticoagulant')}
                    {labelInput(node, 'preservative', 'preservative')}
                    {labelInput(node, 'sedimentingAgent', 'sedimentingAgent')}
                    {labelInput(node, 'collectionService', 'service')}
                    <TextInput
                      id={`${node.id}-processingService`}
                      labelText={t('fractionationService')}
                      value={node.label.processingService}
                      readOnly
                    />
                    {labelConcept(node, 'storageTemperature', 'fractionationTemperature')}
                    {labelInput(node, 'expiresAt', 'fractionationExpiration')}
                    {node.component !== 'cryoprecipitate' &&
                      labelConcept(node, 'antibodies', 'fractionationAntibodies')}
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
            <p>
              {t(
                leaves.some(isFractionationRemainder)
                  ? 'fractionationFinalPediatricWarningHelp'
                  : 'fractionationFinalWarningHelp',
              )}
            </p>
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
