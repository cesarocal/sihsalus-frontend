import { Button, Checkbox, InlineLoading, InlineNotification, Select, SelectItem, TextInput } from '@carbon/react';
import { Printer } from '@carbon/react/icons';
import { useConfig, userHasAccess, useSession } from '@openmrs/esm-framework';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
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
  consentFormat,
  donorConsentSubject,
  isClinicalUuid,
  listConsent,
  saveConsent,
  validConsentInput,
} from './paper-consent.resource';
import styles from './paper-consent.scss';

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

export function usePaperConsent(subject?: ConsentSubject) {
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
  return (
    <section className={styles.summary} aria-label={consentFormat(subject.kind)}>
      <h4>
        {consentFormat(subject.kind)} · {t('title')}
      </h4>
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
              <div>
                <dt>{t('folio')}</dt>
                <dd>{latest.folio}</dd>
              </div>
              <div>
                <dt>{t('decisionDate')}</dt>
                <dd>{formatListDate(latest.decidedAt)}</dd>
              </div>
            </>
          )}
        </dl>
      )}
      {query.records && (
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
}: {
  subject: ConsentSubject;
  disabled?: boolean;
  onSaving?: (value: boolean) => void;
}) {
  const query = usePaperConsent(subject);
  const t = useConsentTranslation();
  const session = useSession();
  const privilege =
    subject.kind === 'donor' ? bloodBankPrivileges.applicantSelection : 'app:hoja.clinica.ordenes.editar';
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
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<'saveFailed' | 'printFailed' | 'conflict'>();
  const saving = useRef(false);
  const operation = useRef('');
  const resetConfirmation = () => {
    setConfirmed(false);
    setError(undefined);
    operation.current = '';
  };
  const save = async () => {
    if (
      !canEdit ||
      !isClinicalUuid(provider) ||
      !provider ||
      !query.metadata ||
      !query.records ||
      saving.current ||
      !confirmed ||
      !decision
    )
      return;
    const timestamp = Date.parse(date);
    if (!Number.isFinite(timestamp) || timestamp > Date.now()) return;
    const input: ConsentInput = {
      folio,
      decision,
      signer: role === 'self' ? subject.name : representative,
      signerRole: role,
      decidedAt: new Date(timestamp).toISOString(),
    };
    if (!validConsentInput(input)) return;
    setError(undefined);
    saving.current = true;
    setBusy(true);
    onSaving?.(true);
    try {
      operation.current ||= crypto.randomUUID();
      await saveConsent(query.metadata, subject, input, provider, operation.current, query.latest?.uuid);
      await query.read();
      setFolio('');
      setDecision('');
      setDate(localDateTime());
      setRole('self');
      setRepresentative('');
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
    setError(undefined);
    try {
      printDocument(<PaperConsentDocument subject={subject} title={title} t={t} />, title, () =>
        setError('printFailed'),
      );
    } catch {
      setError('printFailed');
    }
  };
  return (
    <div className={styles.editor}>
      <PaperConsentSummary query={query} subject={subject} />
      {error && <InlineNotification hideCloseButton kind="error" title={t(error)} />}
      {canEdit && !query.missingContext && (
        <>
          <div className={styles.actions}>
            <Button
              type="button"
              size="sm"
              kind="tertiary"
              renderIcon={Printer}
              onClick={print}
              disabled={busy || disabled}
            >
              {t('print')} {consentFormat(subject.kind)}
            </Button>
          </div>
          {!provider && <InlineNotification hideCloseButton kind="warning" title={t('providerRequired')} />}
          <fieldset className={styles.fields} disabled={disabled || busy || !query.records || !provider}>
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
              <SelectItem value="declined" text={t('declined')} />
              {query.latest?.decision === 'granted' && <SelectItem value="revoked" text={t('revoked')} />}
            </Select>
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
            <TextInput
              id={`${prefix}-date`}
              type="datetime-local"
              labelText={t('decisionDate')}
              max={localDateTime()}
              value={date}
              onChange={(event) => {
                resetConfirmation();
                setDate(event.target.value);
              }}
            />
            {subject.kind === 'recipient' && (
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
            <div className={styles.actions}>
              <Checkbox
                id={`${prefix}-confirmed`}
                labelText={t('confirmPaper')}
                checked={confirmed}
                onChange={(_event, { checked }) => setConfirmed(checked)}
              />
              <Button
                type="button"
                size="sm"
                onClick={() => void save()}
                disabled={
                  !confirmed ||
                  !decision ||
                  !folio.trim() ||
                  (role === 'representative' && !representative.trim()) ||
                  !date ||
                  Date.parse(date) > Date.now() ||
                  (decision === 'revoked' && query.latest?.decision !== 'granted')
                }
              >
                {t('save')}
              </Button>
            </div>
          </fieldset>
        </>
      )}
      {Boolean(query.records?.length) && (
        <details className={styles.history}>
          <summary>{t('history')}</summary>
          <ul>
            {query.records?.map((record) => (
              <li key={record.uuid}>
                <strong>{t(record.decision)}</strong> · {record.folio} · {formatListDate(record.decidedAt)} ·{' '}
                {record.signer}
                {record.provider && <> · {record.provider}</>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function PaperConsentDocument({
  subject,
  title,
  t,
}: {
  subject: ConsentSubject;
  title: string;
  t: ReturnType<typeof useConsentTranslation>;
}) {
  const donor = subject.kind === 'donor';
  return (
    <article style={{ lineHeight: 1.55 }}>
      <h2>{title}</h2>
      <dl>
        <div>
          <dt>{t('fullName')}</dt>
          <dd>{subject.name}</dd>
        </div>
        <div>
          <dt>{t(donor ? 'identification' : 'historyNumber')}</dt>
          <dd>{subject.identification}</dd>
        </div>
        <div>
          <dt>{t(donor ? 'applicationNumber' : 'requestNumber')}</dt>
          <dd>{subject.number}</dd>
        </div>
        <div>
          <dt>{t('folio')}</dt>
          <dd>________________________________</dd>
        </div>
        {!donor && (
          <>
            <div>
              <dt>{t('service')}</dt>
              <dd>{subject.service || '________________'}</dd>
            </div>
            <div>
              <dt>{t('bed')}</dt>
              <dd>{subject.bed || '________________'}</dd>
            </div>
          </>
        )}
        <div>
          <dt>{t('decisionDate')}</dt>
          <dd>____ / ____ / ________ &nbsp;&nbsp; ____ : ____</dd>
        </div>
      </dl>
      <p>{t(donor ? 'donorDeclaration' : 'recipientDeclaration')}</p>
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
        {!donor && <> &nbsp;&nbsp;&nbsp; ☐ {t('revoked')}</>}
      </p>
      {!donor && <p>{t('representativeDetails')} &nbsp; ________________________________________</p>}
      <div style={{ marginTop: '36pt', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12pt' }}>
        <div style={{ borderTop: '1px solid', paddingTop: '4pt' }}>
          {t(donor ? 'donorSignature' : 'recipientSignature')}
        </div>
        <div style={{ borderTop: '1px solid', paddingTop: '4pt' }}>{t('providerSignature')}</div>
      </div>
    </article>
  );
}
