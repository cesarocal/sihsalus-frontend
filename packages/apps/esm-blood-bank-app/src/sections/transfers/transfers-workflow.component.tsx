import {
  Button,
  Checkbox,
  ComposedModal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Search,
  Select,
  SelectItem,
  TextArea,
  TextInput,
} from '@carbon/react';
import { Printer } from '@carbon/react/icons';
import { useRef, useState } from 'react';
import type { TransfersApi } from '../../api/transfers.api';
import { notifySuccess } from '../../shared/notify-success';
import { printDocument } from '../../shared/print-document';
import { ProcessingModal } from '../../shared/processing-modal.component';
import { normalizeSearch, ProcessingTable, type ProcessingTranslate } from '../../shared/processing-page.component';
import shared from '../applicant-selection/selection.scss';
import { inventoryDisplayDate } from '../inventory/inventory-rules';
import { FractionationContent } from '../laboratory/fractionation/fractionation-content.component';
import { componentDefinitions } from '../laboratory/fractionation/fractionation-rules';
import styles from './transfers.scss';
import type { TransferRequest, TransferUnit } from './transfers.types';
import { TransferCertificate, TransferRequestDocument, TransferSummary } from './transfers-documents.component';
import { TransferRequestFields } from './transfers-fields.component';
import {
  candidateForRequest,
  completeTransferSelection,
  transferDirection,
  validateTransferDelivery,
  validateTransferPreparation,
  validateTransferRequest,
} from './transfers-rules';

export function TransfersWorkflow({
  initial,
  mode,
  units,
  api,
  onClose,
  onSaved,
  t,
}: {
  initial: TransferRequest;
  mode: 'register' | 'attend' | 'deliver';
  units: TransferUnit[];
  api: TransfersApi;
  onClose: () => void;
  onSaved: () => void;
  t: ProcessingTranslate;
}) {
  const [request, setRequest] = useState(initial);
  const [step, setStep] = useState(mode === 'attend' && initial.status === 'prepared' ? 1 : 0);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [failed, setFailed] = useState('');
  const [confirmation, setConfirmation] = useState<'reserve' | 'deliver' | 'reject' | null>(null);
  const [reason, setReason] = useState('');
  const [search, setSearch] = useState('');
  const [component, setComponent] = useState('');
  const inFlight = useRef(false);
  const readonly = mode === 'attend' && request.status === 'prepared';
  const outgoing = transferDirection(request) === 'outgoing';
  const steps =
    mode === 'register'
      ? ['transferRequestData', 'transferRequestReview']
      : mode === 'attend'
        ? ['transferReviewAndSelect', 'transferCertificate']
        : ['transferPickupData', 'transferDeliveryReview'];
  const change = (patch: Partial<TransferRequest>) => {
    setRequest({ ...request, ...patch });
    setDirty(true);
    setFailed('');
  };
  const execute = async (action: (value: TransferRequest) => Promise<TransferRequest>, message: string) => {
    if (inFlight.current) return null;
    inFlight.current = true;
    setSaving(true);
    setFailed('');
    try {
      const result = await action(request);
      setRequest(result);
      setDirty(false);
      setErrors([]);
      onSaved();
      if (result.revision !== request.revision) notifySuccess(t(message));
      return result;
    } catch {
      setFailed('transferSaveFailed');
      return null;
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };
  const saveDraft = async () => {
    if (!dirty) return 'unchanged' as const;
    const result = await execute(
      (value) =>
        mode === 'register'
          ? api.saveRequest(value, false)
          : mode === 'attend'
            ? api.savePreparation(value.id, value.revision, value.preparation)
            : api.saveDelivery(value.id, value.revision, value.delivery),
      'transferDraftSaved',
    );
    return result ? ('saved' as const) : ('failed' as const);
  };
  const advance = async () => {
    const missing =
      mode === 'register'
        ? validateTransferRequest(request.data)
        : mode === 'attend'
          ? validateTransferPreparation(request, units)
          : validateTransferDelivery(request);
    setErrors(missing);
    if (missing.length) return;
    if (mode === 'register') {
      if (
        await execute(
          (value) => api.saveRequest(value, step === 1),
          step === 1 ? (outgoing ? 'transferIssuedSaved' : 'transferReceivedSaved') : 'transferDraftSaved',
        )
      ) {
        if (step === 0) setStep(1);
        else onClose();
      }
    } else if (mode === 'attend') setConfirmation('reserve');
    else if (step === 0) {
      if (await execute((value) => api.saveDelivery(value.id, value.revision, value.delivery), 'transferPickupSaved'))
        setStep(1);
    } else setConfirmation('deliver');
  };
  const confirm = async () => {
    const result = await execute(
      async (value) => {
        if (confirmation === 'reject') return api.reject(value.id, value.revision, reason);
        if (confirmation === 'deliver') return api.deliver(value.id, value.revision);
        const saved = await api.savePreparation(value.id, value.revision, value.preparation);
        setRequest(saved);
        return api.reserve(saved.id, saved.revision);
      },
      confirmation === 'reject'
        ? 'transferRejectionSaved'
        : confirmation === 'deliver'
          ? 'transferDeliverySaved'
          : 'transferReservationSaved',
    );
    const action = confirmation;
    setConfirmation(null);
    if (result) {
      if (action === 'reserve') setStep(1);
      else onClose();
    }
  };
  const print = () => {
    setFailed('');
    try {
      printDocument(
        mode === 'register' ? (
          <TransferRequestDocument request={request} t={t} print />
        ) : (
          <TransferCertificate request={request} t={t} print />
        ),
        t(mode === 'register' ? 'transferRequestDocument' : 'transferCertificate'),
        () => setFailed('printFailed'),
      );
    } catch {
      setFailed('printFailed');
    }
  };
  const candidates = units.filter((unit) => candidateForRequest(unit, request));
  const filtered = candidates.filter(
    (unit) =>
      (!component || unit.componentType === component) &&
      normalizeSearch(`${unit.id} ${unit.bloodGroup} ${unit.component}`).includes(normalizeSearch(search)),
  );
  return (
    <>
      <ProcessingModal
        title={`${t(mode === 'register' ? (outgoing ? 'transferRegisterOutgoing' : 'transferRegisterReceived') : mode === 'attend' ? 'transferAttend' : 'transferDeliver')} — ${request.data.office || t('transferNew')}`}
        steps={steps}
        step={step}
        completed={steps.slice(0, step)}
        finalized={readonly}
        saving={saving}
        errors={errors}
        failed={failed}
        saveErrorText={t('transferSaveFailed')}
        onClose={onClose}
        closeDisabled={!!confirmation}
        onSaveBeforeExit={saveDraft}
        onAdvance={() => {
          void advance();
        }}
        onPrevious={() => {
          setStep(0);
          setErrors([]);
        }}
        previousDisabled={readonly}
        advanceLabel={t(
          mode === 'register' && step === 1
            ? outgoing
              ? 'transferGenerateRequest'
              : 'transferConfirmReceived'
            : mode === 'deliver' && step === 1
              ? 'transferDeliverUnits'
              : 'next',
        )}
        advanceDisabled={mode === 'attend' && !readonly && !completeTransferSelection(request, units)}
        footerClassName={styles.printFooter}
        extraActions={
          <>
            {step === 1 && (
              <Button kind="ghost" renderIcon={Printer} disabled={saving} onClick={print}>
                {t(mode === 'register' ? 'transferPrintRequest' : 'transferPrintCertificate')}
              </Button>
            )}
            {mode !== 'register' && (
              <Button kind="danger--tertiary" disabled={saving} onClick={() => setConfirmation('reject')}>
                {t('transferReject')}
              </Button>
            )}
          </>
        }
        t={t}
      >
        <div className={styles.responsive}>
          <FractionationContent>
            {mode === 'register' ? (
              step === 0 ? (
                <TransferRequestFields
                  data={request.data}
                  outgoing={outgoing}
                  busy={saving}
                  onChange={(data) => change({ data })}
                  t={t}
                />
              ) : (
                <TransferRequestDocument request={request} t={t} />
              )
            ) : mode === 'attend' && step === 0 ? (
              <>
                <TransferSummary data={request.data} t={t} />
                <div className={shared.fields}>
                  <TextInput
                    id="transfer-certificate-office"
                    labelText={t('transferCertificateOffice')}
                    value={request.preparation.certificateOffice}
                    disabled={saving}
                    onChange={(event) =>
                      change({ preparation: { ...request.preparation, certificateOffice: event.target.value } })
                    }
                  />
                  <TextInput
                    id="transfer-responsible"
                    labelText={t('transferResponsible')}
                    value={request.preparation.responsible}
                    disabled={saving}
                    onChange={(event) =>
                      change({ preparation: { ...request.preparation, responsible: event.target.value } })
                    }
                  />
                </div>
                <Checkbox
                  id="transfer-evaluation"
                  labelText={t('transferEvaluationCheck')}
                  checked={request.preparation.evaluationVerified}
                  disabled={saving}
                  onChange={(_event, { checked }) =>
                    change({ preparation: { ...request.preparation, evaluationVerified: checked } })
                  }
                />
                <p className={styles.notice}>{t('transferCandidateHelp')}</p>
                <p>
                  {t('transferRequirement')}:{' '}
                  {request.data.items
                    .map(
                      (item) =>
                        `${item.quantity} × ${t(componentDefinitions[item.component].key)} (${item.bloodGroup})`,
                    )
                    .join('; ')}
                </p>
                <div className={styles.toolbar}>
                  <Search
                    id="transfer-unit-search"
                    labelText={t('transferSearchUnits')}
                    placeholder={t('transferSearchUnits')}
                    value={search}
                    closeButtonLabelText={t('clearSearch')}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  <Select
                    id="transfer-unit-component"
                    labelText={t('fractionationComponent')}
                    value={component}
                    onChange={(event) => setComponent(event.target.value)}
                  >
                    <SelectItem value="" text={t('transferAllComponents')} />
                    {Object.entries(componentDefinitions).map(([code, def]) => (
                      <SelectItem key={code} value={code} text={t(def.key)} />
                    ))}
                  </Select>
                </div>
                <ProcessingTable
                  title={t('transferCandidateUnits')}
                  columns={[
                    'transferSelect',
                    'inventoryUnitNumber',
                    'fractionationComponent',
                    'bloodGroup',
                    'transferSeal',
                    'inventoryExpiration',
                  ]}
                  rows={filtered.map((unit) => ({
                    id: unit.id,
                    cells: [
                      <Checkbox
                        key="select"
                        id={`transfer-select-${unit.id}`}
                        labelText={`${t('transferSelect')} ${unit.id}`}
                        hideLabel
                        disabled={saving}
                        checked={request.preparation.unitIds.includes(unit.id)}
                        onChange={(_event, { checked }) =>
                          change({
                            preparation: {
                              ...request.preparation,
                              unitIds: checked
                                ? [...request.preparation.unitIds, unit.id]
                                : request.preparation.unitIds.filter((id) => id !== unit.id),
                            },
                          })
                        }
                      />,
                      unit.id,
                      unit.componentType ? t(componentDefinitions[unit.componentType].key) : unit.component,
                      unit.bloodGroup,
                      unit.sealId ? `${unit.sealId}/${unit.id}` : '—',
                      inventoryDisplayDate(unit.expiresAt),
                    ],
                  }))}
                  loading={false}
                  failed={false}
                  reload={onSaved}
                  emptyHelp={t('transferNoCandidates')}
                  filterKey={`${search}:${component}`}
                  t={t}
                />
                <p className={styles.notice}>
                  {t('transferSelected')}: {request.preparation.unitIds.length} /{' '}
                  {request.data.items.reduce((sum, item) => sum + item.quantity, 0)}
                </p>
              </>
            ) : mode === 'deliver' && step === 0 ? (
              <>
                <TransferSummary data={request.data} t={t} />
                <div className={shared.fields}>
                  <TextInput
                    id="transfer-collector-name"
                    labelText={t('transferCollectorName')}
                    disabled={saving}
                    value={request.delivery.collectorName}
                    onChange={(event) =>
                      change({ delivery: { ...request.delivery, collectorName: event.target.value } })
                    }
                  />
                  <TextInput
                    id="transfer-collector-document"
                    labelText={t('transferCollectorDocument')}
                    disabled={saving}
                    value={request.delivery.collectorDocument}
                    onChange={(event) =>
                      change({ delivery: { ...request.delivery, collectorDocument: event.target.value } })
                    }
                  />
                  <TextInput
                    id="transfer-delivered-by"
                    labelText={t('transferDeliveredBy')}
                    disabled={saving}
                    value={request.delivery.deliveredBy}
                    onChange={(event) => change({ delivery: { ...request.delivery, deliveredBy: event.target.value } })}
                  />
                </div>
                <p className={styles.notice}>{t('transferAutomaticDate')}</p>
                <Checkbox
                  id="transfer-transport-check"
                  labelText={t('transferTransportCheck')}
                  disabled={saving}
                  checked={request.delivery.transportVerified}
                  onChange={(_event, { checked }) =>
                    change({ delivery: { ...request.delivery, transportVerified: checked } })
                  }
                />
              </>
            ) : (
              <TransferCertificate request={request} t={t} />
            )}
          </FractionationContent>
        </div>
      </ProcessingModal>
      {confirmation && (
        <ComposedModal
          open
          size="sm"
          preventCloseOnClickOutside
          aria-label={t(
            confirmation === 'reserve'
              ? 'transferReserveTitle'
              : confirmation === 'deliver'
                ? 'transferDeliveryTitle'
                : 'transferRejectTitle',
          )}
          onClose={() => {
            if (!inFlight.current) setConfirmation(null);
            return false;
          }}
        >
          <ModalHeader
            title={t(
              confirmation === 'reserve'
                ? 'transferReserveTitle'
                : confirmation === 'deliver'
                  ? 'transferDeliveryTitle'
                  : 'transferRejectTitle',
            )}
            iconDescription={t('close')}
            closeModal={() => {
              if (!inFlight.current) setConfirmation(null);
            }}
          />
          <ModalBody>
            {confirmation === 'reject' ? (
              <TextArea
                id="transfer-rejection-reason"
                labelText={t('transferRejectionReason')}
                disabled={saving}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            ) : (
              <p>{t(confirmation === 'reserve' ? 'transferReserveWarning' : 'transferDeliverWarning')}</p>
            )}
          </ModalBody>
          <ModalFooter>
            <Button kind="secondary" disabled={saving} onClick={() => setConfirmation(null)}>
              {t('keepEditing')}
            </Button>
            <Button
              kind={confirmation === 'reject' ? 'danger' : 'primary'}
              disabled={saving || (confirmation === 'reject' && !reason.trim())}
              onClick={() => {
                void confirm();
              }}
            >
              {t('transferConfirm')}
            </Button>
          </ModalFooter>
        </ComposedModal>
      )}
    </>
  );
}
