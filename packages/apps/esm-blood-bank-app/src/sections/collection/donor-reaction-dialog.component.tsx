import {
  Button,
  ComposedModal,
  InlineNotification,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  TextArea,
  TextInput,
} from '@carbon/react';
import { Printer } from '@carbon/react/icons';
import { useId, useRef, useState, type ReactNode } from 'react';
import { formatListDate } from '../../shared/format-list-date';
import { notifySuccess } from '../../shared/notify-success';
import { printDocument, processingPrintCss } from '../../shared/print-document';
import type { ProcessingTranslate } from '../../shared/processing-page.component';
import { localDateTime } from '../laboratory/screening/screening-rules';
import {
  donorCollectionDecisions,
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
  validDonorReactionAssessment,
  validDonorReactionReport,
} from './donor-reaction';
import styles from './donor-reaction.scss';

const reactionPrintCss = `${processingPrintCss}
  body { font-size: 9pt; }
  h2 { margin: 0 0 8pt; }
  section { margin-top: 8pt; border: 1px solid #666; }
  section h3 { margin: 0; padding: 4pt; border-bottom: 1px solid #999; }
  dl { margin: 0; padding: 4pt; gap: 3pt 8pt; }
  dd { margin: 1pt 0 3pt; }
  footer { margin-top: 14pt; }
`;

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

function ReactionDocument({
  identity,
  report,
  t,
}: {
  identity: DonorReactionIdentity;
  report?: DonorReaction;
  t: ProcessingTranslate;
}) {
  const section = (title: string, values: [string, string | undefined][]) => (
    <section>
      <h3>{t(title)}</h3>
      <dl>
        {values.map(([key, value]) => (
          <div key={key}>
            <dt>{t(key)}</dt>
            <dd>{value || '—'}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
  const vitals = (key: 'initialVitals' | 'finalVitals') =>
    section(
      key === 'initialVitals' ? 'radInitialVitals' : 'radFinalVitals',
      donorVitalFields.map((field) => [`radVital_${field}`, report?.[key][field]]),
    );
  const assessment = report?.assessment;
  return (
    <>
      {section('radDonorData', [
        ['donorName', identity.name],
        ['number', identity.applicationNumber],
        ['document', identity.document],
        ['modality', identity.modality && t(identity.modality)],
        ['unitCode', identity.unitCode],
        ['bagLot', identity.bagLot],
        ['extractedVolume', identity.volume],
        ['age', identity.age],
        ['sex', identity.sex && t(identity.sex === 'F' ? 'female' : 'male')],
        ['radWeight', identity.weight],
        ['hemoglobin', identity.hemoglobin],
        ['hematocrit', identity.hematocrit],
      ])}
      {report && (
        <>
          {section('radEventData', [
            ['radType', t(`radType_${report.type}`)],
            ['radPhase', t(`radPhase_${report.phase}`)],
            ['radOccurredAt', formatListDate(report.occurredAt)],
            ['radRecordedAt', formatListDate(report.reportedAt)],
            ['radSigns', report.signs],
            ['radInitialCare', report.initialCare],
            ['radNotifiedTo', report.notifiedTo],
            ['radNotifiedAt', formatListDate(report.notifiedAt)],
            ['radReportedBy', report.reportedBy],
          ])}
          {vitals('initialVitals')}
          {vitals('finalVitals')}
          {assessment &&
            section('radAssessment', [
              ['reactionSeverity', t(`severity_${assessment.severity}`)],
              ['radDiagnosis', assessment.diagnosis],
              ['radCare', assessment.care],
              ['radRecommendations', assessment.recommendations],
              ['radOutcome', assessment.outcome],
              ['radDecision', t(`radDecision_${assessment.collectionDecision}`)],
              ['radEvaluatedBy', assessment.evaluatedBy],
              ['radEvaluatedAt', formatListDate(assessment.evaluatedAt)],
            ])}
        </>
      )}
    </>
  );
}

function ReactionBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.block}>
      <h3>{title}</h3>
      {children}
    </section>
  );
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
        ? { action: 'assess', id: existing.id, assessment: normalizedAssessment, actor }
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
        <article>
          <h2>{t('radTitle')}</h2>
          <p>
            {t('radStatus')}: {t(existing.assessment ? 'radEvaluatedStatus' : 'radPending')}
          </p>
          <ReactionDocument identity={identity} report={existing} t={t} />
          <footer>{t('radSignature')}</footer>
        </article>,
        t('radTitle'),
        showError,
        reactionPrintCss,
        undefined,
        { widthMm: 180, heightMm: 265 },
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
  const vitalInputs = (key: 'initialVitals' | 'finalVitals') => (
    <ReactionBlock title={t(key === 'initialVitals' ? 'radInitialVitals' : 'radFinalVitals')}>
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
    </ReactionBlock>
  );
  const close = () => {
    if (!inFlight.current) onClose();
    else return false;
  };
  return (
    <ComposedModal open size="lg" aria-label={t('radTitle')} onClose={close} preventCloseOnClickOutside>
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
        <div className={styles.readout}>
          <ReactionDocument identity={identity} report={existing} t={t} />
        </div>
        {existing && !existing.assessment && <p role="status">{t('radPending')}</p>}
        {editReport && (
          <fieldset disabled={busy}>
            <ReactionBlock title={t('radEventData')}>
              <div className={styles.fields}>
                {option(report.phase, 'radPhase', donorReactionPhases, 'radPhase', (phase) =>
                  setReport({ ...report, phase: phase as DonorReactionReport['phase'] }),
                )}
                {option(
                  report.type,
                  'radType',
                  donorReactionTypes.filter(
                    (type) =>
                      identity.modality === 'apheresis' || (type !== 'citrate' && type !== 'apheresisComplication'),
                  ),
                  'radType',
                  (type) => setReport({ ...report, type: type as DonorReactionReport['type'] }),
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
                <TextInput
                  id={`${prefix}-notified-to`}
                  labelText={t('radNotifiedTo')}
                  maxLength={200}
                  value={report.notifiedTo}
                  onChange={(event) => setReport({ ...report, notifiedTo: event.target.value })}
                />
                <TextInput id={`${prefix}-actor`} labelText={t('radReportedBy')} readOnly value={actor ?? ''} />
              </div>
              {note('radSigns', report.signs, (signs) => setReport({ ...report, signs }))}
              {note('radInitialCare', report.initialCare, (initialCare) => setReport({ ...report, initialCare }))}
            </ReactionBlock>
            {vitalInputs('initialVitals')}
            {vitalInputs('finalVitals')}
          </fieldset>
        )}
        {editAssessment && (
          <fieldset disabled={busy}>
            <ReactionBlock title={t('radAssessment')}>
              <div className={styles.fields}>
                {option(assessment.severity, 'severity', donorReactionSeverities, 'reactionSeverity', (severity) =>
                  setAssessment({ ...assessment, severity: severity as DonorReactionAssessment['severity'] }),
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
            </ReactionBlock>
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
