import { Button, Checkbox, InlineNotification, RadioButton, RadioButtonGroup, TextInput } from '@carbon/react';
import { ArrowRight, Checkmark, Close, Printer } from '@carbon/react/icons';
import { useSession } from '@openmrs/esm-framework';
import { type ReactNode, useId, useRef, useState } from 'react';
import type { TransfusionsApi } from '../../../api/transfusions.api';
import { notifySuccess } from '../../../shared/notify-success';
import { printDocument } from '../../../shared/print-document';
import { ProcessingModal } from '../../../shared/processing-modal.component';
import type { ProcessingTranslate } from '../../../shared/processing-page.component';
import { WarningConfirmation } from '../../../shared/warning-confirmation.component';
import { inventoryUnitSealCode } from '../../inventory/inventory-rules';
import { transfusionBloodGroupLabel } from '../../transfusions/transfusion-blood-group';
import {
  compatibilityLabelPrintCss,
  CompatibilityReport,
  TransfusionLabels,
} from '../../transfusions/transfusion-print.component';
import styles from '../../transfusions/transfusions.scss';
import type { CompatibilityRound, TransfusionRequest } from '../../transfusions/transfusions.types';
import { transfusionOperatorName, urgentSerumSampleCode } from '../../transfusions/transfusions-rules';
import { SampleTubeIcon } from './sample-tube-icon.component';

function SampleCard({
  title,
  fields,
  children,
}: {
  title: string;
  fields: [string, string | null][];
  children?: ReactNode;
}) {
  const heading = useId();
  return (
    <section className={styles.sampleCard} aria-labelledby={heading}>
      <h4 id={heading}>
        <SampleTubeIcon className={styles.sampleIcon} />
        {title}
      </h4>
      <dl>
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value || '—'}</dd>
          </div>
        ))}
      </dl>
      {children}
    </section>
  );
}

export function CompatibilityWorkflow({
  initial,
  initialRound,
  api,
  onClose,
  onSaved,
  t,
}: {
  initial: TransfusionRequest;
  initialRound: CompatibilityRound;
  api: TransfusionsApi;
  onClose: () => void;
  onSaved: () => void;
  t: ProcessingTranslate;
}) {
  const [request, setRequest] = useState(initial);
  const [round, setRound] = useState(initialRound);
  const [saving, setSaving] = useState(false);
  const [printingLabels, setPrintingLabels] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [failed, setFailed] = useState('');
  const [confirm, setConfirm] = useState(false);
  const session = useSession();
  const [operator] = useState(() => transfusionOperatorName(session));
  const inFlight = useRef(false);
  const { order } = request;
  const afterDispatch = order.priority === 'veryUrgent' && !!request.deliveredAt;
  const communicating = !!initialRound.completedAt;
  const hasIncompatible = Object.values(round.results).includes('incompatible');
  const recipientFields: [string, string][] = [
    [t(afterDispatch ? 'txAnticoagulatedSample' : 'sampleCode'), round.sample.code],
    [t('txRecipientName'), order.patientName],
    [t('txSampleHistoryNumber'), round.sample.historyNumber],
  ];
  if (afterDispatch)
    recipientFields.splice(1, 0, [t('txNonAnticoagulatedSample'), urgentSerumSampleCode(round.sample)]);
  const assignments = request.assignments.filter((item) => item.roundId === round.id);
  const labelsRequested = !!round.labelsPrintRequestedAt;
  const complete =
    labelsRequested &&
    !!operator &&
    round.identityVerified &&
    round.pretransfusionVerified &&
    Object.values(round.results).every(Boolean);
  const change = (patch: Partial<CompatibilityRound>) => {
    setRound((current) => ({ ...current, ...patch }));
    setDirty(true);
    setFailed('');
  };
  const save = async (finalize: boolean) => {
    if (inFlight.current) return false;
    inFlight.current = true;
    setSaving(true);
    setFailed('');
    try {
      const result = communicating
        ? await api.communicateCompatibility(request.id, request.revision, round.id, operator)
        : await api.saveCompatibility(
            request.id,
            request.revision,
            { ...round, operator: operator || round.operator },
            finalize,
          );
      setRequest(result);
      setRound(result.rounds.find((item) => item.id === round.id) ?? round);
      setDirty(false);
      onSaved();
      if (result.revision !== request.revision)
        notifySuccess(
          t(communicating ? 'txCommunicationSaved' : finalize ? 'txCompatibilitySaved' : 'txCompatibilityDraftSaved'),
        );
      return true;
    } catch {
      setFailed('txSaveFailed');
      return false;
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };
  const print = () => {
    if (printingLabels) return;
    setFailed('');
    setPrintingLabels(true);
    const onError = () => {
      setFailed('printFailed');
      setPrintingLabels(false);
    };
    try {
      printDocument(
        <TransfusionLabels request={request} round={round} t={t} />,
        t('txPrintLabels'),
        onError,
        compatibilityLabelPrintCss,
        () => {
          if (!labelsRequested) change({ labelsPrintRequestedAt: new Date().toISOString() });
          setPrintingLabels(false);
        },
      );
    } catch {
      onError();
    }
  };
  if (communicating) {
    return (
      <ProcessingModal
        title={`${t('txRegisterCommunication')} · ${order.number}`}
        steps={['txRegisterCommunication']}
        step={0}
        completed={[]}
        finalized={false}
        saving={saving}
        errors={[]}
        failed={failed}
        saveErrorText={t('txSaveFailed')}
        onClose={onClose}
        onSaveBeforeExit={async () => 'unchanged'}
        onAdvance={() => void save(true).then((saved) => saved && onClose())}
        onPrevious={() => {}}
        advanceLabel={t('txConfirm')}
        advanceDisabled={!operator}
        hideStepHeading
        compactHeader
        t={t}
      >
        <div className={styles.responsive}>
          {hasIncompatible && (
            <InlineNotification kind="error" hideCloseButton title={t('txPostDispatchIncompatible')} />
          )}
          <CompatibilityReport request={request} t={t} />
          <div className={styles.reviewChecks}>
            <TextInput id="tx-communication-doctor" labelText={t('txDoctor')} readOnly value={order.orderer} />
            <TextInput id="tx-communication-operator" labelText={t('txCommunicatedBy')} readOnly value={operator} />
            <p>{t('txConfirmCommunication')}</p>
          </div>
        </div>
      </ProcessingModal>
    );
  }
  return (
    <>
      <ProcessingModal
        title={`${t('txCompatibilityWorkflowTitle')}: ${round.id}`}
        steps={['txCompatibilityPairs']}
        step={0}
        completed={[]}
        finalized={false}
        saving={saving}
        errors={[]}
        failed={failed}
        saveErrorText={t('txSaveFailed')}
        closeDisabled={confirm || printingLabels}
        onClose={onClose}
        onSaveBeforeExit={async () => (!dirty ? 'unchanged' : (await save(false)) ? 'saved' : 'failed')}
        onAdvance={() => setConfirm(true)}
        onPrevious={() => {}}
        advanceLabel={t('txRegisterResults')}
        advanceDisabled={!complete || printingLabels}
        footerClassName={styles.printFooter}
        compactHeader
        hideStepHeading
        preserveContentScroll
        extraActions={
          <Button
            kind="tertiary"
            size="sm"
            className={styles.printButton}
            renderIcon={Printer}
            disabled={saving || printingLabels}
            onClick={print}
          >
            {t('txPrintLabels')}
          </Button>
        }
        t={t}
      >
        <div className={styles.responsive}>
          <dl className={`${styles.summary} ${styles.compatibilitySummary}`}>
            {[
              ['txRecipientName', order.patientName],
              ['txReportBloodGroup', transfusionBloodGroupLabel(order.bloodGroup, t)],
              ['txSampleHistoryNumber', order.historyNumber],
              ['txRound', round.id],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{t(label)}</dt>
                <dd>{value || '—'}</dd>
              </div>
            ))}
          </dl>
          <div className={styles.reviewChecks}>
            <TextInput
              id="tx-compatibility-operator"
              labelText={t('txTestedBy')}
              value={operator}
              readOnly
              invalid={!operator}
              invalidText={t('txOperatorUnavailable')}
            />
            <Checkbox
              id="tx-lab-identity"
              labelText={t('txLabIdentity')}
              checked={round.identityVerified}
              disabled={saving}
              onChange={(_e, { checked }) => change({ identityVerified: checked })}
            />
            <Checkbox
              id="tx-pretransfusion"
              labelText={t('txPretransfusionCheck')}
              checked={round.pretransfusionVerified}
              disabled={saving}
              onChange={(_e, { checked }) => change({ pretransfusionVerified: checked })}
            />
          </div>
          {!labelsRequested && <p className={styles.notice}>{t('txPrintLabelsBeforeResults')}</p>}
          <div className={styles.compatibilitySamples}>
            <div className={styles.recipientCard}>
              <SampleCard title={t('txRecipientSample')} fields={recipientFields} />
            </div>
            <ul className={styles.unitSamples}>
              {assignments.map((item) => (
                <li key={item.unit.id} className={styles.unitSampleRow}>
                  <div className={styles.sampleConnector} aria-hidden="true">
                    <ArrowRight size={18} />
                  </div>
                  <SampleCard
                    title={t('txUnitSample')}
                    fields={[
                      [t('sampleCode'), item.unitSampleCode],
                      [t('unitCode'), item.unit.id],
                      [t('txSeal'), inventoryUnitSealCode(item.unit)],
                      [t('txReportBloodGroup'), transfusionBloodGroupLabel(item.unit.bloodGroup, t)],
                    ]}
                  >
                    <RadioButtonGroup
                      className={styles.compatibilityResult}
                      name={`result-${item.unit.id}`}
                      aria-label={`${t('txResult')} ${item.unit.id}`}
                      valueSelected={round.results[item.unit.id]}
                      disabled={saving || !labelsRequested}
                      onChange={(value) => {
                        if (labelsRequested && (value === 'compatible' || value === 'incompatible'))
                          change({ results: { ...round.results, [item.unit.id]: value } });
                      }}
                    >
                      <RadioButton
                        id={`tx-compatible-${item.unit.id}`}
                        value="compatible"
                        labelText={
                          <>
                            <Checkmark size={18} aria-hidden="true" />
                            {t('txCompatible')}
                          </>
                        }
                      />
                      <RadioButton
                        id={`tx-incompatible-${item.unit.id}`}
                        value="incompatible"
                        labelText={
                          <>
                            <Close size={18} aria-hidden="true" />
                            {t('txIncompatible')}
                          </>
                        }
                      />
                    </RadioButtonGroup>
                  </SampleCard>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </ProcessingModal>
      {confirm && (
        <WarningConfirmation
          title={t('txConfirmResults')}
          description={t(
            afterDispatch
              ? hasIncompatible
                ? 'txPostDispatchIncompatible'
                : 'txPostDispatchResultsWarning'
              : hasIncompatible
                ? 'txResultsWarningIncompatible'
                : 'txResultsWarning',
          )}
          items={
            afterDispatch
              ? []
              : [
                  Object.values(round.results).includes('compatible') && t('txResultsCompatibleEffect'),
                  Object.values(round.results).includes('incompatible') && t('txResultsIncompatibleEffect'),
                ].filter((item): item is string => typeof item === 'string')
          }
          note={t(afterDispatch ? 'txCommunicationPending' : 'txResultsNote')}
          cancelLabel={t('keepEditing')}
          confirmLabel={t('txConfirm')}
          closeLabel={t('close')}
          saving={saving}
          disabled={!complete}
          onCancel={() => {
            if (!inFlight.current) setConfirm(false);
          }}
          onConfirm={() => {
            void (async () => {
              const saved = await save(true);
              setConfirm(false);
              if (saved) onClose();
            })();
          }}
        />
      )}
    </>
  );
}
