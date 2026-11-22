import {
  Button,
  Checkbox,
  ComposedModal,
  InlineNotification,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Tag,
  TextArea,
  TextInput,
} from '@carbon/react';
import { Printer } from '@carbon/react/icons';
import { useId, useRef, useState } from 'react';
import { formatListDate } from '../../shared/format-list-date';
import { notifySuccess } from '../../shared/notify-success';
import { printDocument } from '../../shared/print-document';
import type { ProcessingTranslate } from '../../shared/processing-page.component';
import { localDateTime } from '../laboratory/screening/screening-rules';
import {
  donorCollectionDecisions,
  donorReactionOptions,
  donorReactionPhases,
  donorReactionSeverities,
  donorReactionTypes,
  donorVitalFields,
  type DonorReaction,
  type DonorReactionAssessment,
  type DonorReactionIdentity,
  type DonorReactionReport,
  type DonorReactionUpdate,
  type DonorVitals,
  type InstitutionalDonorReaction,
  validDonorReactionAssessment,
  validDonorReactionReport,
} from './donor-reaction';
import {
  DonorReactionPrint,
  DonorReactionRecordedDetails,
  DonorReactionSection,
  DonorReactionSummary,
  donorReactionPrintCss,
} from './donor-reaction-document.component';
import styles from './donor-reaction.scss';

function emptyReport(ended: boolean): DonorReactionReport {
  const now = localDateTime();
  return {
    phase: ended ? 'observation' : 'during',
    occurredAt: now,
    notifiedAt: now,
    type: '' as DonorReactionReport['type'],
    signs: '',
    initialCare: '',
    notifiedTo: '',
    initialVitals: {},
    finalVitals: {},
  };
}

export function DonorReactionDialog({
  identity,
  reports,
  actor,
  canAssess = false,
  ended = true,
  startNew = false,
  onSave,
  onClose,
  t,
}: {
  identity: DonorReactionIdentity;
  reports: DonorReaction[];
  actor?: string;
  canAssess?: boolean;
  ended?: boolean;
  startNew?: boolean;
  onSave?: (update: DonorReactionUpdate) => Promise<void>;
  onClose: () => void;
  t: ProcessingTranslate;
}) {
  const prefix = useId();
  const [selected, select] = useState(startNew ? '' : (reports.at(-1)?.id ?? ''));
  const [report, setReport] = useState(() => emptyReport(ended));
  const [assessment, setAssessment] = useState<DonorReactionAssessment>({
    severity: '' as DonorReactionAssessment['severity'],
    diagnosis: '',
    care: '',
    recommendations: '',
    outcome: '',
    collectionDecision: 'alreadyEnded',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const attempt = useRef('');
  const existing = reports.find(({ id }) => id === selected);
  const institutional = report.institutional ?? {};
  const editReport = !existing && Boolean(onSave);
  const editAssessment = Boolean(existing && !existing.assessment && canAssess && onSave);
  const assessmentEnded = ended || existing?.phase !== 'during';
  const normalizedAssessment = {
    ...assessment,
    collectionDecision: assessmentEnded
      ? ('alreadyEnded' as const)
      : assessment.collectionDecision === 'alreadyEnded'
        ? ('' as DonorReactionAssessment['collectionDecision'])
        : assessment.collectionDecision,
  };
  const decisions = assessmentEnded
    ? (['alreadyEnded'] as const)
    : donorCollectionDecisions.filter(
        (value) => value !== 'alreadyEnded' && (value !== 'stopWithoutUnit' || !identity.unitCode),
      );
  const save = async () => {
    if (!onSave || !actor || inFlight.current) return;
    const normalized =
      editReport && validDonorReactionReport(report)
        ? {
            ...report,
            occurredAt: new Date(report.occurredAt).toISOString(),
            notifiedAt: new Date(report.notifiedAt).toISOString(),
          }
        : undefined;
    if (normalized) attempt.current ||= crypto.randomUUID();
    const update: DonorReactionUpdate | undefined = normalized
      ? { action: 'report', id: attempt.current, report: normalized, actor }
      : existing && editAssessment && validDonorReactionAssessment(normalizedAssessment)
        ? {
            action: 'assess',
            id: existing.id,
            assessment: normalizedAssessment,
            actor,
          }
        : undefined;
    if (!update) return;
    setError('');
    inFlight.current = true;
    setBusy(true);
    try {
      await onSave(update);
      select(update.id);
      if (update.action === 'report') {
        setReport(emptyReport(ended));
        attempt.current = '';
      }
      notifySuccess(t(update.action === 'report' ? 'radReported' : 'radEvaluated'));
    } catch {
      setError('radSaveFailed');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const print = () => {
    if (!existing) return;
    const showError = () => setError('printFailed');
    try {
      printDocument(
        <DonorReactionPrint identity={identity} report={existing} t={t} />,
        t('radTitle'),
        showError,
        donorReactionPrintCss,
      );
    } catch {
      showError();
    }
  };
  const option = (
    value: string,
    key: string,
    values: readonly string[],
    label: string,
    change: (value: string) => void,
  ) => (
    <Select id={`${prefix}-${key}`} labelText={t(label)} value={value} onChange={(event) => change(event.target.value)}>
      <SelectItem value="" text={t('radChoose')} disabled />
      {values.map((option) => (
        <SelectItem key={option} value={option} text={t(`${key}_${option}`)} />
      ))}
    </Select>
  );
  const note = (label: string, value: string, change: (value: string) => void) => (
    <TextArea
      id={`${prefix}-${label}`}
      labelText={t(label)}
      value={value}
      maxCount={500}
      maxLength={500}
      enableCounter
      rows={2}
      onChange={(event) => change(event.target.value)}
    />
  );
  const updateInstitutional = (update: Partial<InstitutionalDonorReaction>) =>
    setReport({ ...report, institutional: { ...institutional, ...update } });
  const optionalChoice = <K extends 'site' | 'donorFrequency' | 'environment' | 'consciousness' | 'vasovagalSite'>(
    key: K,
    label: string,
  ) => (
    <Select
      id={`${prefix}-${key}`}
      labelText={t(label)}
      value={institutional[key] ?? ''}
      onChange={(event) =>
        updateInstitutional({
          [key]: (event.target.value || undefined) as InstitutionalDonorReaction[K],
        })
      }
    >
      <SelectItem value="" text={t('radUnspecified')} />
      {donorReactionOptions[key].map((choice) => (
        <SelectItem key={choice} value={choice} text={t(`radOption_${choice}`)} />
      ))}
    </Select>
  );
  const checklist = <V extends string>(
    label: string,
    values: readonly V[],
    selected: V[] = [],
    change: (value: V[]) => void,
  ) => (
    <fieldset className={styles.checkGroup}>
      <legend>{t(label)}</legend>
      <div className={styles.checks}>
        {values.map((value) => (
          <Checkbox
            key={value}
            id={`${prefix}-${label}-${value}`}
            checked={selected.includes(value)}
            labelText={t(`radOption_${value}`)}
            onChange={(_, { checked }) =>
              change(checked ? [...selected, value] : selected.filter((item) => item !== value))
            }
          />
        ))}
      </div>
    </fieldset>
  );
  const pressureInputs = (key: 'donationStartPressure' | 'twentyMinutePressure', label: string) => (
    <fieldset className={styles.checkGroup}>
      <legend>{t(label)}</legend>
      <div className={styles.pressureInputs}>
        {(['systolic', 'diastolic'] as const).map((field) => (
          <TextInput
            key={field}
            id={`${prefix}-${key}-${field}`}
            labelText={t(`radVital_${field}`)}
            inputMode="decimal"
            maxLength={6}
            value={institutional[key]?.[field] ?? ''}
            onChange={(event) => {
              const value = event.target.value;
              if (/^\d{0,3}(\.\d{0,2})?$/.test(value)) {
                updateInstitutional({
                  [key]: { ...institutional[key], [field]: value },
                });
              }
            }}
          />
        ))}
      </div>
    </fieldset>
  );
  const vitalInputs = (key: 'initialVitals' | 'finalVitals') => (
    <DonorReactionSection title={t(key === 'initialVitals' ? 'radInitialVitals' : 'radFinalVitals')}>
      <div className={styles.fields}>
        {donorVitalFields.map((field) => (
          <TextInput
            key={field}
            id={`${prefix}-${key}-${field}`}
            labelText={t(`radVital_${field}`)}
            inputMode="decimal"
            maxLength={6}
            value={report[key][field] ?? ''}
            onChange={(event) => {
              const value = event.target.value;
              if (/^\d{0,3}(\.\d{0,2})?$/.test(value)) {
                const next: DonorVitals = { ...report[key], [field]: value };
                setReport({ ...report, [key]: next });
              }
            }}
          />
        ))}
      </div>
    </DonorReactionSection>
  );
  const close = () => {
    if (!inFlight.current) onClose();
    else return false;
  };
  return (
    <ComposedModal
      open
      size="lg"
      className={styles.dialog}
      aria-label={t('radTitle')}
      onClose={close}
      preventCloseOnClickOutside
    >
      <ModalHeader title={t('radTitle')} iconDescription={t('close')} />
      <ModalBody className={styles.body}>
        {error && <InlineNotification hideCloseButton kind="error" title={t(error)} />}
        {(reports.length > 1 || (onSave && reports.length > 0)) && (
          <Select
            id={`${prefix}-report`}
            labelText={t('radExisting')}
            value={selected}
            disabled={busy}
            onChange={(event) => {
              select(event.target.value);
              attempt.current = '';
              setError('');
              setAssessment({
                severity: '' as DonorReactionAssessment['severity'],
                diagnosis: '',
                care: '',
                recommendations: '',
                outcome: '',
                collectionDecision: 'alreadyEnded',
              });
            }}
          >
            {onSave && <SelectItem value="" text={t('radNew')} />}
            {reports.map((item) => (
              <SelectItem
                key={item.id}
                value={item.id}
                text={`${formatListDate(item.occurredAt)} · ${t(`radType_${item.type}`)} · ${t(item.assessment ? 'radEvaluatedStatus' : 'radPending')}`}
              />
            ))}
          </Select>
        )}
        {existing && (
          <div className={styles.reportStatus} role="status">
            <Tag type={existing.assessment ? 'green' : 'warm-gray'}>
              {t(existing.assessment ? 'radEvaluatedStatus' : 'radPending')}
            </Tag>
          </div>
        )}
        <DonorReactionSummary identity={identity} t={t} />
        {existing && <DonorReactionRecordedDetails report={existing} t={t} />}
        {editReport && (
          <fieldset className={styles.form} disabled={busy}>
            <DonorReactionSection title={t('radDonationConditions')}>
              <div className={styles.fields}>
                {optionalChoice('site', 'radSite')}
                {optionalChoice('donorFrequency', 'radDonorFrequency')}
                {optionalChoice('environment', 'radEnvironment')}
              </div>
              {checklist(
                'radDonorConditions',
                donorReactionOptions.donorConditions,
                institutional.donorConditions,
                (donorConditions) => updateInstitutional({ donorConditions }),
              )}
              <div className={styles.pressureFields}>
                {pressureInputs('donationStartPressure', 'radDonationStartPressure')}
                {pressureInputs('twentyMinutePressure', 'radTwentyMinutePressure')}
              </div>
            </DonorReactionSection>
            <DonorReactionSection title={t('radEventData')}>
              <div className={styles.fields}>
                {option(report.phase, 'radPhase', donorReactionPhases, 'radPhase', (phase) =>
                  setReport({
                    ...report,
                    phase: phase as DonorReactionReport['phase'],
                  }),
                )}
                {option(
                  report.type,
                  'radType',
                  donorReactionTypes.filter(
                    (type) =>
                      identity.modality === 'apheresis' || (type !== 'citrate' && type !== 'apheresisComplication'),
                  ),
                  'radType',
                  (type) =>
                    setReport({
                      ...report,
                      type: type as DonorReactionReport['type'],
                      institutional:
                        type === 'vasovagal'
                          ? institutional
                          : {
                              ...institutional,
                              consciousness: undefined,
                              vasovagalSite: undefined,
                            },
                    }),
                )}
                <TextInput
                  id={`${prefix}-occurred`}
                  type="datetime-local"
                  max={localDateTime()}
                  labelText={t('radOccurredAt')}
                  value={report.occurredAt}
                  onChange={(event) => setReport({ ...report, occurredAt: event.target.value })}
                />
                <TextInput
                  id={`${prefix}-notified`}
                  type="datetime-local"
                  max={localDateTime()}
                  labelText={t('radNotifiedAt')}
                  value={report.notifiedAt}
                  onChange={(event) => setReport({ ...report, notifiedAt: event.target.value })}
                />
              </div>
              {checklist(
                'radLocalReactions',
                donorReactionOptions.localReactions,
                institutional.localReactions,
                (localReactions) => updateInstitutional({ localReactions }),
              )}
              {report.type === 'vasovagal' && (
                <div className={styles.pressureFields}>
                  {optionalChoice('consciousness', 'radConsciousness')}
                  {optionalChoice('vasovagalSite', 'radVasovagalSite')}
                </div>
              )}
              {checklist(
                'radGeneralSymptoms',
                donorReactionOptions.generalSymptoms,
                institutional.generalSymptoms,
                (generalSymptoms) => updateInstitutional({ generalSymptoms }),
              )}
              {checklist(
                'radSevereSymptoms',
                donorReactionOptions.severeSymptoms,
                institutional.severeSymptoms,
                (severeSymptoms) => updateInstitutional({ severeSymptoms }),
              )}
              {note('radSigns', report.signs, (signs) => setReport({ ...report, signs }))}
              {note('radInitialCare', report.initialCare, (initialCare) => setReport({ ...report, initialCare }))}
            </DonorReactionSection>
            <DonorReactionSection title={t('radReportingStaff')}>
              <div className={styles.fields}>
                <TextInput id={`${prefix}-actor`} labelText={t('radReportedBy')} readOnly value={actor ?? ''} />
                <TextInput
                  id={`${prefix}-profession`}
                  labelText={t('radProfession')}
                  maxLength={120}
                  value={institutional.profession ?? ''}
                  onChange={(event) => updateInstitutional({ profession: event.target.value })}
                />
                <TextInput
                  id={`${prefix}-notified-to`}
                  labelText={t('radNotifiedTo')}
                  maxLength={200}
                  value={report.notifiedTo}
                  onChange={(event) => setReport({ ...report, notifiedTo: event.target.value })}
                />
              </div>
            </DonorReactionSection>
            <details className={styles.extraVitals}>
              <summary>{t('radAdditionalVitals')}</summary>
              {vitalInputs('initialVitals')}
              {vitalInputs('finalVitals')}
            </details>
          </fieldset>
        )}
        {editAssessment && (
          <fieldset className={styles.form} disabled={busy}>
            <DonorReactionSection title={t('radAssessment')}>
              <div className={styles.fields}>
                {option(assessment.severity, 'severity', donorReactionSeverities, 'reactionSeverity', (severity) =>
                  setAssessment({
                    ...assessment,
                    severity: severity as DonorReactionAssessment['severity'],
                  }),
                )}
                {option(
                  normalizedAssessment.collectionDecision,
                  'radDecision',
                  decisions,
                  'radDecision',
                  (collectionDecision) =>
                    setAssessment({
                      ...assessment,
                      collectionDecision: collectionDecision as DonorReactionAssessment['collectionDecision'],
                    }),
                )}
                <TextInput id={`${prefix}-medical`} labelText={t('radEvaluatedBy')} value={actor ?? ''} readOnly />
              </div>
              {note('radDiagnosis', assessment.diagnosis, (diagnosis) => setAssessment({ ...assessment, diagnosis }))}
              {note('radCare', assessment.care, (care) => setAssessment({ ...assessment, care }))}
              {note('radOutcome', assessment.outcome, (outcome) => setAssessment({ ...assessment, outcome }))}
              {note('radRecommendations', assessment.recommendations, (recommendations) =>
                setAssessment({ ...assessment, recommendations }),
              )}
            </DonorReactionSection>
          </fieldset>
        )}
      </ModalBody>
      <ModalFooter>
        {existing && (
          <Button kind="tertiary" renderIcon={Printer} disabled={busy} onClick={print}>
            {t('radPrint')}
          </Button>
        )}
        <Button kind="secondary" disabled={busy} onClick={close}>
          {t('close')}
        </Button>
        {(editReport || editAssessment) && (
          <Button
            disabled={
              busy ||
              !actor ||
              !(editReport ? validDonorReactionReport(report) : validDonorReactionAssessment(normalizedAssessment))
            }
            onClick={() => void save()}
          >
            {t(editReport ? 'radSave' : 'radSaveAssessment')}
          </Button>
        )}
      </ModalFooter>
    </ComposedModal>
  );
}
