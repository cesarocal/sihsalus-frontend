import {
  Button,
  ComposedModal,
  InlineLoading,
  InlineNotification,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Search,
  Select,
  SelectItem,
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
import { printDocument, type PrintPageFit } from '../../shared/print-document';
import {
  normalizeSearch,
  ProcessingTable,
  type ProcessingTranslate,
  useProcessingData,
} from '../../shared/processing-page.component';
import { WarningConfirmation } from '../../shared/warning-confirmation.component';
import { componentDefinitions, componentTypes } from '../laboratory/fractionation/fractionation-rules';
import type { TransfusionOrder } from '../transfusions/transfusions.types';
import { transfusionOperatorName } from '../transfusions/transfusions-rules';
import { useTransfusionsTranslation } from '../transfusions/use-transfusions-translation';
import {
  canReportReaction,
  conductionCode,
  conductionError,
  conductionFields,
  currentStage,
  type Fields,
  hemoPrivileges,
  previousConductions,
  reactionStates,
  reportDefaults,
  reportNotificationTimes,
  type Stage,
  transfusionProgress,
  transfusionStates,
  type UnitCase,
  validStage,
} from './hemovigilance';
import {
  actorLicense,
  hemovigilanceSaveError,
  isLocalHemovigilance,
  listHemovigilance,
  listPatientHemovigilance,
  saveHemovigilance,
} from './hemovigilance.resource';
import styles from './hemovigilance.scss';
import { CaseFields, HemovigilanceFields } from './hemovigilance-forms.component';
import { ConductionPrint, Fr02Print, fr02PrintPage, hemovigilancePrintCss } from './hemovigilance-print.component';

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
  const [query, setQuery] = useState('');
  const [component, setComponent] = useState('');
  const [progressFilter, setProgressFilter] = useState('');
  const [reactionFilter, setReactionFilter] = useState('');
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
  const term = normalizeSearch(query);
  const isFiltered = Boolean(term || component || progressFilter || reactionFilter);
  const visibleUnits = onClose
    ? units
    : units.filter(
        (unit) =>
          (!component || unit.dispatch.component === component) &&
          (!progressFilter || (transfusionProgress(unit) ?? 'unstarted') === progressFilter) &&
          (!reactionFilter || currentStage(unit) === reactionFilter) &&
          (!term ||
            [unit.order.number, unit.dispatch.unitCode, t(componentDefinitions[unit.dispatch.component].key)].some(
              (value) => normalizeSearch(value).includes(term),
            )),
      );
  const table = (
    <div className={onClose ? styles.panel : `${styles.panel} ${styles.chartPanel}`}>
      {!onClose && (
        <div className={styles.chartFilters}>
          <Search
            id="hemo-chart-search"
            labelText={t('chartSearch')}
            placeholder={t('chartSearch')}
            closeButtonLabelText={t('clearSearch')}
            size="md"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Select
            id="hemo-chart-component"
            size="md"
            labelText={t('component')}
            value={component}
            onChange={(event) => setComponent(event.target.value)}
          >
            <SelectItem value="" text={t('chartAllComponents')} />
            {componentTypes.map((type) => (
              <SelectItem key={type} value={type} text={t(componentDefinitions[type].key)} />
            ))}
          </Select>
          <Select
            id="hemo-chart-progress"
            size="md"
            labelText={t('transfusionStatus')}
            value={progressFilter}
            onChange={(event) => setProgressFilter(event.target.value)}
          >
            <SelectItem value="" text={t('chartAllStates')} />
            <SelectItem value="unstarted" text={t('chartUnstarted')} />
            {transfusionStates.map((state) => (
              <SelectItem key={state} value={state} text={t(state)} />
            ))}
          </Select>
          <Select
            id="hemo-chart-reaction"
            size="md"
            labelText={t('chartFr02')}
            value={reactionFilter}
            onChange={(event) => setReactionFilter(event.target.value)}
          >
            <SelectItem value="" text={t('chartAllStates')} />
            {reactionStates.map((state) => (
              <SelectItem key={state} value={state} text={t(state)} />
            ))}
          </Select>
        </div>
      )}
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
        rows={visibleUnits.map((unit) => {
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
        emptyHelp={t(onClose ? 'queueEmpty' : isFiltered ? 'chartNoMatches' : 'noDeliveries')}
        filterKey={JSON.stringify([term, component, progressFilter, reactionFilter])}
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
  if (stage === 'report') {
    const fields = unit.sections.report?.fields ?? reportDefaults(unit.sections.conduction?.fields);
    return { ...fields, ...reportNotificationTimes(unit.sections) };
  }
  return unit.sections[stage]?.fields ?? {};
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
  const [pendingConfirmation, setPendingConfirmation] = useState<'conduction' | 'review'>();
  const canEdit = (stage: Stage) =>
    session.authenticated &&
    userHasAccess(stagePrivileges[stage], session.user) &&
    (stage === 'conduction'
      ? !unit.sections.conduction?.fields.endTime
      : !unit.sections[stage] &&
        (stage === 'report' ? canReportReaction(unit.sections.conduction?.fields) : Boolean(unit.sections.report)));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [license, setLicense] = useState('');
  const [loadingLicense, setLoadingLicense] = useState(true);
  const saving = useRef(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const personUuid = session.user?.person?.uuid ?? '';
  const providerUuid = session.currentProvider?.uuid ?? '';
  const actor = { name: transfusionOperatorName(session), personUuid, license };
  const saved = unit.sections[stage];
  const conduction = stage === 'conduction';
  const physician = session.authenticated && userHasAccess(hemoPrivileges.review, session.user);
  const canPrintConduction = Boolean(unit.sections.conduction?.fields.endTime) && !busy && !changed;
  const finalizing = conduction && Boolean(fields.endTime);
  const physicianReport = !bank && physician && stage === 'report' && Boolean(unit.sections.report);
  const canOpenReport = Boolean(
    unit.sections.report || (session.authenticated && userHasAccess(hemoPrivileges.report, session.user)),
  );
  const history = conduction ? previousConductions(unit, fields, cases) : [];
  useEffect(() => {
    let active = true;
    setLicense('');
    setLoadingLicense(true);
    void actorLicense(personUuid, providerUuid)
      .then(
        (value) => {
          if (active) setLicense(value);
        },
        () => {},
      )
      .finally(() => {
        if (active) setLoadingLicense(false);
      });
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
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
    setEditor((current) => ({
      ...current,
      stage: next,
      fields: fieldsForStage(current.unit, next),
      changed: false,
    }));
  };
  const save = async (action = stage): Promise<ExitSaveResult> => {
    const values = action === 'review' ? {} : fields;
    if (saving.current || !canEdit(action) || (loadingLicense && (action === 'report' || action === 'review')))
      return 'failed';
    if (!validStage(action, values, unit.sections)) {
      setError(action === 'conduction' ? conductionError(values) : 'invalid' + action);
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
      const record = await saveHemovigilance(unit, action, values, actor);
      setEditor((current) => {
        const unit = { ...current.unit, sections: { ...current.unit.sections, [action]: record } };
        return { ...current, unit, fields: fieldsForStage(unit, current.stage), changed: false };
      });
      const success =
        action === 'conduction'
          ? finalizing
            ? 'conductionSent'
            : 'conductionSaved'
          : action === 'review'
            ? 'reviewSaved'
            : 'recordSaved';
      notifySuccess(t(success));
      return 'saved';
    } catch (error) {
      setError(hemovigilanceSaveError(error));
      return 'failed';
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };
  const requestExit = (next: Stage | 'close') => {
    if (busy || pendingExit || pendingConfirmation || next === stage) return false;
    if (next === 'report' && !unit.sections.report && !canReportReaction(unit.sections.conduction?.fields)) {
      setError('saveConductionTimesFirst');
      return false;
    }
    if (changed) setPendingExit(next);
    else finishExit(next);
    return false;
  };
  // Carbon's native Escape listener holds the first close handler while the dialog is open.
  const closeRequest = useRef(requestExit);
  closeRequest.current = requestExit;
  const close = () => closeRequest.current('close');
  const printError = () => setError('printFailed');
  const printCase = (document: ReactNode, title: string, fitPage?: PrintPageFit) => {
    setError('');
    try {
      printDocument(document, title, printError, hemovigilancePrintCss, undefined, fitPage);
    } catch {
      printError();
    }
  };
  const stages = ['report', 'investigation'] as const;
  const title = conduction
    ? t('unitConductionTitle', { code: unit.dispatch.unitCode })
    : `${t(bank ? 'openFr02' : 'report')}: ${unit.dispatch.unitCode}`;
  const audit = (saved || canEdit(stage)) && (
    <dl className={conduction ? `${styles.sheetCard} ${styles.conductionAudit}` : styles.caseFields}>
      <div>
        <dt>{t('recordedBy')}</dt>
        <dd>{(canEdit(stage) ? actor : saved?.actor)?.name || '—'}</dd>
      </div>
      <div>
        <dt>{t('registration')}</dt>
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
        <ModalBody ref={bodyRef} className={styles.conductionBody}>
          {error && !pendingConfirmation && !pendingExit && (
            <InlineNotification
              className={styles.notification}
              lowContrast
              kind="error"
              title={t(error)}
              hideCloseButton
            />
          )}
          {stage === 'investigation' && <CaseFields unit={unit} t={t} />}
          {!conduction && bank && (
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
          {stage === 'investigation' && <h3 className={styles.sectionTitle}>{t(stage)}</h3>}
          {stage === 'investigation' && audit}
          <HemovigilanceFields
            key={stage}
            stage={stage}
            unit={unit}
            history={history}
            fields={fields}
            t={t}
            nurse={unit.sections.report?.actor ?? (canEdit('report') ? actor : undefined)}
            reviewer={unit.sections.review?.actor ?? (physicianReport ? actor : undefined)}
            readOnly={!canEdit(stage) || busy}
            showBankNotification={bank}
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
                {physician && (
                  <Button
                    kind="ghost"
                    size="sm"
                    renderIcon={Printer}
                    disabled={!canPrintConduction}
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
                )}
                {canOpenReport && (
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
                {!bank && stage === 'report' && unit.sections.investigation && (
                  <Button kind="ghost" size="sm" disabled={busy} onClick={() => requestExit('investigation')}>
                    {t('investigation')}
                  </Button>
                )}
                {!bank && stage === 'investigation' && (
                  <Button kind="ghost" size="sm" disabled={busy} onClick={() => requestExit('report')}>
                    {t('viewReaction')}
                  </Button>
                )}
                {(physicianReport || bank) && (
                  <Button
                    kind="ghost"
                    size="sm"
                    renderIcon={Printer}
                    disabled={busy || !unit.sections.review}
                    onClick={() => {
                      if (unit.sections.review) printCase(<Fr02Print unit={unit} t={t} />, t('report'), fr02PrintPage);
                    }}
                  >
                    {t('printFr02')}
                  </Button>
                )}
              </>
            )}
          </div>
          <div className={styles.actions}>
            {!physicianReport && (
              <Button kind="secondary" size="sm" disabled={busy} onClick={close}>
                {t('close')}
              </Button>
            )}
            {physicianReport && canEdit('review') && (
              <Button
                size="sm"
                disabled={busy || loadingLicense}
                onClick={() => {
                  setError('');
                  setPendingConfirmation('review');
                }}
              >
                {t('confirmReview')}
              </Button>
            )}
            {canEdit(stage) && (
              <Button
                size="sm"
                disabled={busy || !changed || (stage === 'report' && loadingLicense)}
                onClick={async () => {
                  if (finalizing && !conductionError(fields)) {
                    setError('');
                    setPendingConfirmation('conduction');
                    return;
                  }
                  const result = await save();
                  if (result === 'saved' && !conduction) finishExit('close');
                }}
              >
                {t('saveSection')}
              </Button>
            )}
          </div>
        </ModalFooter>
      </ComposedModal>
      {pendingExit && (
        <ExitConfirmation
          title={t(pendingExit === 'close' ? 'exitTitle' : 'switchTitle')}
          description={
            finalizing
              ? `${t('exitHelp')} ${t('finalizeConductionHelp')} ${t('finalizeConductionLock')}`
              : t('exitHelp')
          }
          closeLabel={t('close')}
          saving={busy}
          saveErrorText={t('saveFailed')}
          t={t}
          onCancel={() => setPendingExit(undefined)}
          onSave={() => save()}
          onExit={() => finishExit(pendingExit)}
        />
      )}
      {pendingConfirmation && (
        <WarningConfirmation
          title={t(pendingConfirmation === 'review' ? 'finalizeReview' : 'finalizeConduction')}
          description={t(pendingConfirmation === 'review' ? 'finalizeReviewHelp' : 'finalizeConductionHelp')}
          items={[]}
          note={t(pendingConfirmation === 'review' ? 'finalizeReviewStatus' : 'finalizeConductionLock')}
          error={error ? t(error) : undefined}
          cancelLabel={t('cancel')}
          confirmLabel={t(pendingConfirmation === 'review' ? 'confirmReview' : 'sendConduction')}
          closeLabel={t('close')}
          saving={busy}
          onCancel={() => setPendingConfirmation(undefined)}
          onConfirm={async () => {
            if ((await save(pendingConfirmation)) === 'saved') setPendingConfirmation(undefined);
          }}
        />
      )}
    </>
  );
}
