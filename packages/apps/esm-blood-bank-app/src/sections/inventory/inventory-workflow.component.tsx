import {
  Button,
  Checkbox,
  ComposedModal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  TextInput,
} from '@carbon/react';
import { Close, Printer } from '@carbon/react/icons';
import { openmrsFetch, restBaseUrl, useSession } from '@openmrs/esm-framework';
import { useCallback, useRef, useState } from 'react';
import type { InventoryApi } from '../../api/inventory.api';
import { useApiData } from '../../api/use-api-data';
import { notifySuccess } from '../../shared/notify-success';
import { printDocument } from '../../shared/print-document';
import { ProcessingModal } from '../../shared/processing-modal.component';
import type { ProcessingTranslate } from '../../shared/processing-page.component';
import { useLiveClock } from '../../shared/use-live-clock';
import { WarningConfirmation } from '../../shared/warning-confirmation.component';
import shared from '../applicant-selection/selection.scss';
import { FractionationContent } from '../laboratory/fractionation/fractionation-content.component';
import { localDateTime } from '../laboratory/screening/screening-rules';
import { disposalCauses, isDisposalCause } from './disposal-causes';
import styles from './inventory.scss';
import type { InventoryOperation, InventoryUnit } from './inventory.types';
import {
  DisposalAct,
  QualitySealReprintHistory,
  QualitySeals,
  qualitySealPrintCss,
} from './inventory-documents.component';
import { canReprintSeal, inventoryDisplayDate, validateInventoryOperation } from './inventory-rules';
import { InventorySelector } from './inventory-selector.component';
import { QualitySealReprintDialog } from './quality-seal-reprint.component';

export function InventoryWorkflow({
  initial,
  units,
  api,
  onClose,
  onSaved,
  openReprint = false,
  t,
}: {
  initial: InventoryOperation;
  units: InventoryUnit[];
  api: InventoryApi;
  onClose: () => void;
  onSaved: () => void;
  openReprint?: boolean;
  t: ProcessingTranslate;
}) {
  const [storedOperation, setOperation] = useState(initial);
  const [step, setStep] = useState(
    initial.kind === 'qualitySeal'
      ? initial.stage === 'draft'
        ? 0
        : 1
      : initial.stage === 'completed' || initial.disposalStep === 'review'
        ? 2
        : initial.disposalStep === 'causes'
          ? 1
          : 0,
  );
  const [dirty, setDirty] = useState(!initial.id && initial.units.length > 0);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [failed, setFailed] = useState('');
  const [confirmedPrint, setConfirmedPrint] = useState(false);
  const [confirmDisposal, setConfirmDisposal] = useState(false);
  const [confirmPrint, setConfirmPrint] = useState(false);
  const [reprint, setReprint] = useState(openReprint);
  const requestInFlight = useRef(false);
  const { authenticated, user } = useSession();
  const isSeal = storedOperation.kind === 'qualitySeal';
  const finalized = storedOperation.stage === 'completed';
  const person = authenticated ? user?.person : undefined;
  const name = person?.preferredName;
  const sessionName =
    [name?.givenName, name?.middleName, name?.familyName, name?.familyName2]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(' ') ||
    name?.display?.trim() ||
    person?.display?.trim() ||
    '';
  const personUuid = person?.uuid;
  const liveSeal = isSeal && (storedOperation.stage === 'draft' || storedOperation.stage === 'ready');
  const pendingSealConfirmation = isSeal && storedOperation.stage === 'printRequested';
  const liveDisposal = !isSeal && !finalized && step === 1;
  const lookupOperator =
    !sessionName &&
    Boolean(personUuid) &&
    (liveSeal || pendingSealConfirmation || reprint || (!isSeal && !finalized && step > 0));
  const [operatorLookupAttempt, setOperatorLookupAttempt] = useState(0);
  const loadOperator = useCallback(async () => {
    if (!personUuid) throw new Error('INVENTORY_OPERATOR_UNAVAILABLE');
    const { data } = await openmrsFetch<{ uuid: string; display?: string }>(
      `${restBaseUrl}/person/${encodeURIComponent(personUuid)}?v=custom:(uuid,display)`,
      { rejectOnAuthFailure: true },
    );
    if (data?.uuid !== personUuid || !data.display?.trim()) throw new Error('INVENTORY_OPERATOR_UNAVAILABLE');
    return data;
  }, [personUuid]);
  const operatorProfile = useApiData(lookupOperator ? loadOperator : null, operatorLookupAttempt);
  const operator =
    sessionName ||
    (lookupOperator && operatorProfile.data?.uuid === personUuid ? (operatorProfile.data?.display?.trim() ?? '') : '');
  const loadingOperator = lookupOperator && !operator && !operatorProfile.error;
  const loadSignatories = useCallback(() => api.getDisposalSignatories(), [api]);
  const [signatoryLookupAttempt, setSignatoryLookupAttempt] = useState(0);
  const signatories = useApiData(liveDisposal ? loadSignatories : null, signatoryLookupAttempt);
  const clock = useLiveClock(liveSeal || liveDisposal);
  const currentTime = localDateTime(clock);
  const operation =
    isSeal && storedOperation.stage === 'draft'
      ? {
          ...storedOperation,
          date: currentTime.slice(0, 10),
          time: currentTime.slice(11),
          serviceResponsible: operator,
        }
      : liveDisposal
        ? {
            ...storedOperation,
            date: currentTime.slice(0, 10),
            time: currentTime.slice(11),
            witnesses: operator,
            serviceResponsible: signatories.data?.serviceResponsible ?? '',
            epidemiologyResponsible: signatories.data?.epidemiologyResponsible ?? '',
          }
        : storedOperation;
  const printLabel = t(operation.units.length === 1 ? 'inventoryPrintSeal' : 'inventoryPrintSeals');
  const reprintIds = units.filter((unit) => canReprintSeal(operation, unit)).map(({ id }) => id);
  const steps = isSeal
    ? ['inventorySelectUnits', 'inventoryPrintSealStep']
    : ['inventorySelectUnits', 'inventoryDisposalDetails', 'inventoryReviewAct'];
  const change = (patch: Partial<InventoryOperation>) => {
    setOperation({ ...operation, ...patch });
    setDirty(true);
    setFailed('');
  };
  const execute = async (action: (op: InventoryOperation) => Promise<InventoryOperation>, success?: string) => {
    if (requestInFlight.current) return null;
    requestInFlight.current = true;
    setSaving(true);
    setFailed('');
    try {
      const result = await action(operation);
      setOperation(result);
      setDirty(false);
      onSaved();
      if (success && result.revision !== operation.revision) notifySuccess(t(success));
      return result;
    } catch {
      setFailed('inventorySaveFailed');
      return null;
    } finally {
      requestInFlight.current = false;
      setSaving(false);
    }
  };
  const saveDraft = async () => {
    if (!dirty) return 'unchanged' as const;
    const result = await execute(api.saveDraft, 'inventoryDraftSaved');
    return result ? ('saved' as const) : ('failed' as const);
  };
  const advance = async () => {
    const missing = validateInventoryOperation(operation, !isSeal && step === 0).map((field) =>
      isSeal && field === 'inventoryResponsibleRequired'
        ? loadingOperator
          ? 'inventoryOperatorLoading'
          : 'inventoryOperatorUnavailable'
        : field,
    );
    setErrors(missing);
    if (missing.length) return;
    if (step < steps.length - 1) {
      const result = await execute(
        isSeal ? api.prepareSeal : step === 0 ? api.saveDisposalSelection : api.saveDisposalDetails,
        isSeal ? 'inventorySealPrepared' : 'inventoryDraftSaved',
      );
      if (result) setStep(step + 1);
    } else if (isSeal) {
      if (operation.stage !== 'printRequested' || !confirmedPrint) return;
      if (!operator) {
        setErrors([loadingOperator ? 'inventoryOperatorLoading' : 'inventoryOperatorUnavailable']);
        return;
      }
      if (await execute((op) => api.confirmSeal(op, operator), 'inventorySealsCompleted')) onClose();
    } else if (!operator) setErrors(['inventoryOperatorUnavailable']);
    else if (operation.witnesses !== operator) {
      setStep(1);
      setErrors(['inventoryDisposalOperatorChanged']);
    } else setConfirmDisposal(true);
  };
  const renderSeals = (requested: InventoryOperation, unitIds?: string[]) => {
    setConfirmedPrint(false);
    try {
      printDocument(
        <QualitySeals operation={requested} unitIds={unitIds} t={t} />,
        t('inventoryQualitySeal'),
        () => setFailed('printFailed'),
        qualitySealPrintCss,
      );
    } catch {
      setFailed('printFailed');
    }
  };
  const printSeals = async () => {
    if (operation.stage !== 'ready' || !operator) return;
    const requested = await execute((op) => api.requestSealPrint(op, operator), 'inventoryPrintRequested');
    if (!requested) return;
    setConfirmPrint(false);
    renderSeals(requested);
  };
  const sealFields = () => {
    const live = liveSeal;
    return (
      <div className={styles.form}>
        <TextInput
          id="inventory-date"
          labelText={t('inventoryDate')}
          value={inventoryDisplayDate(live ? currentTime.slice(0, 10) : operation.date)}
          readOnly
        />
        <TextInput
          id="inventory-time"
          labelText={t('inventoryTime')}
          value={live ? currentTime.slice(11) : operation.time}
          readOnly
        />
        <TextInput
          id="inventory-serviceResponsible"
          labelText={t('inventoryProcedureResponsible')}
          value={live ? operator : operation.serviceResponsible}
          helperText={
            live && !operator
              ? t(loadingOperator ? 'inventoryOperatorLoading' : 'inventoryOperatorUnavailable')
              : undefined
          }
          readOnly
        />
        {live && lookupOperator && !operator && operatorProfile.error && (
          <Button kind="ghost" size="sm" onClick={() => setOperatorLookupAttempt((attempt) => attempt + 1)}>
            {t('retry')}
          </Button>
        )}
      </div>
    );
  };
  const printAct = () => {
    setFailed('');
    try {
      printDocument(<DisposalAct operation={operation} print t={t} />, t('inventoryActTitle'), () =>
        setFailed('printFailed'),
      );
    } catch {
      setFailed('printFailed');
    }
  };
  const removeUnit = async (unitId: string) => {
    const result = await execute((op) => api.saveDraft({ ...op, units: op.units.filter(({ id }) => id !== unitId) }));
    if (!result) return;
    setErrors([]);
    if (!result.units.length) setStep(0);
  };
  const disposalField = (
    field: 'date' | 'time' | 'witnesses' | 'serviceResponsible' | 'epidemiologyResponsible',
    key: string,
  ) => (
    <TextInput
      key={field}
      id={`inventory-${field}`}
      labelText={t(key)}
      value={field === 'date' ? inventoryDisplayDate(operation.date) : operation[field]}
      readOnly
    />
  );
  return (
    <>
      <ProcessingModal
        title={`${t(isSeal ? 'inventoryQualitySeal' : 'inventoryDispose')}${operation.id ? `${isSeal ? ' — ' : ' - '}${operation.id}` : ''}`}
        steps={steps}
        step={step}
        completed={steps.slice(0, step)}
        finalized={finalized}
        saving={saving}
        errors={errors}
        failed={failed}
        saveErrorText={t('inventorySaveFailed')}
        onClose={onClose}
        closeDisabled={confirmDisposal || confirmPrint || reprint}
        onSaveBeforeExit={saveDraft}
        onAdvance={() => {
          void advance();
        }}
        previousDisabled={operation.stage !== 'draft'}
        onPrevious={() => {
          if (operation.stage === 'draft') setStep(Math.max(0, step - 1));
          setErrors([]);
        }}
        advanceLabel={t(
          step < steps.length - 1 ? 'next' : isSeal ? 'inventoryConfirmPrinting' : 'inventoryRegisterAct',
        )}
        advanceDisabled={
          (step === 1 &&
            isSeal &&
            (operation.stage !== 'printRequested' || !confirmedPrint || failed === 'printFailed')) ||
          (liveDisposal && (signatories.isLoading || loadingOperator))
        }
        footerClassName={styles.printFooter}
        extraActions={
          isSeal && step === 1 && operation.stage === 'ready' ? (
            <Button
              kind="ghost"
              renderIcon={Printer}
              disabled={saving || !operator}
              onClick={() => setConfirmPrint(true)}
            >
              {printLabel}
            </Button>
          ) : isSeal && step === 1 && (operation.stage === 'printRequested' || finalized) ? (
            <Button
              kind="ghost"
              renderIcon={Printer}
              disabled={saving || !reprintIds.length}
              onClick={() => setReprint(true)}
            >
              {t('inventoryReprintTitle')}
            </Button>
          ) : !isSeal && step === 2 ? (
            <Button kind="ghost" renderIcon={Printer} disabled={saving} onClick={printAct}>
              {t('inventoryPrintAct')}
            </Button>
          ) : null
        }
        t={t}
      >
        <FractionationContent>
          {step === 0 || (!isSeal && step === 1) ? (
            <>
              {step === 0 && (
                <>
                  {isSeal && <p className={styles.help}>{t('inventorySealSelectionHelp')}</p>}
                  <InventorySelector
                    units={units}
                    selected={operation.units}
                    kind={operation.kind}
                    operationId={operation.id}
                    prefix="inventory-workflow"
                    busy={saving}
                    onChange={(selected) =>
                      change({
                        units: selected,
                        labelsVerified: false,
                        integrityVerified: false,
                        recordsVerified: false,
                      })
                    }
                    t={t}
                  />
                </>
              )}
              {!isSeal && step === 1 && (
                <div className={shared.tableScroll}>
                  <table className="cds--data-table cds--data-table--zebra" aria-label={t('inventoryDisposalDetails')}>
                    <thead>
                      <tr>
                        {['inventoryUnitNumber', 'bloodGroup', 'fractionationComponent', 'inventoryDisposalCause'].map(
                          (key) => (
                            <th key={key}>{t(key)}</th>
                          ),
                        )}
                        <th scope="col">{t('actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {operation.units.map((unit) => {
                        const selectedDisposalCause = operation.causes[unit.id] ?? '';
                        return (
                          <tr key={unit.id}>
                            <td>{unit.id}</td>
                            <td>{unit.bloodGroup}</td>
                            <td>{unit.component}</td>
                            <td>
                              <Select
                                id={`inventory-cause-${unit.id}`}
                                labelText={`${t('inventoryDisposalCause')} — ${unit.id}`}
                                hideLabel
                                value={selectedDisposalCause}
                                disabled={saving}
                                onChange={(event) =>
                                  change({ causes: { ...operation.causes, [unit.id]: event.target.value } })
                                }
                              >
                                <SelectItem value="" text={t('inventoryChooseCause')} />
                                {selectedDisposalCause && !isDisposalCause(selectedDisposalCause) && (
                                  <SelectItem
                                    value={selectedDisposalCause}
                                    text={`${t('inventoryPreviousCause')}: ${selectedDisposalCause}`}
                                    disabled
                                  />
                                )}
                                {disposalCauses.map((value) => (
                                  <SelectItem key={value} value={value} text={t(`inventoryCause_${value}`)} />
                                ))}
                              </Select>
                            </td>
                            <td>
                              <Button
                                kind="ghost"
                                size="sm"
                                hasIconOnly
                                renderIcon={Close}
                                iconDescription={`${t('inventoryRemoveDisposalUnit')} ${unit.id}`}
                                disabled={saving}
                                onClick={() => void removeUnit(unit.id)}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {(isSeal || step === 1) && (
                <>
                  {isSeal ? (
                    sealFields()
                  ) : (
                    <div className={styles.form}>
                      {disposalField('date', 'inventoryDate')}
                      {disposalField('time', 'inventoryTime')}
                      {disposalField('serviceResponsible', 'inventoryServiceResponsible')}
                      {disposalField('epidemiologyResponsible', 'inventoryEpidemiologyResponsible')}
                      {disposalField('witnesses', 'inventoryWitnesses')}
                      {!operator && (
                        <p role="status">
                          {t(loadingOperator ? 'inventoryOperatorLoading' : 'inventoryOperatorUnavailable')}
                        </p>
                      )}
                      {lookupOperator && operatorProfile.error && (
                        <Button
                          kind="ghost"
                          size="sm"
                          onClick={() => setOperatorLookupAttempt((attempt) => attempt + 1)}
                        >
                          {t('retry')}
                        </Button>
                      )}
                      {!signatories.isLoading &&
                        (!operation.serviceResponsible || !operation.epidemiologyResponsible) && (
                          <p role="status">{t('inventoryDisposalSignatoriesUnavailable')}</p>
                        )}
                      {signatories.error && (
                        <Button
                          kind="ghost"
                          size="sm"
                          onClick={() => setSignatoryLookupAttempt((attempt) => attempt + 1)}
                        >
                          {t('retry')}
                        </Button>
                      )}
                    </div>
                  )}
                  {isSeal && (
                    <div className={styles.checks}>
                      {(['labelsVerified', 'integrityVerified', 'recordsVerified'] as const).map((key) => (
                        <Checkbox
                          key={key}
                          id={`inventory-${key}`}
                          labelText={t(`inventoryCheck_${key}`)}
                          checked={operation[key]}
                          disabled={saving}
                          onChange={(_event, { checked }) => change({ [key]: checked })}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          ) : isSeal ? (
            <>
              {sealFields()}
              <QualitySeals operation={operation} t={t} />
              {operation.stage === 'printRequested' && (
                <p className={styles.help}>{t('inventoryPrintConfirmationHelp')}</p>
              )}
              {!finalized && (
                <div className={styles.checks}>
                  <Checkbox
                    id="inventory-print-confirmed"
                    labelText={t('inventoryPrintConfirmed')}
                    checked={confirmedPrint}
                    disabled={saving || operation.stage !== 'printRequested' || failed === 'printFailed'}
                    onChange={(_event, { checked }) => setConfirmedPrint(checked)}
                  />
                </div>
              )}
              <QualitySealReprintHistory operation={operation} t={t} />
            </>
          ) : (
            <DisposalAct operation={operation} t={t} />
          )}
        </FractionationContent>
      </ProcessingModal>
      {confirmPrint && (
        <WarningConfirmation
          title={t('inventoryConfirmSealPrint')}
          description={t('inventoryPrintOnceHelp')}
          items={[]}
          note={t('inventoryCheckPrinter')}
          cancelLabel={t('inventoryCancel')}
          confirmLabel={saving ? t('saving') : t('inventoryContinue')}
          closeLabel={t('close')}
          saving={saving}
          error={failed ? t(failed) : undefined}
          onCancel={() => {
            setConfirmPrint(false);
            setFailed('');
          }}
          onConfirm={printSeals}
        />
      )}
      {reprint && (
        <QualitySealReprintDialog
          operation={operation}
          eligibleIds={reprintIds}
          operator={operator}
          loadingOperator={loadingOperator}
          onRetryOperator={
            lookupOperator && operatorProfile.error
              ? () => setOperatorLookupAttempt((attempt) => attempt + 1)
              : undefined
          }
          t={t}
          onClose={() => setReprint(false)}
          onPrint={async (unitIds, reason) => {
            const requested = await execute(
              (op) => api.requestSealReprint(op, { unitIds, reason, operator }),
              'inventoryReprintRequested',
            );
            if (!requested) return false;
            renderSeals(requested, unitIds);
            return true;
          }}
        />
      )}
      {confirmDisposal && (
        <ComposedModal
          open
          size="sm"
          preventCloseOnClickOutside
          aria-label={t('inventoryConfirmDisposal')}
          onClose={() => {
            if (!requestInFlight.current) setConfirmDisposal(false);
            return false;
          }}
        >
          <ModalHeader
            title={t('inventoryConfirmDisposal')}
            iconDescription={t('close')}
            closeModal={() => {
              if (!requestInFlight.current) setConfirmDisposal(false);
            }}
          />
          <ModalBody>
            <p>{t(operation.units.length === 1 ? 'inventoryDisposalWarningSingle' : 'inventoryDisposalWarning')}</p>
          </ModalBody>
          <ModalFooter>
            <Button kind="secondary" disabled={saving} onClick={() => setConfirmDisposal(false)}>
              {t('keepEditing')}
            </Button>
            <Button
              kind="danger"
              aria-label={t('inventoryRegisterAct')}
              dangerDescription={t('inventoryDangerDescription')}
              disabled={saving}
              onClick={() => {
                void execute(api.dispose, 'inventoryUnitsDisposed').then((result) => {
                  setConfirmDisposal(false);
                  if (result) onClose();
                });
              }}
            >
              {t('inventoryRegisterAct')}
            </Button>
          </ModalFooter>
        </ComposedModal>
      )}
    </>
  );
}
