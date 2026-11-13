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
import { Printer } from '@carbon/react/icons';
import { useSession } from '@openmrs/esm-framework';
import { useRef, useState } from 'react';
import type { InventoryApi } from '../../api/inventory.api';
import { notifySuccess } from '../../shared/notify-success';
import { ProcessingModal } from '../../shared/processing-modal.component';
import type { ProcessingTranslate } from '../../shared/processing-page.component';
import { printDocument } from '../../shared/print-document';
import { useLiveClock } from '../../shared/use-live-clock';
import { WarningConfirmation } from '../../shared/warning-confirmation.component';
import { FractionationContent } from '../laboratory/fractionation/fractionation-content.component';
import { localDateTime } from '../laboratory/screening/screening-rules';
import {
  DisposalAct,
  QualitySealReprintHistory,
  QualitySeals,
  qualitySealPrintCss,
} from './inventory-documents.component';
import { QualitySealReprintDialog } from './quality-seal-reprint.component';
import { InventorySelector } from './inventory-selector.component';
import { canReprintSeal, inventoryDisplayDate, validateInventoryOperation } from './inventory-rules';
import type { InventoryOperation, InventoryUnit } from './inventory.types';
import styles from './inventory.scss';
import shared from '../applicant-selection/selection.scss';
import { disposalCauses, isDisposalCause } from './disposal-causes';

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
  const [step, setStep] = useState(initial.stage === 'draft' ? 0 : 1);
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
  const operator = authenticated ? (user?.person?.display?.trim() ?? '') : '';
  const isSeal = storedOperation.kind === 'qualitySeal';
  const finalized = storedOperation.stage === 'completed';
  const clock = useLiveClock(isSeal && ['draft', 'ready'].includes(storedOperation.stage));
  const currentTime = localDateTime(clock);
  const operation =
    isSeal && storedOperation.stage === 'draft'
      ? {
          ...storedOperation,
          date: currentTime.slice(0, 10),
          time: currentTime.slice(11),
          serviceResponsible: operator,
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
  const execute = async (action: (op: InventoryOperation) => Promise<InventoryOperation>, success: string) => {
    if (requestInFlight.current) return null;
    requestInFlight.current = true;
    setSaving(true);
    setFailed('');
    try {
      const result = await action(operation);
      setOperation(result);
      setDirty(false);
      onSaved();
      if (result.revision !== operation.revision) notifySuccess(t(success));
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
    const missing = validateInventoryOperation(operation, !isSeal && step === 0);
    setErrors(missing);
    if (missing.length) return;
    if (step < steps.length - 1) {
      const result = await execute(
        isSeal ? api.prepareSeal : api.saveDraft,
        isSeal ? 'inventorySealPrepared' : 'inventoryDraftSaved',
      );
      if (result) setStep(step + 1);
    } else if (isSeal) {
      if (operation.stage !== 'printRequested' || !confirmedPrint) return;
      if (await execute(api.confirmSeal, 'inventorySealsCompleted')) onClose();
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
    const live = operation.stage === 'draft' || operation.stage === 'ready';
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
          labelText={t('inventoryServiceResponsible')}
          value={live ? operator : operation.serviceResponsible}
          readOnly
        />
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
  const textInput = (
    field: 'date' | 'time' | 'witnesses' | 'serviceResponsible' | 'epidemiologyResponsible',
    key: string,
  ) => (
    <TextInput
      key={field}
      id={`inventory-${field}`}
      labelText={t(key)}
      value={operation[field]}
      disabled={saving || operation.stage !== 'draft'}
      type={field === 'date' ? 'date' : field === 'time' ? 'time' : 'text'}
      onChange={(event) => change({ [field]: event.target.value })}
    />
  );
  return (
    <>
      <ProcessingModal
        title={`${t(isSeal ? 'inventoryQualitySeal' : 'inventoryDispose')}${operation.id ? ` — ${operation.id}` : ''}`}
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
          step === 1 && isSeal && (operation.stage !== 'printRequested' || !confirmedPrint || failed === 'printFailed')
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
                      {textInput('date', 'inventoryDate')}
                      {textInput('time', 'inventoryTime')}
                      {textInput('serviceResponsible', 'inventoryServiceResponsible')}
                      {textInput('epidemiologyResponsible', 'inventoryEpidemiologyResponsible')}
                      {textInput('witnesses', 'inventoryWitnesses')}
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
            <p>{t('inventoryDisposalWarning')}</p>
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
