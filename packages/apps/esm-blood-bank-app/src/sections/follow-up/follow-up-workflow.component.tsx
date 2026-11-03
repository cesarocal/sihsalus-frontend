import { Button } from '@carbon/react';
import { Printer } from '@carbon/react/icons';
import { useRef, useState } from 'react';
import type { FollowUpApi } from '../../api/follow-up.api';
import { notifySuccess } from '../../shared/notify-success';
import { printDocument } from '../../shared/print-document';
import { ProcessingModal } from '../../shared/processing-modal.component';
import type { ProcessingTranslate } from '../../shared/processing-page.component';
import { WarningConfirmation } from '../../shared/warning-confirmation.component';
import { FollowUpFields } from './follow-up-fields.component';
import { FollowUpReport } from './follow-up-report.component';
import { validateFollowUp } from './follow-up-rules';
import { followUpStages, type FollowUpCase, type FollowUpWorkspace } from './follow-up.types';
import styles from './follow-up.scss';

export function FollowUpWorkflow({
  initial,
  workspace,
  api,
  onClose,
  onSaved,
  t,
}: {
  initial: FollowUpCase;
  workspace: FollowUpWorkspace;
  api: FollowUpApi;
  onClose: () => void;
  onSaved: () => void;
  t: ProcessingTranslate;
}) {
  const [record, setRecord] = useState(() => structuredClone(initial));
  const saved = useRef(JSON.stringify(initial));
  const [step, setStep] = useState(initial.stage);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [failed, setFailed] = useState('');
  const [confirm, setConfirm] = useState(false);
  const closed = record.status === 'closed';
  const readOnly = closed || step < record.stage;
  const store = async (operation: () => Promise<FollowUpCase>, message: string) => {
    if (submitting.current) return false;
    submitting.current = true;
    setBusy(true);
    setFailed('');
    try {
      const result = await operation();
      setRecord(result);
      saved.current = JSON.stringify(result);
      setStep(result.stage);
      setErrors([]);
      notifySuccess(t(message));
      onSaved();
      return true;
    } catch {
      setFailed('saveFailed');
      return false;
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  const save = async () => {
    if (record.id && JSON.stringify(record) === saved.current) return 'unchanged' as const;
    return (await store(() => api.save(record), 'savedCase')) ? ('saved' as const) : ('failed' as const);
  };
  const advance = () => {
    if (readOnly) {
      setStep(Math.min(4, step + 1));
      return;
    }
    const messages = validateFollowUp(record, step, workspace.screenings);
    if (
      step === 1 &&
      workspace.traces
        .filter((row) => (record.kind === 'donor' ? row.recipient.id : row.donor.id) === record.detection.person.id)
        .some((row) => !record.traces.some((trace) => trace.id === row.id))
    )
      messages.push('traceAllRequired');
    setErrors(messages);
    if (messages.length) return;
    if (step === 4) setConfirm(true);
    else void store(() => api.save(record, true), 'savedStage');
  };
  const print = () => {
    setFailed('');
    try {
      printDocument(<FollowUpReport record={record} t={t} print />, t(record.kind === 'donor' ? 'fr13' : 'fr14'), () =>
        setFailed('printFailed'),
      );
    } catch {
      setFailed('printFailed');
    }
  };
  return (
    <>
      <ProcessingModal
        title={`${t(record.kind === 'donor' ? 'donorTitle' : 'recipientTitle')} · ${record.id || t('newCase')}`}
        steps={followUpStages}
        step={step}
        completed={followUpStages.filter((_, i) => closed || i < record.stage)}
        finalized={closed}
        saving={busy}
        errors={errors}
        failed={failed}
        saveErrorText={t('saveFailed')}
        onClose={onClose}
        onSaveBeforeExit={save}
        onAdvance={advance}
        onPrevious={() => setStep((s) => Math.max(0, s - 1))}
        advanceLabel={t(step === 4 && !closed ? 'closeCase' : readOnly ? 'continue' : 'saveContinue')}
        closeDisabled={confirm}
        compactHeader
        footerClassName={styles.footer}
        t={t}
        extraActions={
          record.stage > 0 && (
            <Button kind="tertiary" size="sm" renderIcon={Printer} disabled={busy} onClick={print}>
              {t('printReport')}
            </Button>
          )
        }
      >
        <FollowUpFields
          record={record}
          workspace={workspace}
          step={step}
          readOnly={readOnly}
          busy={busy}
          onChange={setRecord}
          onRefresh={onSaved}
          onSample={(id) => {
            void store(() => api.registerSample(record, id), 'savedSample');
          }}
          t={t}
        />
        {step === 4 && <FollowUpReport record={record} t={t} />}
      </ProcessingModal>
      {confirm && (
        <WarningConfirmation
          title={t('closeCase')}
          description={t('closeDescription')}
          items={[t('closeEffect')]}
          note={t('closeNote')}
          cancelLabel={t('keepEditing')}
          confirmLabel={t('confirmClose')}
          closeLabel={t('close')}
          saving={busy}
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            void store(() => api.close(record), 'closedCase').then((ok) => {
              setConfirm(false);
              if (ok) onClose();
            });
          }}
        />
      )}
    </>
  );
}
