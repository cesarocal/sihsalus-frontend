import { Button, Checkbox, TextInput } from '@carbon/react';
import { Printer } from '@carbon/react/icons';
import { useRef, useState } from 'react';
import type { TransfusionsApi } from '../../api/transfusions.api';
import { notifySuccess } from '../../shared/notify-success';
import { printDocument } from '../../shared/print-document';
import { ProcessingModal } from '../../shared/processing-modal.component';
import type { ProcessingTranslate } from '../../shared/processing-page.component';
import { WarningConfirmation } from '../../shared/warning-confirmation.component';
import { FractionationContent } from '../laboratory/fractionation/fractionation-content.component';
import type { TransferUnit } from '../transfers/transfers.types';
import { TransfusionDetails } from './transfusion-details.component';
import { CompatibilityReport, TransfusionLabels } from './transfusion-print.component';
import { TransfusionUnitPicker } from './transfusion-unit-picker.component';
import styles from './transfusions.scss';
import type { TransfusionDraft, TransfusionRequest } from './transfusions.types';
import { needsCrossmatch, requestComplete, sampleValid, selectionComplete } from './transfusions-rules';

export function TransfusionWorkflow({
  initial,
  units,
  api,
  onSaved,
  onClose,
  t,
}: {
  initial: TransfusionRequest;
  units: TransferUnit[];
  api: TransfusionsApi;
  onSaved: () => void;
  onClose: () => void;
  t: ProcessingTranslate;
}) {
  const [request, setRequest] = useState(initial);
  const delivery = initial.status === 'compatible';
  const readOnly = initial.status === 'testing';
  const replacement = initial.status === 'incompatible';
  const steps = delivery
    ? ['txReviewResults', 'txPickup']
    : readOnly
      ? ['txReviewResults']
      : replacement
        ? ['txReviewResults', 'txSelection']
        : ['txReview', 'txRecipientSample', 'txSelection'];
  const [step, setStep] = useState(initial.status === 'reviewed' ? 1 : initial.status === 'sampleReady' ? 2 : 0);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<'assign' | 'deliver' | null>(null);
  const inFlight = useRef(false);
  const draft = request.draft;
  const change = (patch: Partial<TransfusionDraft>) => {
    setRequest({ ...request, draft: { ...draft, ...patch } });
    setDirty(true);
    setFailed('');
  };
  const execute = async (action: () => Promise<TransfusionRequest>, message: string) => {
    if (inFlight.current) return null;
    inFlight.current = true;
    setSaving(true);
    setFailed('');
    try {
      const result = await action();
      setRequest(result);
      setDirty(false);
      setErrors([]);
      onSaved();
      if (result.revision !== request.revision) notifySuccess(t(message));
      return result;
    } catch {
      setFailed('txSaveFailed');
      return null;
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };
  const saveDraft = async () => {
    if (!dirty) return 'unchanged' as const;
    return (await execute(() => api.saveDraft(request.id, request.revision, draft), 'txDraftSaved'))
      ? ('saved' as const)
      : ('failed' as const);
  };
  const selectionStep = !delivery && !readOnly && step === steps.length - 1;
  const selectedUnits = units.filter((unit) => draft.selectedUnitIds.includes(unit.id));
  const assignmentEffects = [
    selectedUnits.some((unit) => needsCrossmatch(unit.componentType)) && t('txAssignTestsEffect'),
    selectedUnits.some((unit) => !needsCrossmatch(unit.componentType)) && t('txAssignReserveEffect'),
  ].filter((item): item is string => typeof item === 'string');
  const advance = async () => {
    if (delivery) {
      if (step === 0) setStep(1);
      else if (
        !draft.collectorName.trim() ||
        !/^\d{8}$/.test(draft.collectorDocument) ||
        !draft.deliveredBy.trim() ||
        !draft.releaseVerified
      )
        setErrors(['txPickupRequired']);
      else setConfirm('deliver');
      return;
    }
    if (replacement && step === 0) {
      setStep(1);
      return;
    }
    if (selectionStep) {
      if (!draft.selectionVerified || !selectionComplete(request, units)) setErrors(['txSelectionRequired']);
      else setConfirm('assign');
      return;
    }
    if (step === 0) {
      if (request.status !== 'pending') {
        setStep(1);
        return;
      }
      if (
        !requestComplete(request.order) ||
        !draft.reviewVerified ||
        !draft.consentVerified ||
        !draft.reviewer.trim()
      ) {
        setErrors(['txReviewRequired']);
        return;
      }
      if (await execute(() => api.review(request.id, request.revision, draft), 'txReviewSaved')) setStep(1);
    } else {
      if (request.sample) {
        setStep(2);
        return;
      }
      if (!sampleValid(draft.sample, request.order)) {
        setErrors(['txSampleRequired']);
        return;
      }
      if (await execute(() => api.saveSample(request.id, request.revision, draft.sample), 'txSampleSaved')) setStep(2);
    }
  };
  const print = () => {
    setFailed('');
    try {
      printDocument(
        step === 1 && !delivery && !replacement ? (
          <TransfusionLabels request={request} sample={draft.sample} t={t} />
        ) : (
          <CompatibilityReport request={request} t={t} print />
        ),
        t('txPrint'),
        () => setFailed('printFailed'),
      );
    } catch {
      setFailed('printFailed');
    }
  };
  return (
    <>
      <ProcessingModal
        title={`${t(delivery ? 'txDeliveryTitle' : 'txRequestTitle')} · ${request.order.number}`}
        steps={steps}
        step={step}
        completed={steps.slice(0, step)}
        finalized={readOnly}
        saving={saving}
        errors={errors}
        failed={failed}
        saveErrorText={t('txSaveFailed')}
        onClose={onClose}
        closeDisabled={!!confirm}
        onSaveBeforeExit={saveDraft}
        onAdvance={() => {
          void advance();
        }}
        onPrevious={() => {
          setStep(step - 1);
          setErrors([]);
        }}
        advanceLabel={t(delivery && step === 1 ? 'txDeliver' : 'txContinue')}
        advanceDisabled={selectionStep && !selectionComplete(request, units)}
        footerClassName={styles.printFooter}
        compactHeader
        extraActions={
          ((step === 1 && !delivery && !replacement) || ((delivery || readOnly || replacement) && step === 0)) && (
            <Button
              kind="tertiary"
              className={styles.printButton}
              size="sm"
              renderIcon={Printer}
              disabled={saving}
              onClick={print}
            >
              {t(step === 1 && !delivery && !replacement ? 'txPrintSample' : 'txPrintResults')}
            </Button>
          )
        }
        t={t}
      >
        <div className={styles.responsive}>
          <FractionationContent>
            {selectionStep ? (
              <>
                <TransfusionUnitPicker
                  request={request}
                  units={units}
                  busy={saving}
                  onChange={(ids) => change({ selectedUnitIds: ids, selectionVerified: false })}
                  t={t}
                />
                <Checkbox
                  id="tx-selection-check"
                  labelText={t('txSelectionCheck')}
                  checked={draft.selectionVerified}
                  disabled={saving}
                  onChange={(_e, { checked }) => change({ selectionVerified: checked })}
                />
              </>
            ) : delivery && step === 1 ? (
              <>
                <div className={styles.fields}>
                  <TextInput
                    id="tx-collector"
                    labelText={t('txCollector')}
                    value={draft.collectorName}
                    disabled={saving}
                    onChange={(e) => change({ collectorName: e.target.value })}
                  />
                  <TextInput
                    id="tx-collector-document"
                    labelText={t('txCollectorDocument')}
                    value={draft.collectorDocument}
                    disabled={saving}
                    onChange={(e) => change({ collectorDocument: e.target.value })}
                  />
                  <TextInput
                    id="tx-delivered-by"
                    labelText={t('txDeliveredBy')}
                    value={draft.deliveredBy}
                    disabled={saving}
                    onChange={(e) => change({ deliveredBy: e.target.value })}
                  />
                </div>
                <p>{t('txAutomaticDate')}</p>
                <Checkbox
                  id="tx-release-check"
                  labelText={t('txReleaseCheck')}
                  disabled={saving}
                  checked={draft.releaseVerified}
                  onChange={(_e, { checked }) => change({ releaseVerified: checked })}
                />
              </>
            ) : step === 1 && !delivery && !replacement ? (
              <>
                <div className={styles.fields}>
                  <TextInput id="tx-sample-code" labelText={t('sampleCode')} value={draft.sample.code} readOnly />
                  <TextInput
                    id="tx-sample-history"
                    labelText={t('txHistoryNumber')}
                    value={draft.sample.historyNumber}
                    readOnly
                  />
                  <TextInput
                    id="tx-sample-collected"
                    type="datetime-local"
                    labelText={t('collectedOn')}
                    value={draft.sample.collectedAt}
                    disabled={saving || !!request.sample}
                    onChange={(e) => change({ sample: { ...draft.sample, collectedAt: e.target.value } })}
                  />
                  <TextInput
                    id="tx-sample-operator"
                    labelText={t('txCollectedBy')}
                    value={draft.sample.collectedBy}
                    disabled={saving || !!request.sample}
                    onChange={(e) => change({ sample: { ...draft.sample, collectedBy: e.target.value } })}
                  />
                </div>
                <p>{request.order.patientName}</p>
                <p>{t('txSampleSaveHelp')}</p>
                <Checkbox
                  id="tx-sample-identity"
                  labelText={t('txSampleIdentity')}
                  disabled={saving || !!request.sample}
                  checked={draft.sample.identityVerified}
                  onChange={(_e, { checked }) => change({ sample: { ...draft.sample, identityVerified: checked } })}
                />
              </>
            ) : (
              <>
                <TransfusionDetails request={request} t={t} history />
                {delivery || readOnly || replacement ? (
                  <CompatibilityReport request={request} t={t} />
                ) : (
                  <>
                    <TextInput
                      id="tx-reviewer"
                      labelText={t('txReviewer')}
                      value={draft.reviewer}
                      disabled={saving || request.status !== 'pending'}
                      onChange={(e) => change({ reviewer: e.target.value })}
                    />
                    <Checkbox
                      id="tx-review-check"
                      labelText={t('txReviewCheck')}
                      checked={draft.reviewVerified}
                      disabled={saving || request.status !== 'pending'}
                      onChange={(_e, { checked }) => change({ reviewVerified: checked })}
                    />
                    <Checkbox
                      id="tx-consent-check"
                      labelText={t('txConsentCheck')}
                      checked={draft.consentVerified}
                      disabled={saving || request.status !== 'pending'}
                      onChange={(_e, { checked }) => change({ consentVerified: checked })}
                    />
                  </>
                )}
              </>
            )}
          </FractionationContent>
        </div>
      </ProcessingModal>
      {confirm && (
        <WarningConfirmation
          title={t(confirm === 'assign' ? 'txConfirmAssignment' : 'txConfirmDelivery')}
          description={t(confirm === 'assign' ? 'txAssignWarning' : 'txDeliveryWarning')}
          items={confirm === 'assign' ? assignmentEffects : [t('txDeliveryBookEffect'), t('txDeliveryRequestEffect')]}
          note={t('txNoAdministration')}
          cancelLabel={t('keepEditing')}
          confirmLabel={t('txConfirm')}
          closeLabel={t('close')}
          saving={saving}
          onCancel={() => {
            if (!inFlight.current) setConfirm(null);
          }}
          onConfirm={() => {
            void (async () => {
              const result = await execute(
                () =>
                  confirm === 'assign'
                    ? api.assign(request.id, request.revision, draft.selectedUnitIds, draft.selectionVerified)
                    : api.deliver(request.id, request.revision, draft),
                confirm === 'assign' ? 'txAssignmentSaved' : 'txDeliverySaved',
              );
              setConfirm(null);
              if (result) onClose();
            })();
          }}
        />
      )}
    </>
  );
}
