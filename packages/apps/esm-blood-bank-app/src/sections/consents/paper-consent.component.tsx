import {
  Button,
  Checkbox,
  InlineLoading,
  InlineNotification,
  Select,
  SelectItem,
  TextArea,
  TextInput,
} from '@carbon/react';
import { Printer } from '@carbon/react/icons';
import { useConfig, userHasAccess, useSession } from '@openmrs/esm-framework';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import spanish from '../../../translations/es.json';
import { bloodBankPrivileges } from '../../access/blood-bank-privileges';
import type { BloodBankConfig } from '../../config-schema';
import { moduleName } from '../../constants';
import { formatListDate } from '../../shared/format-list-date';
import { notifySuccess } from '../../shared/notify-success';
import { printDocument } from '../../shared/print-document';
import type { SelectionApplication } from '../applicant-selection/selection.types';
import { localDateTime } from '../laboratory/screening/screening-rules';
import {
  type ConsentInput,
  type ConsentRecord,
  type ConsentSubject,
  closesTransfusion,
  consentFormat,
  donorConsentSubject,
  isClinicalUuid,
  listConsent,
  recipientConsentChanged,
  saveConsent,
  validConsentInput,
} from './paper-consent.resource';
import styles from './paper-consent.scss';
import { RecipientConsentDocument, recipientConsentPrintCss } from './recipient-consent-document.component';

export function useConsentTranslation() {
  const { t } = useTranslation(moduleName);
  return (key: keyof typeof spanish.paperConsent) => String(t(`paperConsent.${key}`, spanish.paperConsent[key]));
}

export function useDonorConsentSubject(application: SelectionApplication) {
  const { paperConsent, useMockData } = useConfig<BloodBankConfig>();
  const localDemo = Boolean(useMockData && ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname));
  const subject = donorConsentSubject(application, paperConsent, localDemo);
  return subject.demo || isClinicalUuid(application.patientUuid) || useMockData === false ? subject : undefined;
}

export function usePaperConsent(subject?: ConsentSubject, monitor = false) {
  const { paperConsent: metadata } = useConfig<BloodBankConfig>();
  const subjectRef = useRef(subject);
  subjectRef.current = subject;
  const key = subject ? [subject.kind, subject.id, subject.patientId, subject.contextId].join(':') : '';
  const missingContext = Boolean(subject && !(isClinicalUuid(subject.patientId) && isClinicalUuid(subject.contextId)));
  const [snapshot, setSnapshot] = useState<{ key: string; records?: ConsentRecord[]; failed?: true }>();
  const request = useRef(0);
  const read = useCallback(async () => {
    const current = subjectRef.current;
    if (!key || !current || !metadata || missingContext) throw new Error('CONSENT_UNAVAILABLE');
    const sequence = ++request.current;
    try {
      const records = await listConsent(metadata, current);
      if (sequence === request.current) setSnapshot({ key, records });
      return records;
    } catch (error) {
      if (sequence === request.current) setSnapshot({ key, failed: true });
      throw error;
    }
  }, [key, metadata, missingContext]);
  const reload = useCallback(() => {
    setSnapshot(undefined);
    void read().catch(() => {});
  }, [read]);
  useEffect(() => {
    if (key && metadata && !missingContext) reload();
    return () => {
      request.current++;
    };
  }, [key, metadata, missingContext, reload]);
  useEffect(() => {
    if (!key.startsWith('recipient:') || !metadata || missingContext) return;
    const refresh = () => void read().catch(() => {});
    window.addEventListener(recipientConsentChanged, refresh);
    window.addEventListener('focus', refresh);
    const monitorId = monitor ? window.setInterval(refresh, 30_000) : undefined;
    return () => {
      if (monitorId !== undefined) window.clearInterval(monitorId);
      window.removeEventListener(recipientConsentChanged, refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [key, metadata, missingContext, monitor, read]);
  const records = snapshot?.key === key ? snapshot.records : undefined;
  return {
    metadata,
    missingContext,
    records,
    latest: records?.[0],
    failed: snapshot?.key === key && snapshot.failed,
    read,
    reload,
  };
}
type ConsentQuery = ReturnType<typeof usePaperConsent>;

export function PaperConsentSummary({ query, subject }: { query: ConsentQuery; subject: ConsentSubject }) {
  const t = useConsentTranslation();
  const { latest } = query;
  const recipient = subject.kind === 'recipient';
  return (
    <section className={styles.summary} aria-label={consentFormat(subject.kind)}>
      <h4>{recipient ? t('fr12Heading') : `${consentFormat(subject.kind)} · ${t('title')}`}</h4>
      {!query.metadata || query.missingContext ? (
        <InlineNotification hideCloseButton kind="warning" title={t('missingContext')} />
      ) : query.failed ? (
        <>
          <InlineNotification hideCloseButton kind="error" title={t('readFailed')} />
          <Button type="button" size="sm" kind="ghost" onClick={query.reload}>
            {t('retry')}
          </Button>
        </>
      ) : !query.records ? (
        <InlineLoading description={t('loading')} />
      ) : (
        <dl className={styles.details}>
          <div>
            <dt>{t('decision')}</dt>
            <dd>{t(latest?.decision ?? 'pending')}</dd>
          </div>
          {latest && (
            <>
              {!recipient && latest.folio && (
                <div>
                  <dt>{t('folio')}</dt>
                  <dd>{latest.folio}</dd>
                </div>
              )}
              {latest.reason && (
                <div>
                  <dt>{t('reason')}</dt>
                  <dd>{latest.reason}</dd>
                </div>
              )}
              <div>
                <dt>
                  {t(latest.decision === 'emergency' ? 'emergencyDate' : recipient ? 'signatureDate' : 'decisionDate')}
                </dt>
                <dd>{formatListDate(latest.decidedAt)}</dd>
              </div>
            </>
          )}
        </dl>
      )}
      {!recipient && query.records && (
        <Button type="button" kind="ghost" size="sm" onClick={query.reload}>
          {t('refresh')}
        </Button>
      )}
    </section>
  );
}

export function PaperConsentEditor({
  subject,
  disabled = false,
  onSaving,
  footer,
}: {
  subject: ConsentSubject;
  disabled?: boolean;
  onSaving?: (value: boolean) => void;
  footer?: HTMLElement | null;
}) {
  const query = usePaperConsent(subject);
  const t = useConsentTranslation();
  const session = useSession();
  const recipient = subject.kind === 'recipient';
  const privilege = recipient ? 'app:hoja.clinica.ordenes.editar' : bloodBankPrivileges.applicantSelection;
  const [printing, setPrinting] = useState(false);
  const provider = session.currentProvider?.uuid;
  const canEdit =
    session.authenticated &&
    userHasAccess(
      [privilege, 'Get Visits', 'Get Encounters', 'Add Encounters', 'Get Observations', 'Add Observations'],
      session.user,
    );
  const prefix = useId();
  const [busy, setBusy] = useState(false);
  const [folio, setFolio] = useState('');
  const [date, setDate] = useState(localDateTime);
  const [decision, setDecision] = useState<ConsentInput['decision'] | ''>('');
  const [role, setRole] = useState<ConsentInput['signerRole']>('self');
  const [representative, setRepresentative] = useState('');
  const [reason, setReason] = useState('');
  const emergency = decision === 'emergency';
  const closing = recipient && closesTransfusion(decision || undefined);
  const closed = recipient && closesTransfusion(query.latest?.decision);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<'saveFailed' | 'printFailed' | 'conflict'>();
  const saving = useRef(false);
  const operation = useRef('');
  const resetConfirmation = () => {
    setConfirmed(false);
    setError(undefined);
    operation.current = '';
  };
  const timestamp = Date.parse(date);
  const input: ConsentInput | undefined =
    decision && Number.isFinite(timestamp) && timestamp <= Date.now()
      ? {
          ...(!recipient ? { folio } : {}),
          decision,
          signer: emergency ? '' : role === 'self' ? subject.name : representative,
          signerRole: emergency ? 'physician' : role,
          ...(emergency || closing ? { reason } : {}),
          decidedAt: new Date(timestamp).toISOString(),
        }
      : undefined;
  const savedDecision = query.latest;
  const canPrint = !busy && !disabled && !printing && (!recipient || Boolean(savedDecision && !decision));
  const canSave =
    canEdit &&
    !disabled &&
    !busy &&
    !printing &&
    !closed &&
    isClinicalUuid(provider) &&
    Boolean(query.metadata && query.records) &&
    confirmed &&
    !!input &&
    validConsentInput(input, subject.kind) &&
    (!closing || Boolean(reason.trim())) &&
    (decision !== 'revoked' || query.latest?.decision === 'granted');

  const save = async () => {
    if (!canSave || !provider || !query.metadata || !input || saving.current) return;
    setError(undefined);
    saving.current = true;
    setBusy(true);
    onSaving?.(true);
    try {
      operation.current ||= crypto.randomUUID();
      await saveConsent(query.metadata, subject, input, provider, operation.current, query.latest?.uuid);
      if (recipient) window.dispatchEvent(new Event(recipientConsentChanged));
      await query.read();
      setFolio('');
      setDecision('');
      setDate(localDateTime());
      setRole('self');
      setRepresentative('');
      setReason('');
      resetConfirmation();
      notifySuccess(t('saved'));
    } catch (failure) {
      const conflicted = failure instanceof Error && failure.message === 'CONSENT_CONFLICT';
      setError(conflicted ? 'conflict' : 'saveFailed');
      if (conflicted) {
        query.reload();
        setConfirmed(false);
      }
    } finally {
      saving.current = false;
      setBusy(false);
      onSaving?.(false);
    }
  };
  const title = `${consentFormat(subject.kind)} - ${t(subject.kind === 'donor' ? 'donorTitle' : 'recipientTitle')}`;
  const print = () => {
    if (!canPrint) return;
    setError(undefined);
    const onError = () => {
      setPrinting(false);
      setError('printFailed');
    };
    try {
      if (recipient && savedDecision) {
        setPrinting(true);
        printDocument(
          <RecipientConsentDocument subject={subject} record={savedDecision} t={t} />,
          t('fr12Heading'),
          onError,
          recipientConsentPrintCss,
          () => setPrinting(false),
        );
      } else if (!recipient) {
        printDocument(<DonorConsentDocument subject={subject} title={title} t={t} />, title, onError);
      }
    } catch {
      onError();
    }
  };
  const printButton = (
    <Button
      type="button"
      size={recipient ? 'lg' : 'sm'}
      kind="tertiary"
      renderIcon={Printer}
      onClick={print}
      disabled={!canPrint}
    >
      {recipient ? t('printConsent') : `${t('print')} ${consentFormat(subject.kind)}`}
    </Button>
  );
  const confirmation = (
    <Checkbox
      id={`${prefix}-confirmed`}
      labelText={t(
        emergency
          ? 'confirmEmergency'
          : closing
            ? 'confirmClosing'
            : recipient
              ? 'confirmRecipientPaper'
              : 'confirmPaper',
      )}
      checked={confirmed}
      disabled={recipient && (disabled || busy || !query.records || !provider || !decision)}
      onChange={(_event, { checked }) => setConfirmed(checked)}
    />
  );
  const saveButton = (
    <Button type="button" size={recipient ? 'lg' : 'sm'} onClick={() => void save()} disabled={!canSave}>
      {t('save')}
    </Button>
  );
  const recipientActions = canEdit && !query.missingContext && (
    <div className={styles.recipientActions}>
      {printButton}
      {saveButton}
    </div>
  );

  return (
    <div className={styles.editor}>
      <PaperConsentSummary query={query} subject={subject} />
      {error && <InlineNotification hideCloseButton kind="error" title={t(error)} />}
      {canEdit && !query.missingContext && (
        <>
          {!recipient && <div className={styles.actions}>{printButton}</div>}
          {closed && <InlineNotification hideCloseButton kind="info" title={t('closedRequest')} />}
          {!closed && !provider && <InlineNotification hideCloseButton kind="warning" title={t('providerRequired')} />}
          {!closed && (
            <fieldset
              className={recipient ? styles.recipientFields : styles.fields}
              disabled={disabled || busy || !query.records || !provider}
            >
              <Select
                id={`${prefix}-decision`}
                labelText={t('decision')}
                value={decision}
                onChange={(event) => {
                  resetConfirmation();
                  setDecision(event.target.value as typeof decision);
                }}
              >
                <SelectItem value="" text={t('selectDecision')} disabled />
                <SelectItem value="granted" text={t('granted')} />
                {(subject.kind === 'donor' || query.latest?.decision !== 'granted') && (
                  <SelectItem value="declined" text={t('declined')} />
                )}
                {subject.kind === 'recipient' && subject.priority === 'veryUrgent' && !query.latest && (
                  <SelectItem value="emergency" text={t('emergency')} />
                )}
                {query.latest?.decision === 'granted' && <SelectItem value="revoked" text={t('revoked')} />}
              </Select>
              {!recipient && (
                <TextInput
                  id={`${prefix}-folio`}
                  labelText={t('folio')}
                  maxLength={80}
                  value={folio}
                  onChange={(event) => {
                    resetConfirmation();
                    setFolio(event.target.value);
                  }}
                />
              )}
              <TextInput
                id={`${prefix}-date`}
                type="datetime-local"
                labelText={t(emergency ? 'emergencyDate' : recipient ? 'signatureDate' : 'decisionDate')}
                max={localDateTime()}
                value={date}
                onChange={(event) => {
                  resetConfirmation();
                  setDate(event.target.value);
                }}
              />
              {subject.kind === 'recipient' && !emergency && (
                <Select
                  id={`${prefix}-role`}
                  labelText={t('signerRole')}
                  value={role}
                  onChange={(event) => {
                    resetConfirmation();
                    setRole(event.target.value === 'representative' ? 'representative' : 'self');
                  }}
                >
                  <SelectItem value="self" text={t('patient')} />
                  <SelectItem value="representative" text={t('representative')} />
                </Select>
              )}
              {!emergency && (
                <TextInput
                  id={`${prefix}-name`}
                  labelText={t('signer')}
                  value={role === 'self' ? subject.name : representative}
                  maxLength={200}
                  readOnly={role === 'self'}
                  onChange={(event) => {
                    resetConfirmation();
                    setRepresentative(event.target.value);
                  }}
                />
              )}
              {(emergency || closing) && (
                <TextArea
                  className={styles.fullRow}
                  id={`${prefix}-reason`}
                  labelText={t(emergency ? 'emergencyReason' : 'closingReason')}
                  rows={3}
                  maxLength={500}
                  value={reason}
                  onChange={(event) => {
                    resetConfirmation();
                    setReason(event.target.value);
                  }}
                />
              )}
              {recipient ? (
                <div className={styles.fullRow}>{confirmation}</div>
              ) : (
                <div className={styles.actions}>
                  {confirmation}
                  {saveButton}
                </div>
              )}
            </fieldset>
          )}
        </>
      )}
      <PaperConsentHistory records={query.records} showFolio={!recipient} />
      {recipient && (footer ? createPortal(recipientActions, footer) : footer === undefined ? recipientActions : null)}
    </div>
  );
}

export function PaperConsentHistory({
  records,
  showFolio = false,
}: {
  records?: ConsentRecord[];
  showFolio?: boolean;
}) {
  const t = useConsentTranslation();
  if (!records?.length) return null;
  return (
    <details className={styles.history}>
      <summary>{t('history')}</summary>
      <ul>
        {records.map((record) => (
          <li key={record.uuid}>
            <strong>{t(record.decision)}</strong> · {formatListDate(record.decidedAt)}
            {showFolio && record.folio && <> · {record.folio}</>}
            {record.signer && <> · {record.signer}</>}
            {record.provider && <> · {record.provider}</>}
            {record.reason && <> · {record.reason}</>}
          </li>
        ))}
      </ul>
    </details>
  );
}

function DonorConsentDocument({
  subject,
  title,
  t,
}: {
  subject: ConsentSubject;
  title: string;
  t: ReturnType<typeof useConsentTranslation>;
}) {
  return (
    <article style={{ lineHeight: 1.55 }}>
      <h2>{title}</h2>
      <dl>
        <div>
          <dt>{t('fullName')}</dt>
          <dd>{subject.name}</dd>
        </div>
        <div>
          <dt>{t('identification')}</dt>
          <dd>{subject.identification}</dd>
        </div>
        <div>
          <dt>{t('applicationNumber')}</dt>
          <dd>{subject.number}</dd>
        </div>
        <div>
          <dt>{t('folio')}</dt>
          <dd>________________________________</dd>
        </div>
        <div>
          <dt>{t('decisionDate')}</dt>
          <dd>____ / ____ / ________ &nbsp;&nbsp; ____ : ____</dd>
        </div>
      </dl>
      <p>{t('donorDeclaration')}</p>
      <p>
        {t('clinicalExplanation')}
        <br />
        ________________________________________________________________
        <br />
        ________________________________________________________________
      </p>
      <p>{t('freeDecision')}</p>
      <p>
        ☐ {t('granted')} &nbsp;&nbsp;&nbsp; ☐ {t('declined')}
      </p>
      <div style={{ marginTop: '36pt', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12pt' }}>
        <div style={{ borderTop: '1px solid', paddingTop: '4pt' }}>{t('donorSignature')}</div>
        <div style={{ borderTop: '1px solid', paddingTop: '4pt' }}>{t('providerSignature')}</div>
      </div>
    </article>
  );
}
