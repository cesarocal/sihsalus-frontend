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
import { Printer, RainDrop } from '@carbon/react/icons';
import { ConfigurableLink, useConfig, userHasAccess, useSession } from '@openmrs/esm-framework';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BloodBankConfig } from '../../config-schema';
import { moduleName } from '../../constants';
import { formatListDate } from '../../shared/format-list-date';
import { printDocument } from '../../shared/print-document';
import { ProcessingTable, type ProcessingTranslate, useProcessingData } from '../../shared/processing-page.component';
import { componentDefinitions } from '../laboratory/fractionation/fractionation-rules';
import { PrintFr08 } from '../transfusions/fr08-document.component';
import type { TransfusionOrder } from '../transfusions/transfusions.types';
import { transfusionOperatorName } from '../transfusions/transfusions-rules';
import { useTransfusionsTranslation } from '../transfusions/use-transfusions-translation';
import {
  currentStage,
  type Fields,
  hemoPrivileges,
  reportDefaults,
  type Stage,
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
          t(onClose ? 'reactionState' : 'chartFr02'),
          t(onClose ? 'actions' : 'chartRecord'),
        ]}
        rows={units.map((unit) => ({
          id: id(unit),
          cells: [
            unit.order.number,
            ...(onClose ? [unit.order.patientName] : []),
            unit.dispatch.unitCode,
            t(componentDefinitions[unit.dispatch.component].key),
            formatListDate(unit.dispatch.deliveredAt),
            <Tag key="status" type={unit.sections.report ? 'blue' : 'gray'}>
              {t(currentStage(unit))}
            </Tag>,
            <Button key="open" kind="ghost" size="sm" onClick={() => setSelected(id(unit))}>
              {t(onClose ? 'openFr02' : 'openConduction')}
            </Button>,
          ],
        }))}
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

function UnitCaseDialog({
  unit,
  bank,
  onClose,
  t,
}: {
  unit: UnitCase;
  bank: boolean;
  onClose: () => void;
  t: ProcessingTranslate;
}) {
  const session = useSession();
  const canEdit = (stage: Stage) =>
    session.authenticated &&
    userHasAccess(stagePrivileges[stage], session.user) &&
    (!unit.sections[stage] || stage === 'conduction') &&
    (stage === 'conduction' || stage === 'report' || Boolean(unit.sections.report));
  const [stage, setStage] = useState<Stage>(bank ? 'investigation' : 'conduction');
  const [fields, setFields] = useState<Fields>(unit.sections[stage]?.fields ?? {});
  const [changed, setChanged] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [license, setLicense] = useState('');
  const saving = useRef(false);
  const personUuid = session.user?.person?.uuid ?? '';
  const providerUuid = session.currentProvider?.uuid ?? '';
  const actor = { name: transfusionOperatorName(session), personUuid, license };
  const saved = unit.sections[stage];
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
  const select = (next: Stage) => {
    if (next === stage) return;
    if (changed) {
      setError('saveBeforeSwitch');
      return;
    }
    setStage(next);
    setError('');
    setFields(
      unit.sections[next]?.fields ?? (next === 'report' ? reportDefaults(unit.sections.conduction?.fields) : {}),
    );
  };
  const save = async () => {
    if (saving.current || !canEdit(stage)) return;
    if (!validStage(stage, fields, unit.sections)) {
      setError('invalid' + stage);
      return;
    }
    if (!actor.name || !actor.personUuid) {
      setError('operatorUnavailable');
      return;
    }
    saving.current = true;
    setBusy(true);
    setError('');
    try {
      await saveHemovigilance(unit, stage, fields, actor);
      onClose();
    } catch {
      setError('saveFailed');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };
  const close = () => {
    if (busy) return false;
    if (changed) {
      setError('saveBeforeSwitch');
      return false;
    }
    onClose();
    return true;
  };
  const printError = () => setError('printFailed');
  const stages: Stage[] = bank
    ? ['report', ...(unit.sections.review ? ['review' as const] : []), 'investigation']
    : [
        'conduction',
        'report',
        ...(unit.sections.report && (unit.sections.review || userHasAccess(hemoPrivileges.review, session.user))
          ? ['review' as const]
          : []),
        ...(unit.sections.investigation ? ['investigation' as const] : []),
      ];
  return (
    <ComposedModal size="lg" open onClose={close} preventCloseOnClickOutside>
      <ModalHeader title={`${t(bank ? 'openFr02' : 'chapter')} · ${unit.dispatch.unitCode}`} />
      <ModalBody>
        <CaseFields unit={unit} t={t} />
        <div className={styles.actions}>
          {stages.map((key) => (
            <Button
              key={key}
              size="sm"
              kind={key === stage ? 'primary' : 'tertiary'}
              aria-pressed={key === stage}
              disabled={busy}
              onClick={() => select(key)}
            >
              {t(key)}
            </Button>
          ))}
        </div>
        <h3 className={styles.sectionTitle}>{t(stage)}</h3>
        {error && <InlineNotification kind="error" title={t(error)} hideCloseButton />}
        {(saved || canEdit(stage)) && (
          <dl className={styles.caseFields}>
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
        )}
        <HemovigilanceFields
          key={stage}
          stage={stage}
          fields={fields}
          t={t}
          copied={unit.sections.conduction?.fields}
          readOnly={!canEdit(stage) || busy}
          setFields={(value) => {
            setFields(value);
            setChanged(true);
            setError('');
          }}
        />
        {busy && <InlineLoading description={t('saving')} />}
      </ModalBody>
      <ModalFooter>
        <div className={styles.actions}>
          <PrintFr08 order={unit.order} t={t} label={t('printFr08')} disabled={busy} />
          {!bank && (
            <Button
              kind="ghost"
              size="sm"
              renderIcon={Printer}
              disabled={busy}
              onClick={() =>
                printDocument(<ConductionPrint unit={unit} t={t} />, t('conduction'), printError, hemovigilancePrintCss)
              }
            >
              {t('printConduction')}
            </Button>
          )}
          <Button
            kind="ghost"
            size="sm"
            renderIcon={Printer}
            disabled={busy}
            onClick={() =>
              printDocument(<Fr02Print unit={unit} t={t} />, t('report'), printError, hemovigilancePrintCss)
            }
          >
            {t('printFr02')}
          </Button>
        </div>
        {changed && (
          <Button
            kind="secondary"
            disabled={busy}
            onClick={() => {
              setFields(saved?.fields ?? (stage === 'report' ? reportDefaults(unit.sections.conduction?.fields) : {}));
              setChanged(false);
              setError('');
            }}
          >
            {t('discardEdits')}
          </Button>
        )}
        <Button kind="secondary" disabled={busy || changed} onClick={close}>
          {t('close')}
        </Button>
        {canEdit(stage) && (
          <Button disabled={busy || (!changed && stage !== 'review')} onClick={() => void save()}>
            {t(stage === 'review' ? 'confirmReview' : 'saveSection')}
          </Button>
        )}
      </ModalFooter>
    </ComposedModal>
  );
}
