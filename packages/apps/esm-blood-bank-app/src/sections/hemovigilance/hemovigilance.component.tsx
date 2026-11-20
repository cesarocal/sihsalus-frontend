import {
  Button,
  ComposedModal,
  InlineLoading,
  InlineNotification,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Tag,
} from '@carbon/react';
import { ArrowLeft, Printer, RainDrop, Report } from '@carbon/react/icons';
import { ConfigurableLink, useConfig, userHasAccess, useSession } from '@openmrs/esm-framework';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BloodBankConfig } from '../../config-schema';
import { moduleName } from '../../constants';
import { ExitConfirmation, type ExitSaveResult } from '../../shared/exit-confirmation.component';
import { formatListDate } from '../../shared/format-list-date';
import { notifySuccess } from '../../shared/notify-success';
import { printDocument } from '../../shared/print-document';
import { ProcessingTable, type ProcessingTranslate, useProcessingData } from '../../shared/processing-page.component';
import { componentDefinitions } from '../laboratory/fractionation/fractionation-rules';
import type { TransfusionOrder } from '../transfusions/transfusions.types';
import { transfusionOperatorName } from '../transfusions/transfusions-rules';
import { useTransfusionsTranslation } from '../transfusions/use-transfusions-translation';
import {
  conductionCode,
  conductionError,
  conductionFields,
  currentStage,
  type Fields,
  hemoPrivileges,
  previousConductions,
  reportDefaults,
  type Stage,
  transfusionProgress,
  type UnitCase,
  validStage,
} from './hemovigilance';
import {
  actorLicense,
  isLocalHemovigilance,
  listHemovigilance,
  listPatientHemovigilance,
  saveHemovigilance,
} from './hemovigilance.resource';
import styles from './hemovigilance.scss';
import { CaseFields, HemovigilanceFields } from './hemovigilance-forms.component';
import { ConductionPrint, Fr02Print, hemovigilancePrintCss } from './hemovigilance-print.component';

const chartName = 'Transfusiones';
const exitDialogs = ['[role="dialog"].cds--modal'];
const transfusionProgressColors = {
  transfusionInProgress: 'blue',
  transfusionCompleted: 'green',
  transfusionInterrupted: 'red',
} as const;
const stagePrivileges = {
  conduction: hemoPrivileges.conduction,
  report: hemoPrivileges.report,
  review: hemoPrivileges.review,
  investigation: hemoPrivileges.bank,
};

function useHemoTranslation() {
  const common = useTransfusionsTranslation();
  const { t } = useTranslation(moduleName);
  return useCallback<ProcessingTranslate>(
    (key, values) => {
      const token = `hemovigilance.${key}`;
      return String(t(token, { ...values, defaultValue: common(key, values), ns: moduleName }));
    },
    [common, t],
  );
}

export function HemovigilanceLink({ basePath }: { basePath: string }) {
  const t = useHemoTranslation();
  const { useMockData } = useConfig<BloodBankConfig>();
  const path = `${basePath}/${chartName}`;
  if (!isLocalHemovigilance(useMockData)) return null;
  const active = decodeURIComponent(location.pathname) === path;
  return (
    <ConfigurableLink
      to={path}
      className={`cds--side-nav__link${active ? ' active-left-nav-link' : ''}`}
      aria-current={active ? 'page' : undefined}
    >
      <span className="sihsalus-side-nav__item">
        <RainDrop size={20} className="sihsalus-side-nav__icon" aria-hidden="true" />
        <span className="sihsalus-side-nav__text">{t('chapter')}</span>
      </span>
    </ConfigurableLink>
  );
}

export function HemovigilanceChart({ patientUuid }: { patientUuid: string }) {
  const config = useConfig<BloodBankConfig>();
  const { user, authenticated } = useSession();
  const t = useHemoTranslation();
  const enabled = Boolean(
    patientUuid &&
      authenticated &&
      userHasAccess([hemoPrivileges.chart, 'Get Orders'], user) &&
      isLocalHemovigilance(config.useMockData),
  );
  const load = useCallback(() => listPatientHemovigilance(patientUuid), [patientUuid]);
  if (!enabled) return null;
  return <HemovigilanceList key={patientUuid} load={load} t={t} />;
}

export function BankHemovigilance({ orders, onClose }: { orders: TransfusionOrder[]; onClose: () => void }) {
  const t = useHemoTranslation();
  const load = useCallback(
    async () => (await listHemovigilance(orders)).filter((entry) => entry.sections.report),
    [orders],
  );
  const { user, authenticated } = useSession();
  if (!authenticated || !userHasAccess(hemoPrivileges.bank, user)) return null;
  return <HemovigilanceList load={load} t={t} onClose={onClose} />;
}

function HemovigilanceList({
  load,
  t,
  onClose,
}: {
  load: () => Promise<UnitCase[]>;
  t: ProcessingTranslate;
  onClose?: () => void;
}) {
  const data = useProcessingData(load);
  const [selected, setSelected] = useState<string>();
  const id = (unit: UnitCase) => `${unit.order.id}/${unit.dispatch.unitCode}`;
  const units = [...(data.data ?? [])].sort(
    (a, b) => Date.parse(b.dispatch.deliveredAt) - Date.parse(a.dispatch.deliveredAt),
  );
  const current = units.find((unit) => id(unit) === selected);
  if (current)
    return (
      <UnitCaseDialog
        key={selected}
        unit={current}
        cases={units}
        bank={Boolean(onClose)}
        onClose={() => {
          setSelected(undefined);
          data.reload();
        }}
        t={t}
      />
    );
  const table = (
    <div className={styles.panel}>
      <ProcessingTable
        title={t(onClose ? 'queue' : 'deliveredUnits')}
        columns={[
          t(onClose ? 'fr08' : 'chartFr08'),
          ...(onClose ? [t('patientName')] : []),
          t('unitCode'),
          t('component'),
          t('dispatchDate'),
          ...(onClose ? [] : [t('transfusionStatus')]),
          t(onClose ? 'reactionState' : 'chartFr02'),
          t(onClose ? 'actions' : 'chartRecord'),
        ]}
        rows={units.map((unit) => {
          const progress = transfusionProgress(unit);
          const progressCell = progress ? (
            <Tag key="progress" type={transfusionProgressColors[progress]}>
              {t(progress)}
            </Tag>
          ) : (
            '—'
          );
          return {
            id: id(unit),
            cells: [
              unit.order.number,
              ...(onClose ? [unit.order.patientName] : []),
              unit.dispatch.unitCode,
              t(componentDefinitions[unit.dispatch.component].key),
              formatListDate(unit.dispatch.deliveredAt),
              ...(onClose ? [] : [progressCell]),
              <Tag key="status" type={unit.sections.report ? 'blue' : 'gray'}>
                {t(currentStage(unit))}
              </Tag>,
              <Button key="open" kind="ghost" size="sm" onClick={() => setSelected(id(unit))}>
                {t(onClose ? 'openFr02' : 'openConduction')}
              </Button>,
            ],
          };
        })}
        loading={data.loading}
        failed={data.failed}
        reload={data.reload}
        emptyHelp={t(onClose ? 'queueEmpty' : 'noDeliveries')}
        t={t}
      />
    </div>
  );
  if (!onClose) return table;
  return (
    <ComposedModal open size="lg" onClose={onClose} preventCloseOnClickOutside>
      <ModalHeader title={t('queue')} />
      <ModalBody>{table}</ModalBody>
      <ModalFooter>
        <Button onClick={onClose}>{t('close')}</Button>
      </ModalFooter>
    </ComposedModal>
  );
}

function fieldsForStage(unit: UnitCase, stage: Stage) {
  if (stage === 'conduction') return conductionFields(unit);
  return unit.sections[stage]?.fields ?? (stage === 'report' ? reportDefaults(unit.sections.conduction?.fields) : {});
}

function UnitCaseDialog({
  unit: initialUnit,
  cases,
  bank,
  onClose,
  t,
}: {
  unit: UnitCase;
  cases: UnitCase[];
  bank: boolean;
  onClose: () => void;
  t: ProcessingTranslate;
}) {
  const session = useSession();
  const [{ unit, stage, fields, changed }, setEditor] = useState<{
    unit: UnitCase;
    stage: Stage;
    fields: Fields;
    changed: boolean;
  }>(() => {
    const stage = bank ? 'investigation' : 'conduction';
    return { unit: initialUnit, stage, fields: fieldsForStage(initialUnit, stage), changed: false };
  });
  const [pendingExit, setPendingExit] = useState<Stage | 'close'>();
  const canEdit = (stage: Stage) =>
    session.authenticated &&
    userHasAccess(stagePrivileges[stage], session.user) &&
    (!unit.sections[stage] || stage === 'conduction') &&
    (stage === 'conduction' || stage === 'report' || Boolean(unit.sections.report));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [license, setLicense] = useState('');
  const saving = useRef(false);
  const personUuid = session.user?.person?.uuid ?? '';
  const providerUuid = session.currentProvider?.uuid ?? '';
  const actor = { name: transfusionOperatorName(session), personUuid, license };
  const saved = unit.sections[stage];
  const conduction = stage === 'conduction';
  const history = conduction ? previousConductions(unit, fields, cases) : [];
  useEffect(() => {
    let active = true;
    setLicense('');
    void actorLicense(personUuid, providerUuid).then(
      (value) => {
        if (active) setLicense(value);
      },
      () => {},
    );
    return () => {
      active = false;
    };
  }, [personUuid, providerUuid]);
  const finishExit = (next: Stage | 'close') => {
    setPendingExit(undefined);
    if (next === 'close') {
      onClose();
      return;
    }
    setError('');
    setEditor((current) => ({
      ...current,
      stage: next,
      fields: fieldsForStage(current.unit, next),
      changed: false,
    }));
  };
  const save = async (): Promise<ExitSaveResult> => {
    if (saving.current || !canEdit(stage)) return 'failed';
    if (!validStage(stage, fields, unit.sections)) {
      setError(conduction ? conductionError(fields) : 'invalid' + stage);
      return 'failed';
    }
    if (!actor.name || !actor.personUuid) {
      setError('operatorUnavailable');
      return 'failed';
    }
    saving.current = true;
    setBusy(true);
    setError('');
    try {
      const record = await saveHemovigilance(unit, stage, fields, actor);
      setEditor((current) => ({
        ...current,
        unit: { ...current.unit, sections: { ...current.unit.sections, [stage]: record } },
        changed: false,
      }));
      notifySuccess(t('recordSaved'));
      return 'saved';
    } catch {
      setError('saveFailed');
      return 'failed';
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };
  const requestExit = (next: Stage | 'close') => {
    if (busy || pendingExit || next === stage) return false;
    if (changed) setPendingExit(next);
    else finishExit(next);
    return false;
  };
  // Carbon's native Escape listener holds the first close handler while the dialog is open.
  const closeRequest = useRef(requestExit);
  closeRequest.current = requestExit;
  const close = () => closeRequest.current('close');
  const bodyRef = useRef<HTMLDivElement>(null);
  const printError = () => setError('printFailed');
  const printCase = (document: ReactNode, title: string) => {
    setError('');
    try {
      printDocument(document, title, printError, hemovigilancePrintCss);
    } catch {
      printError();
    }
  };
  const stages: Stage[] = bank
    ? ['report', ...(unit.sections.review ? ['review' as const] : []), 'investigation']
    : [
        'report',
        ...(unit.sections.report && (unit.sections.review || userHasAccess(hemoPrivileges.review, session.user))
          ? ['review' as const]
          : []),
        ...(unit.sections.investigation ? ['investigation' as const] : []),
      ];
  const title = conduction
    ? t('unitConductionTitle', { code: unit.dispatch.unitCode })
    : `${t(bank ? 'openFr02' : 'report')}: ${unit.dispatch.unitCode}`;
  const audit = (saved || canEdit(stage)) && (
    <dl className={conduction ? `${styles.sheetCard} ${styles.conductionAudit}` : styles.caseFields}>
      <div>
        <dt>{t(stage === 'report' ? 'nurse' : 'recordedBy')}</dt>
        <dd>{(canEdit(stage) ? actor : saved?.actor)?.name || '—'}</dd>
      </div>
      <div>
        <dt>{t(stage === 'report' ? 'cep' : 'registration')}</dt>
        <dd>{(canEdit(stage) ? actor : saved?.actor)?.license || '—'}</dd>
      </div>
      {saved && (
        <div>
          <dt>{t('recordDate')}</dt>
          <dd>{formatListDate(saved.at)}</dd>
        </div>
      )}
    </dl>
  );
  return (
    <>
      <ComposedModal
        className={styles.caseDialog}
        size="lg"
        open
        onClose={close}
        preventCloseOnClickOutside
        selectorsFloatingMenus={exitDialogs}
        aria-label={title}
        onBlurCapture={(event) => {
          // Keep the content in place when focusing another control inside the scrollable body.
          if (event.relatedTarget instanceof Node && bodyRef.current?.contains(event.relatedTarget))
            event.stopPropagation();
        }}
      >
        <ModalHeader title={title} iconDescription={t('close')} closeModal={close} />
        <ModalBody ref={bodyRef} className={conduction ? styles.conductionBody : undefined}>
          {error && (
            <InlineNotification
              className={styles.notification}
              lowContrast
              kind="error"
              title={t(error)}
              hideCloseButton
            />
          )}
          {!conduction && <CaseFields unit={unit} t={t} />}
          {!conduction && stages.length > 1 && (
            <div className={styles.actions}>
              {stages.map((key) => (
                <Button
                  key={key}
                  size="sm"
                  kind={key === stage ? 'primary' : 'tertiary'}
                  aria-pressed={key === stage}
                  disabled={busy}
                  onClick={() => requestExit(key)}
                >
                  {t(key)}
                </Button>
              ))}
            </div>
          )}
          {!conduction && <h3 className={styles.sectionTitle}>{t(stage)}</h3>}
          {!conduction && audit}
          <HemovigilanceFields
            key={stage}
            stage={stage}
            unit={unit}
            history={history}
            fields={fields}
            t={t}
            copied={unit.sections.conduction?.fields}
            readOnly={!canEdit(stage) || busy}
            setFields={(value) => {
              setEditor((current) => ({ ...current, fields: value, changed: true }));
              setError('');
            }}
          />
          {conduction && audit}
          {busy && <InlineLoading description={t('saving')} />}
        </ModalBody>
        <ModalFooter className={styles.caseFooter}>
          <div className={styles.actions}>
            {conduction ? (
              <>
                <Button
                  kind="ghost"
                  size="sm"
                  renderIcon={Printer}
                  disabled={busy}
                  onClick={() =>
                    printCase(
                      <ConductionPrint
                        unit={unit}
                        history={previousConductions(unit, conductionFields(unit), cases)}
                        t={t}
                      />,
                      t('conductionTitle', { code: conductionCode(unit) }),
                    )
                  }
                >
                  {t('printConduction')}
                </Button>
                {(unit.sections.report || canEdit('report')) && (
                  <Button
                    kind="tertiary"
                    size="sm"
                    renderIcon={Report}
                    disabled={busy}
                    onClick={() => requestExit('report')}
                  >
                    {t(unit.sections.report ? 'viewReaction' : 'reportReaction')}
                  </Button>
                )}
              </>
            ) : (
              <>
                {!bank && (
                  <Button
                    kind="ghost"
                    size="sm"
                    renderIcon={ArrowLeft}
                    disabled={busy}
                    onClick={() => requestExit('conduction')}
                  >
                    {t('backToConduction')}
                  </Button>
                )}
                <Button
                  kind="ghost"
                  size="sm"
                  renderIcon={Printer}
                  disabled={busy}
                  onClick={() => printCase(<Fr02Print unit={unit} t={t} />, t('report'))}
                >
                  {t('printFr02')}
                </Button>
              </>
            )}
          </div>
          <div className={styles.actions}>
            <Button kind="secondary" size="sm" disabled={busy} onClick={close}>
              {t('close')}
            </Button>
            {canEdit(stage) && (
              <Button
                size="sm"
                disabled={busy || (!changed && stage !== 'review')}
                onClick={async () => {
                  if ((await save()) === 'saved') finishExit('close');
                }}
              >
                {t(stage === 'review' ? 'confirmReview' : 'saveSection')}
              </Button>
            )}
          </div>
        </ModalFooter>
      </ComposedModal>
      {pendingExit && (
        <ExitConfirmation
          title={t(pendingExit === 'close' ? 'exitTitle' : 'switchTitle')}
          description={t('exitHelp')}
          closeLabel={t('close')}
          saving={busy}
          saveErrorText={t('saveFailed')}
          t={t}
          onCancel={() => setPendingExit(undefined)}
          onSave={save}
          onExit={() => finishExit(pendingExit)}
        />
      )}
    </>
  );
}
