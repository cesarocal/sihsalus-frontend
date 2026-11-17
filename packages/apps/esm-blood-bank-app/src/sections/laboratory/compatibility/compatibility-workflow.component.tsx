import { Button, Checkbox, RadioButton, RadioButtonGroup, TextInput } from '@carbon/react';
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
import { compatibilityLabelPrintCss, TransfusionLabels } from '../../transfusions/transfusion-print.component';
import styles from '../../transfusions/transfusions.scss';
import type { CompatibilityRound, TransfusionRequest } from '../../transfusions/transfusions.types';
import { transfusionOperatorName } from '../../transfusions/transfusions-rules';
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
  const [dirty, setDirty] = useState(false);
  const [failed, setFailed] = useState('');
  const [confirm, setConfirm] = useState(false);
  const session = useSession();
  const [operator] = useState(() => transfusionOperatorName(session));
  const inFlight = useRef(false);
  const { order } = request;
  const assignments = request.assignments.filter((item) => item.roundId === round.id);
  const complete =
    !!operator && round.identityVerified && round.pretransfusionVerified && Object.values(round.results).every(Boolean);
  const change = (patch: Partial<CompatibilityRound>) => {
    setRound({ ...round, ...patch });
    setDirty(true);
    setFailed('');
  };
  const save = async (finalize: boolean) => {
    if (inFlight.current) return false;
    inFlight.current = true;
    setSaving(true);
    setFailed('');
    try {
      const result = await api.saveCompatibility(
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
        notifySuccess(t(finalize ? 'txCompatibilitySaved' : 'txCompatibilityDraftSaved'));
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
    setFailed('');
    try {
      printDocument(
        <TransfusionLabels request={request} round={round} t={t} />,
        t('txPrintLabels'),
        () => setFailed('printFailed'),
        compatibilityLabelPrintCss,
      );
    } catch {
      setFailed('printFailed');
    }
  };
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
        closeDisabled={confirm}
        onClose={onClose}
        onSaveBeforeExit={async () => (!dirty ? 'unchanged' : (await save(false)) ? 'saved' : 'failed')}
        onAdvance={() => setConfirm(true)}
        onPrevious={() => {}}
        advanceLabel={t('txRegisterResults')}
        advanceDisabled={!complete}
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
            disabled={saving}
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
          <div className={styles.compatibilitySamples}>
            <div className={styles.recipientCard}>
              <SampleCard
                title={t('txRecipientSample')}
                fields={[
                  [t('sampleCode'), round.sample.code],
                  [t('txRecipientName'), order.patientName],
                  [t('txSampleHistoryNumber'), round.sample.historyNumber],
                ]}
              />
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
                      disabled={saving}
                      onChange={(value) => {
                        if (value === 'compatible' || value === 'incompatible')
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
            Object.values(round.results).includes('incompatible') ? 'txResultsWarningIncompatible' : 'txResultsWarning',
          )}
          items={[
            Object.values(round.results).includes('compatible') && t('txResultsCompatibleEffect'),
            Object.values(round.results).includes('incompatible') && t('txResultsIncompatibleEffect'),
          ].filter((item): item is string => typeof item === 'string')}
          note={t('txResultsNote')}
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
