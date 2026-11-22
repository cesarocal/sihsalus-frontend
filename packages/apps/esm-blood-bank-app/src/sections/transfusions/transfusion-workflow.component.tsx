import { Button, Checkbox, TextInput } from '@carbon/react';
import { Printer } from '@carbon/react/icons';
import { useSession } from '@openmrs/esm-framework';
import { useRef, useState } from 'react';
import type { TransfusionsApi } from '../../api/transfusions.api';
import { notifySuccess } from '../../shared/notify-success';
import { printDocument } from '../../shared/print-document';
import { ProcessingModal } from '../../shared/processing-modal.component';
import type { ProcessingTranslate } from '../../shared/processing-page.component';
import { WarningConfirmation } from '../../shared/warning-confirmation.component';
import { PaperConsentSummary, usePaperConsent } from '../consents/paper-consent.component';
import { closesTransfusion, isClinicalUuid, recipientConsentSubject } from '../consents/paper-consent.resource';
import { FractionationContent } from '../laboratory/fractionation/fractionation-content.component';
import type { TransferUnit } from '../transfers/transfers.types';
import { TransfusionDetails } from './transfusion-details.component';
import type { IssuedTransfusionOrder, TransfusionOrderConfig } from './transfusion-order.resource';
import {
  CompatibilityReport,
  compatibilityReportPrintCss,
  TransfusionLabels,
  transfusionLabelPrintCss,
  UrgentReleaseLabels,
} from './transfusion-print.component';
import { TransfusionUnitPicker } from './transfusion-unit-picker.component';
import styles from './transfusions.scss';
import type { TransfusionDraft, TransfusionRequest } from './transfusions.types';
import {
  compatibilityReportReady,
  needsCrossmatch,
  readyForDelivery,
  requestComplete,
  sampleValid,
  selectionComplete,
  transfusionOperatorName,
  urgentSerumSampleCode,
} from './transfusions-rules';
import { useTransfusionReceipt } from './use-transfusion-receipt';

export function TransfusionWorkflow({
  initial,
  issued,
  orderConfig,
  units,
  api,
  onSaved,
  onDelivered,
  beforeDelivery,
  onClose,
  t,
}: {
  initial: TransfusionRequest;
  issued?: IssuedTransfusionOrder;
  orderConfig?: TransfusionOrderConfig;
  units: TransferUnit[];
  api: TransfusionsApi;
  onSaved: () => void;
  onDelivered?: (request: TransfusionRequest) => Promise<void>;
  beforeDelivery?: (order: TransfusionRequest['order']) => Promise<void>;
  onClose: () => void;
  t: ProcessingTranslate;
}) {
  const [request, setRequest] = useState(initial);
  const delivery = readyForDelivery(initial.status);
  const veryUrgent = request.order.priority === 'veryUrgent';
  const urgentRelease = initial.status === 'readyUrgent' && request.rounds.length > 0;
  const readOnly = initial.status === 'testing';
  const replacement = initial.status === 'incompatible';
  const steps = delivery
    ? [urgentRelease ? 'txPostDispatchPending' : 'txReviewResults', 'txPickup']
    : readOnly
      ? ['txReviewResults']
      : replacement
        ? ['txReviewResults', 'txSelection']
        : ['txReview', 'txRecipientSample', 'txSelection'];
  const [step, setStep] = useState(initial.status === 'reviewed' ? 1 : initial.status === 'sampleReady' ? 2 : 0);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [printingSample, setPrintingSample] = useState(false);
  const [failed, setFailed] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<'assign' | 'deliver' | null>(null);
  const inFlight = useRef(false);
  const receipt = useTransfusionReceipt(orderConfig, issued);
  const session = useSession();
  const [operator] = useState(() => transfusionOperatorName(session));
  const consentSubject =
    request.issuedOrder && isClinicalUuid(request.order.id) ? recipientConsentSubject(request.order) : undefined;
  const consent = usePaperConsent(consentSubject);
  const draft = request.status === 'pending' ? { ...request.draft, reviewer: operator } : request.draft;
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
      setRequest(
        consentSubject && draft.consentEncounterUuid && result.status !== 'delivered'
          ? {
              ...result,
              draft: {
                ...result.draft,
                consentVerified: draft.consentVerified,
                consentEncounterUuid: draft.consentEncounterUuid,
              },
            }
          : result,
      );
      setDirty(false);
      setErrors([]);
      onSaved();
      if (result.revision !== request.revision) notifySuccess(t(message));
      return result;
    } catch (error) {
      if (error instanceof Error && error.message === 'TRANSFUSION_ALREADY_DELIVERED') {
        setFailed('txAlreadyDelivered');
        onSaved();
      } else if (error instanceof Error && error.message === 'CONSENT_NOT_VERIFIED') {
        setFailed('txCurrentConsentRequired');
      } else {
        setFailed('txSaveFailed');
      }
      return null;
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };
  const saveDraft = async () => {
    if (!dirty || closesTransfusion(consent.latest?.decision)) return 'unchanged' as const;
    return (await execute(() => api.saveDraft(request.id, request.revision, draft), 'txDraftSaved'))
      ? ('saved' as const)
      : ('failed' as const);
  };
  const selectionStep = !delivery && !readOnly && step === steps.length - 1;
  const sampleStep = step === 1 && !delivery && !replacement;
  const reviewStep = steps[step] === 'txReview';
  const awaitingReceipt =
    reviewStep && request.status === 'pending' && Boolean(request.issuedOrder) && !receipt.received;
  const reportReady = compatibilityReportReady(request);
  const sample = request.sample ?? draft.sample;
  const samplePrinted =
    !!request.sample ||
    (sample.printRequestedAt === sample.collectedAt &&
      sampleValid({ ...sample, urgentPairVerified: true }, request.order));
  const sampleReady = !!request.sample || (samplePrinted && sampleValid(sample, request.order));
  const selectedUnits = units.filter((unit) => draft.selectedUnitIds.includes(unit.id));
  const closed = closesTransfusion(consent.latest?.decision);
  const urgentAuthorizationVerified = Boolean(draft.urgentAuthorizationVerified || request.urgentAuthorization);
  const consentVerified = consentSubject
    ? !!consent.records &&
      !closed &&
      ((veryUrgent && urgentAuthorizationVerified) ||
        (consent.latest?.decision === 'granted' &&
          draft.consentVerified &&
          consent.latest.uuid === draft.consentEncounterUuid))
    : draft.consentVerified;
  const verifyCurrentConsent = async () => {
    if (!consentSubject) return;
    const [current] = await consent.read();
    if (current && closesTransfusion(current.decision)) {
      await api.cancelIssuedRequest?.(request.id, { ...current, decision: current.decision });
      onSaved();
      throw new Error('CONSENT_NOT_VERIFIED');
    }
    if (veryUrgent && urgentAuthorizationVerified) return;
    if (current?.decision !== 'granted' || !draft.consentVerified || current.uuid !== draft.consentEncounterUuid)
      throw new Error('CONSENT_NOT_VERIFIED');
  };
  const assignmentEffects = veryUrgent
    ? [t('txUrgentAssignEffect')]
    : [
        selectedUnits.some((unit) => needsCrossmatch(unit.componentType)) && t('txAssignTestsEffect'),
        selectedUnits.some((unit) => !needsCrossmatch(unit.componentType)) && t('txAssignReserveEffect'),
      ].filter((item): item is string => typeof item === 'string');
  const advance = async () => {
    if (closed) return;
    if (delivery) {
      if (step === 0) setStep(1);
      else if (
        !draft.collectorName.trim() ||
        !/^\d{8}$/.test(draft.collectorDocument) ||
        !operator ||
        !draft.releaseVerified ||
        (urgentRelease && !draft.urgentLabelsVerified)
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
      if (awaitingReceipt || receipt.saving) return;
      if (request.status !== 'pending') {
        setStep(1);
        return;
      }
      if (veryUrgent && !draft.urgentAuthorizationVerified) {
        setErrors(['txUrgentAuthorizationRequired']);
        return;
      }
      if (!requestComplete(request.order) || !draft.reviewVerified || !consentVerified || !draft.reviewer.trim()) {
        setErrors(['txReviewRequired']);
        return;
      }
      const reviewed = await execute(async () => {
        await verifyCurrentConsent();
        return api.review(request.id, request.revision, draft);
      }, 'txReviewSaved');
      if (reviewed) setStep(1);
    } else {
      if (request.sample) {
        setStep(2);
        return;
      }
      if (!sampleReady) {
        setErrors(['txSampleRequired']);
        return;
      }
      if (
        await execute(async () => {
          await verifyCurrentConsent();
          return api.saveSample(request.id, request.revision, draft.sample);
        }, 'txSampleSaved')
      )
        setStep(2);
    }
  };
  const print = () => {
    if (!urgentRelease && !reportReady) return;
    setFailed('');
    try {
      printDocument(
        urgentRelease ? (
          <UrgentReleaseLabels request={request} t={t} />
        ) : (
          <CompatibilityReport request={request} t={t} print />
        ),
        t(urgentRelease ? 'txPrintUrgentReleaseLabels' : 'txCompatibilityReport'),
        () => setFailed('printFailed'),
        urgentRelease ? transfusionLabelPrintCss : compatibilityReportPrintCss,
      );
    } catch {
      setFailed('printFailed');
    }
  };
  const printSample = () => {
    if (printingSample || (!samplePrinted && !operator) || (consentSubject && !consentVerified)) return;
    setFailed('');
    setPrintingSample(true);
    const collectedAt = new Date().toISOString();
    const sampleToPrint = samplePrinted
      ? sample
      : { ...sample, collectedAt, collectedBy: operator, printRequestedAt: collectedAt };
    const onError = () => {
      setFailed('printFailed');
      setPrintingSample(false);
    };
    try {
      printDocument(
        <TransfusionLabels request={request} sample={sampleToPrint} t={t} />,
        t(veryUrgent ? 'txPrintUrgentSamples' : 'txPrintSample'),
        onError,
        transfusionLabelPrintCss,
        () => {
          if (!samplePrinted) change({ sample: sampleToPrint });
          setPrintingSample(false);
        },
      );
    } catch {
      onError();
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
        saving={saving || printingSample || receipt.saving}
        errors={errors}
        failed={reviewStep && receipt.failed ? 'fr08ReceiveFailed' : failed}
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
        advanceDisabled={
          (selectionStep && !selectionComplete(request, units)) ||
          (sampleStep && !sampleReady) ||
          (!!consentSubject && !consentVerified && !readOnly) ||
          awaitingReceipt ||
          (step === 0 && request.status === 'pending' && !operator)
        }
        footerClassName={styles.printFooter}
        compactHeader
        hideStepHeading={selectionStep}
        preserveContentScroll
        extraActions={
          reviewStep ? (
            <div className={styles.receiptActions}>
              {receipt.canReceive && !closed && (
                <Button
                  kind="tertiary"
                  size="sm"
                  disabled={
                    !draft.reviewVerified ||
                    (veryUrgent && !draft.urgentAuthorizationVerified) ||
                    saving ||
                    receipt.saving
                  }
                  onClick={() => void receipt.register()}
                >
                  {t('fr08Receive')}
                </Button>
              )}
            </div>
          ) : selectionStep ? (
            <Checkbox
              id="tx-selection-check"
              labelText={t('txSelectionCheck')}
              checked={draft.selectionVerified}
              disabled={saving}
              onChange={(_e, { checked }) => change({ selectionVerified: checked })}
            />
          ) : delivery && step === 1 ? (
            <Checkbox
              id="tx-release-check"
              labelText={t(urgentRelease ? 'txUrgentReleaseCheck' : 'txReleaseCheck')}
              disabled={saving}
              checked={draft.releaseVerified}
              onChange={(_e, { checked }) => change({ releaseVerified: checked })}
            />
          ) : (
            (sampleStep || ((delivery || readOnly || replacement) && step === 0)) && (
              <Button
                kind="tertiary"
                className={styles.printButton}
                size="sm"
                renderIcon={Printer}
                disabled={
                  saving ||
                  printingSample ||
                  (sampleStep
                    ? (!operator && !samplePrinted) || (!!consentSubject && !consentVerified)
                    : !urgentRelease && !reportReady)
                }
                onClick={sampleStep ? printSample : print}
              >
                {t(
                  sampleStep
                    ? veryUrgent
                      ? samplePrinted
                        ? 'txReprintUrgentSamples'
                        : 'txPrintUrgentSamples'
                      : samplePrinted
                        ? 'txReprintSample'
                        : 'txPrintSample'
                    : urgentRelease
                      ? 'txPrintUrgentReleaseLabels'
                      : 'txPrintResults',
                )}
              </Button>
            )
          )
        }
        t={t}
      >
        <div className={styles.responsive}>
          <FractionationContent>
            {consentSubject && (
              <div className={styles.reviewChecks}>
                <PaperConsentSummary query={consent} subject={consentSubject} />
                {!readOnly && consent.latest?.decision === 'granted' && (
                  <Checkbox
                    id="tx-current-consent-check"
                    labelText={t('txVerifyCurrentConsent')}
                    checked={draft.consentVerified && consent.latest.uuid === draft.consentEncounterUuid}
                    disabled={saving || receipt.saving}
                    onChange={(_event, { checked }) =>
                      change({
                        consentVerified: checked,
                        consentEncounterUuid: checked ? consent.latest?.uuid : undefined,
                      })
                    }
                  />
                )}
                {!readOnly && veryUrgent && consent.records?.length === 0 && <p>{t('txUrgentPendingConsent')}</p>}
              </div>
            )}
            {selectionStep ? (
              <TransfusionUnitPicker
                request={request}
                units={units}
                busy={saving}
                onChange={(ids) => change({ selectedUnitIds: ids, selectionVerified: false })}
                t={t}
              />
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
                    inputMode="numeric"
                    maxLength={8}
                    disabled={saving}
                    onChange={(e) => change({ collectorDocument: e.target.value.replace(/[^0-9]/g, '').slice(0, 8) })}
                  />
                  <TextInput
                    id="tx-delivered-by"
                    labelText={t('txDeliveredBy')}
                    value={operator}
                    readOnly
                    invalid={!operator}
                    invalidText={t('txOperatorUnavailable')}
                  />
                </div>
                <p>{t('txAutomaticDate')}</p>
                {urgentRelease && (
                  <Checkbox
                    id="tx-urgent-labels-check"
                    labelText={t('txUrgentLabelsCheck')}
                    disabled={saving}
                    checked={!!draft.urgentLabelsVerified}
                    onChange={(_e, { checked }) => change({ urgentLabelsVerified: checked })}
                  />
                )}
              </>
            ) : sampleStep ? (
              <>
                <div className={styles.fields}>
                  <TextInput
                    id="tx-sample-code"
                    labelText={t(veryUrgent ? 'txAnticoagulatedSample' : 'sampleCode')}
                    value={sample.code}
                    readOnly
                  />
                  {veryUrgent && (
                    <TextInput
                      id="tx-serum-sample-code"
                      labelText={t('txNonAnticoagulatedSample')}
                      value={urgentSerumSampleCode(sample)}
                      readOnly
                    />
                  )}
                  <TextInput
                    id="tx-sample-history"
                    labelText={t('txHistoryNumber')}
                    value={draft.sample.historyNumber}
                    readOnly
                  />
                  <TextInput
                    id="tx-sample-recipient"
                    labelText={t('txRecipientName')}
                    value={request.order.patientName}
                    readOnly
                  />
                  <TextInput
                    id="tx-sample-operator"
                    labelText={t('txCollectedBy')}
                    value={samplePrinted ? sample.collectedBy : operator}
                    readOnly
                    invalid={!samplePrinted && !operator}
                    invalidText={t('txOperatorUnavailable')}
                  />
                </div>
                {veryUrgent ? (
                  <Checkbox
                    id="tx-urgent-samples-check"
                    labelText={t('txUrgentSamplesCheck')}
                    checked={!!sample.urgentPairVerified}
                    disabled={saving || printingSample || !!request.sample}
                    onChange={(_e, { checked }) => change({ sample: { ...sample, urgentPairVerified: checked } })}
                  />
                ) : (
                  <p>{t('txSampleSaveHelp')}</p>
                )}
              </>
            ) : (
              <>
                <TransfusionDetails request={request} t={t} history />
                {delivery || readOnly || replacement ? (
                  <CompatibilityReport request={request} t={t} showAttendedBy={delivery} />
                ) : (
                  <div className={styles.reviewChecks}>
                    <TextInput
                      id="tx-reviewer"
                      labelText={t('txReviewer')}
                      value={draft.reviewer}
                      readOnly
                      invalid={request.status === 'pending' && !operator}
                      invalidText={t('txOperatorUnavailable')}
                    />
                    <Checkbox
                      id="tx-review-check"
                      labelText={t('txReviewCheck')}
                      checked={draft.reviewVerified}
                      disabled={saving || receipt.saving || request.status !== 'pending'}
                      onChange={(_e, { checked }) => change({ reviewVerified: checked })}
                    />
                    {!consentSubject && (
                      <Checkbox
                        id="tx-consent-check"
                        labelText={t('txConsentCheck')}
                        checked={draft.consentVerified}
                        disabled={saving || receipt.saving || request.status !== 'pending'}
                        onChange={(_e, { checked }) => change({ consentVerified: checked })}
                      />
                    )}
                    {veryUrgent && (
                      <Checkbox
                        id="tx-urgent-authorization-check"
                        labelText={t('txUrgentAuthorizationCheck')}
                        checked={!!draft.urgentAuthorizationVerified}
                        disabled={saving || receipt.saving || request.status !== 'pending'}
                        onChange={(_e, { checked }) => change({ urgentAuthorizationVerified: checked })}
                      />
                    )}
                  </div>
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
          note={t(confirm === 'assign' ? 'txAssignmentNote' : 'txNoAdministration')}
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
                async () => {
                  if (confirm === 'deliver' && request.issuedOrder) await beforeDelivery?.(request.order);
                  await verifyCurrentConsent();
                  if (confirm === 'assign')
                    return api.assign(request.id, request.revision, draft.selectedUnitIds, draft.selectionVerified);
                  const delivered = await api.deliver(request.id, request.revision, {
                    ...draft,
                    deliveredBy: operator,
                  });
                  await onDelivered?.(delivered);
                  return delivered;
                },
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
