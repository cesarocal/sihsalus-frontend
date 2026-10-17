import { Button, Checkbox, RadioButton, RadioButtonGroup, TextInput } from '@carbon/react';
import { ArrowRight, Printer } from '@carbon/react/icons';
import { useRef, useState } from 'react';
import type { TransfusionsApi } from '../../../api/transfusions.api';
import { notifySuccess } from '../../../shared/notify-success';
import { printDocument } from '../../../shared/print-document';
import { ProcessingModal } from '../../../shared/processing-modal.component';
import type { ProcessingTranslate } from '../../../shared/processing-page.component';
import { WarningConfirmation } from '../../../shared/warning-confirmation.component';
import { TransfusionLabels } from '../../transfusions/transfusion-print.component';
import styles from '../../transfusions/transfusions.scss';
import type { CompatibilityRound, TransfusionRequest } from '../../transfusions/transfusions.types';
import { FractionationContent } from '../fractionation/fractionation-content.component';
import { SampleTubeIcon } from './sample-tube-icon.component';

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
  const inFlight = useRef(false);
  const complete =
    !!round.operator.trim() &&
    round.identityVerified &&
    round.pretransfusionVerified &&
    Object.values(round.results).every(Boolean);
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
      const result = await api.saveCompatibility(request.id, request.revision, round, finalize);
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
        <TransfusionLabels request={request} sample={round.sample} round={round} t={t} />,
        t('txPrintLabels'),
        () => setFailed('printFailed'),
      );
    } catch {
      setFailed('printFailed');
    }
  };
  return (
    <>
      <ProcessingModal
        title={`${t('txCompatibilityWorkflowTitle')} · ${request.order.number}`}
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
          <FractionationContent>
            <p>
              {request.order.patientName} · {request.order.historyNumber} · {request.order.bloodGroup}
            </p>
            <p>
              {t('txRound')}: {round.id}
            </p>
            <TextInput
              id="tx-compatibility-operator"
              labelText={t('txTestedBy')}
              value={round.operator}
              disabled={saving}
              onChange={(event) => change({ operator: event.target.value })}
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
            {request.assignments
              .filter((item) => item.roundId === round.id)
              .map((item) => (
                <section key={item.unit.id} className={styles.panel}>
                  <div className={styles.pair}>
                    <SampleTubeIcon className={styles.sampleIcon} />
                    <div>
                      <h4>{t('txRecipientSample')}</h4>
                      <p>{round.sample.code}</p>
                      <p>{request.order.patientName}</p>
                      <p>{round.sample.historyNumber}</p>
                    </div>
                    <ArrowRight size={24} aria-hidden="true" />
                    <SampleTubeIcon className={styles.sampleIcon} />
                    <div>
                      <h4>{t('txUnitSample')}</h4>
                      <p>{item.unitSampleCode}</p>
                      <p>
                        {item.unit.id} · {item.unit.bloodGroup}
                      </p>
                      <p>
                        {t('txSeal')}: {item.unit.sealId}/{item.unit.id}
                      </p>
                    </div>
                    <div className={styles.result}>
                      <RadioButtonGroup
                        name={`result-${item.unit.id}`}
                        legendText={`${t('txResult')} ${item.unit.id}`}
                        orientation="vertical"
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
                          labelText={t('txCompatible')}
                        />
                        <RadioButton
                          id={`tx-incompatible-${item.unit.id}`}
                          value="incompatible"
                          labelText={t('txIncompatible')}
                        />
                      </RadioButtonGroup>
                    </div>
                  </div>
                </section>
              ))}
          </FractionationContent>
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
