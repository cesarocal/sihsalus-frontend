import {
  Button,
  ComposedModal,
  InlineNotification,
  ModalBody,
  ModalFooter,
  ModalHeader,
  NumberInput,
  RadioButton,
  RadioButtonGroup,
  Select,
  SelectItem,
  TextInput,
  Tile,
} from '@carbon/react';
import { Add, Close, RainDrop } from '@carbon/react/icons';
import {
  AddIcon,
  ChevronDownIcon,
  getConfig,
  showSnackbar,
  useConfig,
  usePatient,
  userHasAccess,
  useSession,
  useVisit,
} from '@openmrs/esm-framework';
import { type FormEvent, useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { BloodBankConfig } from '../../config-schema';
import { useProcessingData } from '../../shared/processing-page.component';
import { PaperConsentEditor, useConsentTranslation } from '../consents/paper-consent.component';
import { recipientConsentSubject } from '../consents/paper-consent.resource';
import type { ComponentType } from '../laboratory/fractionation/fractionation.types';
import { componentDefinitions } from '../laboratory/fractionation/fractionation-rules';
import { localDateTime } from '../laboratory/screening/screening-rules';
import { listFr08Services } from './fr08-catalogs.resource';
import { Fr08DiagnosisPicker } from './fr08-diagnosis-picker.component';
import { Fr08Document, formatFr08Date, PrintFr08 } from './fr08-document.component';
import { transfusionBloodGroupLabel } from './transfusion-blood-group';
import {
  configuredTransfusionOrders,
  createTransfusionOrder,
  type Fr08Fields,
  fr08ScheduleFromInputs,
  type IssuedTransfusionOrder,
  listIssuedTransfusionOrders,
  loadOrderRecipient,
  type TransfusionOrderConfig,
  transfusionOrdersChanged,
  validFr08,
  validFr08ClinicalValues,
  validFr08Schedule,
} from './transfusion-order.resource';
import styles from './transfusions.scss';
import type { TransfusionPriority } from './transfusions.types';
import { priorityKeys } from './transfusions-rules';
import { useTransfusionsTranslation } from './use-transfusions-translation';

const authorPrivileges = [
  'app:hoja.clinica.canastaOrdenes',
  'app:hoja.clinica.ordenes.editar',
  'Get Orders',
  'Add Orders',
  'Add Encounters',
];
const patientOrdersModule = '@sihsalus/esm-patient-orders-app';
const bloodGroups = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
const historyAnswers = ['yes', 'no', 'unknown'] as const;
type RequirementRow = { id: number; component: ComponentType | ''; quantity: string };
const emptyRequirement = { component: '', quantity: '1' } as const;
const components: ComponentType[] = [
  'wholeBlood',
  'redCells',
  'freshFrozenPlasma',
  'cryoprecipitate',
  'liquidPlasma',
  'platelets',
  'pediatricFraction',
  'lowVolumeRedCells',
  'plateletRichPlasma',
  'plasma24',
  'cryoReducedPlasma',
];
type DemographicAndClinicalFields = Omit<Fr08Fields, 'items' | 'scheduledDate'>;
const initialFields: DemographicAndClinicalFields = {
  priority: 'scheduled',
  bloodGroup: '',
  service: '',
  ward: '',
  bed: '',
  diagnosis: '',
  hemoglobin: '',
  hematocrit: '',
  platelets: '',
  priorTransfusions: 'unknown',
  priorReactions: 'unknown',
  pregnancies: '',
  abortions: '',
  maternalIncompatibility: 'unknown',
};

export default function TransfusionOrderAction({ canCreateOrders }: { canCreateOrders?: boolean }) {
  const { patientUuid } = usePatient();
  const { enabled, transfusionOrders } = useConfig<BloodBankConfig>();
  const { authenticated, user } = useSession();
  const [requestPatientUuid, setRequestPatientUuid] = useState<string>();
  const [consentPatientUuid, setConsentPatientUuid] = useState<string>();
  const addButton = useRef<HTMLButtonElement>(null);
  const t = useTransfusionsTranslation();
  const consentText = useConsentTranslation();
  if (
    !enabled ||
    !patientUuid ||
    !configuredTransfusionOrders(transfusionOrders) ||
    !authenticated ||
    !userHasAccess(authorPrivileges, user)
  )
    return null;

  return (
    <>
      {/* FR08 is issued in the form itself, so there are no transfusion drafts in the basket. */}
      <Tile className={styles.fr08OrderTile}>
        <div className={styles.fr08OrderIdentity}>
          <RainDrop size={24} aria-hidden="true" />
          <h4 className={styles.fr08OrderHeading}>{t('fr08OrderType')} (0)</h4>
        </div>
        <div className={styles.fr08OrderActions}>
          <Button
            ref={addButton}
            className={styles.fr08OrderAction}
            kind="ghost"
            size="sm"
            renderIcon={(props) => <AddIcon size={16} {...props} />}
            aria-label={t('fr08AddOrder')}
            disabled={!canCreateOrders}
            onClick={() => setRequestPatientUuid(patientUuid)}
          >
            {t('fr08Add')}
          </Button>
          <Button
            className={styles.fr08OrderAction}
            hasIconOnly
            kind="ghost"
            renderIcon={(props) => <ChevronDownIcon size={16} {...props} />}
            iconDescription={consentText('openRecipient')}
            onClick={() => setConsentPatientUuid(patientUuid)}
          />
        </div>
      </Tile>
      {canCreateOrders &&
        requestPatientUuid === patientUuid &&
        createPortal(
          <TransfusionOrderForm
            key={patientUuid}
            config={transfusionOrders}
            patientUuid={patientUuid}
            onClose={() => {
              setRequestPatientUuid(undefined);
              requestAnimationFrame(() => addButton.current?.focus());
            }}
          />,
          document.body,
        )}
      {consentPatientUuid === patientUuid &&
        createPortal(
          <ExistingOrderConsent
            key={patientUuid}
            config={transfusionOrders}
            patientUuid={patientUuid}
            onClose={() => setConsentPatientUuid(undefined)}
          />,
          document.body,
        )}
    </>
  );
}

function ExistingOrderConsent({
  config,
  patientUuid,
  onClose,
}: {
  config: TransfusionOrderConfig;
  patientUuid: string;
  onClose: () => void;
}) {
  const t = useConsentTranslation();
  const load = useCallback(() => listIssuedTransfusionOrders(config, patientUuid), [config, patientUuid]);
  const { data, loading, failed, reload } = useProcessingData(load);
  const [id, setId] = useState('');
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  const order = data?.find((entry) => !entry.stopped && entry.order.id === id)?.order;
  return (
    <ComposedModal
      open
      size="lg"
      className={styles.fr08Modal}
      preventCloseOnClickOutside
      onClose={() => {
        if (!inFlight.current) onClose();
      }}
    >
      <ModalHeader title={t('openRecipient')} iconDescription={t('close')} />
      <ModalBody className={styles.fr08ModalBody}>
        {failed ? (
          <>
            <InlineNotification hideCloseButton kind="error" title={t('readFailed')} />
            <Button kind="ghost" size="sm" onClick={reload}>
              {t('retry')}
            </Button>
          </>
        ) : (
          <Select
            id="fr12-order"
            labelText={t('requestNumber')}
            value={id}
            disabled={saving || loading}
            onChange={(event) => setId(event.target.value)}
          >
            <SelectItem
              value=""
              text={t(loading ? 'loading' : data?.some((entry) => !entry.stopped) ? 'selectRequest' : 'noRequest')}
              disabled
            />
            {data
              ?.filter((entry) => !entry.stopped)
              .map(({ order }) => (
                <SelectItem key={order.id} value={order.id} text={order.number} />
              ))}
          </Select>
        )}
        {order && !failed && (
          <PaperConsentEditor
            key={id}
            subject={recipientConsentSubject(order)}
            onSaving={(value) => {
              inFlight.current = value;
              setSaving(value);
            }}
          />
        )}
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" disabled={saving} onClick={onClose}>
          {t('close')}
        </Button>
      </ModalFooter>
    </ComposedModal>
  );
}

function TransfusionOrderForm({
  config,
  patientUuid,
  onClose,
}: {
  config: TransfusionOrderConfig;
  patientUuid: string;
  onClose: () => void;
}) {
  const t = useTransfusionsTranslation();
  const consentText = useConsentTranslation();
  const session = useSession();
  const { activeVisit, currentVisit, currentVisitIsRetrospective } = useVisit(patientUuid);
  const load = useCallback(() => loadOrderRecipient(config, patientUuid), [config, patientUuid]);
  const { data: recipient, loading, failed: recipientFailed } = useProcessingData(load);
  const services = useProcessingData(listFr08Services);
  const [fields, setFields] = useState(initialFields);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [requirements, setRequirements] = useState<RequirementRow[]>([{ id: 0, ...emptyRequirement }]);
  const nextRow = useRef(1);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [editingConsent, setEditingConsent] = useState(false);
  const [savingConsent, setSavingConsent] = useState(false);
  const consentInFlight = useRef(false);
  const [issued, setIssued] = useState<IssuedTransfusionOrder>();
  const inFlight = useRef(false);
  const submissionId = useRef<string>();
  const modalBody = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (editingConsent && issued && modalBody.current) modalBody.current.scrollTop = 0;
  }, [editingConsent, issued]);
  const formId = useId();
  const provider = session.currentProvider;
  const providerName = session.user?.person?.display;
  const visit =
    activeVisit?.patient?.uuid === patientUuid &&
    (!currentVisitIsRetrospective || currentVisit?.uuid === activeVisit.uuid)
      ? activeVisit
      : null;
  const update = <K extends keyof DemographicAndClinicalFields>(key: K, value: DemographicAndClinicalFields[K]) =>
    setFields((current) => ({ ...current, [key]: value }));
  const updateRequirement = (id: number, patch: Partial<Omit<RequirementRow, 'id'>>) =>
    setRequirements((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  const enteredFields: Fr08Fields = {
    ...fields,
    maternalIncompatibility: recipient?.sex === 'F' ? fields.maternalIncompatibility : '',
    scheduledDate: fields.priority === 'scheduled' ? fr08ScheduleFromInputs(scheduledDate, scheduledTime) : undefined,
    items: requirements.flatMap(({ component, quantity }) =>
      component ? [{ component, quantity: Number(quantity) }] : [],
    ),
  };
  const completeDetails =
    !services.failed &&
    services.data?.some((service) => service.uuid === fields.serviceUuid) &&
    fields.diagnosisConceptUuid &&
    requirements.every((row) => row.component) &&
    validFr08(enteredFields) &&
    validFr08ClinicalValues(enteredFields);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (
      issued ||
      inFlight.current ||
      !recipient ||
      recipient.uuid !== patientUuid ||
      !visit?.location?.uuid ||
      !provider?.uuid ||
      !session.authenticated ||
      !userHasAccess(authorPrivileges, session.user)
    )
      return;
    if (!completeDetails || !validFr08Schedule(enteredFields)) {
      showSnackbar({
        title: t(completeDetails ? 'fr08FutureScheduleRequired' : 'fr08Required'),
        kind: 'warning',
        autoClose: true,
      });
      return;
    }
    setFailed(false);
    setSaving(true);
    inFlight.current = true;
    try {
      submissionId.current ??= `FR08-${crypto.randomUUID()}`;
      const ordersConfig = await getConfig<{ careSettingUuid?: string }>(patientOrdersModule);
      const order = await createTransfusionOrder(
        { ...config, careSettingUuid: ordersConfig.careSettingUuid || config.careSettingUuid },
        {
          recipient,
          visitUuid: visit.uuid,
          locationUuid: visit.location.uuid,
          providerUuid: provider.uuid,
          registration: provider.identifier || '',
        },
        enteredFields,
        submissionId.current,
      );
      setIssued(order);
      setEditingConsent(true);
      window.dispatchEvent(new Event(transfusionOrdersChanged));
    } catch {
      setFailed(true);
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };
  const input = (key: 'ward' | 'bed', label: string) => (
    <TextInput
      key={key}
      id={`${formId}-${key}`}
      labelText={t(label)}
      maxLength={100}
      value={fields[key]}
      onChange={(event) => update(key, event.target.value)}
    />
  );
  const numericInput = (
    key: 'pregnancies' | 'abortions' | 'hemoglobin' | 'hematocrit' | 'platelets',
    label: string,
    decimal = false,
  ) => (
    <TextInput
      id={`${formId}-${key}`}
      labelText={t(label)}
      inputMode={decimal ? 'decimal' : 'numeric'}
      maxLength={12}
      value={fields[key]}
      onChange={(event) => {
        const value = event.target.value;
        if ((decimal ? /^\d*[.,]?\d*$/ : /^\d*$/).test(value)) update(key, value);
      }}
    />
  );
  const ready = Boolean(recipient && visit?.location?.uuid && provider?.uuid);
  return (
    <ComposedModal
      open
      size="lg"
      aria-label={t('fr08Title')}
      className={styles.fr08Modal}
      containerClassName={styles.fr08ModalContainer}
      preventCloseOnClickOutside
      onBlurCapture={(event) => {
        if (event.relatedTarget instanceof Node && modalBody.current?.contains(event.relatedTarget))
          event.stopPropagation();
      }}
      onClose={() => {
        if (inFlight.current || consentInFlight.current) return false;
        onClose();
      }}
    >
      <ModalHeader
        title={editingConsent && issued ? `${consentText('openRecipient')} · ${issued.order.number}` : t('fr08Title')}
        iconDescription={t('close')}
      />
      <ModalBody ref={modalBody} className={styles.fr08ModalBody} aria-label={t('fr08Title')} hasScrollingContent>
        {issued && editingConsent ? (
          <PaperConsentEditor
            subject={recipientConsentSubject(issued.order)}
            onSaving={(value) => {
              consentInFlight.current = value;
              setSavingConsent(value);
            }}
          />
        ) : issued ? (
          <Fr08Document order={issued.order} t={t} />
        ) : (
          <>
            {recipientFailed && <InlineNotification kind="error" hideCloseButton title={t('fr08RecipientFailed')} />}
            {!visit && !loading && <InlineNotification kind="warning" hideCloseButton title={t('fr08ActiveVisit')} />}
            {!provider?.uuid && <InlineNotification kind="warning" hideCloseButton title={t('fr08ProviderRequired')} />}
            {failed && <InlineNotification kind="error" hideCloseButton title={t('fr08SaveFailed')} />}
            <form id={formId} onSubmit={submit} noValidate>
              <fieldset disabled={saving || !ready} className={styles.fr08Form}>
                <TextInput
                  className={styles.fr08DateField}
                  id={`${formId}-date`}
                  labelText={t('fr08Date')}
                  value={formatFr08Date()}
                  readOnly
                />
                <section>
                  <h3>{t('fr08Recipient')}</h3>
                  <div className={styles.fr08ClinicalFields}>
                    <div className={styles.fr08IdentityRow}>
                      <TextInput
                        id={`${formId}-name`}
                        labelText={t('fr08FullName')}
                        value={recipient?.name ?? ''}
                        readOnly
                      />
                      <TextInput
                        id={`${formId}-history`}
                        labelText={t('txSampleHistoryNumber')}
                        value={recipient?.historyNumber ?? ''}
                        readOnly
                      />
                    </div>
                    <div className={styles.fr08TripleRow}>
                      <TextInput
                        id={`${formId}-sex`}
                        labelText={t('txSex')}
                        value={recipient ? t(recipient.sex === 'F' ? 'female' : 'male') : ''}
                        readOnly
                      />
                      <TextInput id={`${formId}-age`} labelText={t('txAge')} value={recipient?.age ?? ''} readOnly />
                      <Select
                        id={`${formId}-abo`}
                        labelText={t('txReportBloodGroup')}
                        value={fields.bloodGroup}
                        onChange={(event) => update('bloodGroup', event.target.value)}
                      >
                        <SelectItem value="" text={t('fr08Select')} disabled />
                        {bloodGroups.map((group) => (
                          <SelectItem key={group} value={group} text={transfusionBloodGroupLabel(group, t)} />
                        ))}
                      </Select>
                    </div>
                    <div className={styles.fr08TripleRow}>
                      <Select
                        id={`${formId}-service`}
                        labelText={t('txService')}
                        value={fields.serviceUuid ?? ''}
                        disabled={services.loading || services.failed || !services.data?.length}
                        onChange={(event) => {
                          const service = services.data?.find((item) => item.uuid === event.target.value);
                          setFields((current) => ({
                            ...current,
                            serviceUuid: service?.uuid,
                            service: service?.name ?? '',
                          }));
                        }}
                      >
                        <SelectItem
                          value=""
                          text={t(services.loading ? 'fr08LoadingServices' : 'fr08SelectService')}
                          disabled
                        />
                        {services.data?.map((service) => (
                          <SelectItem key={service.uuid} value={service.uuid} text={service.name} />
                        ))}
                      </Select>
                      {input('ward', 'txWard')}
                      {input('bed', 'txBed')}
                    </div>
                  </div>
                  {services.failed && (
                    <div className={styles.fr08CatalogError}>
                      <InlineNotification
                        className={styles.fr08Warning}
                        kind="error"
                        hideCloseButton
                        title={t('fr08ServicesFailed')}
                      />
                      <Button type="button" kind="ghost" size="sm" onClick={services.reload}>
                        {t('retry')}
                      </Button>
                    </div>
                  )}
                  {!services.loading && !services.failed && !services.data?.length && (
                    <p role="status">{t('fr08NoServices')}</p>
                  )}
                </section>
                <section>
                  <h3>{t('fr08Clinical')}</h3>
                  <div className={styles.fr08ClinicalFields}>
                    {(['priorTransfusions', 'priorReactions'] as const).map((key) => (
                      <div key={key} className={styles.fr08HistoryRow}>
                        <span id={`${formId}-${key}-label`} className={styles.fr08HistoryLabel}>
                          {t(key === 'priorTransfusions' ? 'txPriorTransfusions' : 'txPriorReactions')}
                        </span>
                        <RadioButtonGroup
                          name={`${formId}-${key}`}
                          aria-labelledby={`${formId}-${key}-label`}
                          valueSelected={fields[key]}
                          onChange={(value) => update(key, value as Fr08Fields[typeof key])}
                        >
                          {historyAnswers.map((value) => (
                            <RadioButton
                              key={value}
                              id={`${formId}-${key}-${value}`}
                              value={value}
                              labelText={t(`tx${value}`)}
                            />
                          ))}
                        </RadioButtonGroup>
                      </div>
                    ))}
                    {recipient?.sex === 'F' && (
                      <div className={styles.fr08TripleRow}>
                        {numericInput('pregnancies', 'txPregnancies')}
                        {numericInput('abortions', 'txAbortions')}
                        <Select
                          id={`${formId}-maternal`}
                          labelText={t('txMaternal')}
                          value={fields.maternalIncompatibility}
                          onChange={(event) => update('maternalIncompatibility', event.target.value)}
                        >
                          {historyAnswers.map((value) => (
                            <SelectItem key={value} value={value} text={t(`tx${value}`)} />
                          ))}
                        </Select>
                      </div>
                    )}
                    <Fr08DiagnosisPicker
                      id={`${formId}-diagnosis`}
                      selected={
                        fields.diagnosisConceptUuid
                          ? {
                              uuid: fields.diagnosisConceptUuid,
                              name: fields.diagnosis,
                              code: fields.diagnosisCode,
                            }
                          : undefined
                      }
                      onChange={(diagnosis) =>
                        setFields((current) => ({
                          ...current,
                          diagnosis: diagnosis?.name ?? '',
                          diagnosisConceptUuid: diagnosis?.uuid,
                          diagnosisCode: diagnosis?.code,
                        }))
                      }
                      t={t}
                    />
                    <div className={styles.fr08TripleRow}>
                      {numericInput('hemoglobin', 'txHemoglobin', true)}
                      {numericInput('hematocrit', 'txHematocrit', true)}
                      {numericInput('platelets', 'txPlateletCount')}
                    </div>
                  </div>
                </section>
                <section>
                  <h3>{t('txRequirement')}</h3>
                  <div className={styles.fr08Requirements}>
                    {requirements.map((row) => (
                      <div key={row.id} className={styles.fr08RequirementRow}>
                        <Select
                          id={`${formId}-component-${row.id}`}
                          labelText={t('fractionationComponent')}
                          value={row.component}
                          onChange={(event) =>
                            updateRequirement(row.id, { component: event.target.value as RequirementRow['component'] })
                          }
                        >
                          <SelectItem value="" text={t('fr08SelectComponent')} disabled />
                          {components
                            .filter(
                              (component) =>
                                component === row.component ||
                                !requirements.some((item) => item.component === component),
                            )
                            .map((component) => (
                              <SelectItem
                                key={component}
                                value={component}
                                text={t(componentDefinitions[component].key)}
                              />
                            ))}
                        </Select>
                        <NumberInput
                          id={`${formId}-units-${row.id}`}
                          label={t('fr08Quantity')}
                          min={1}
                          max={99}
                          step={1}
                          value={row.quantity}
                          allowEmpty
                          invalidText={t('fr08InvalidUnits')}
                          translateWithId={(key) =>
                            t(key === 'increment.number' ? 'fr08IncrementUnits' : 'fr08DecrementUnits')
                          }
                          onChange={(_event, { value }) => updateRequirement(row.id, { quantity: String(value) })}
                        />
                        {requirements.length > 1 && (
                          <Button
                            type="button"
                            hasIconOnly
                            kind="ghost"
                            iconDescription={t('fr08RemoveComponent')}
                            renderIcon={Close}
                            onClick={() => setRequirements((current) => current.filter((item) => item.id !== row.id))}
                          />
                        )}
                      </div>
                    ))}
                    <Button
                      type="button"
                      kind="ghost"
                      size="sm"
                      renderIcon={Add}
                      disabled={
                        requirements.length === components.length || requirements.some(({ component }) => !component)
                      }
                      onClick={() => {
                        const row = { id: nextRow.current++, ...emptyRequirement };
                        setRequirements((current) => [...current, row]);
                      }}
                    >
                      {t('fr08AddComponent')}
                    </Button>
                  </div>
                </section>
                <section>
                  <h3 id={`${formId}-priority-label`}>{t('txPriority')}</h3>
                  <RadioButtonGroup
                    className={styles.fr08PriorityOptions}
                    name={`${formId}-priority`}
                    aria-labelledby={`${formId}-priority-label`}
                    valueSelected={fields.priority}
                    onChange={(value) => update('priority', value as TransfusionPriority)}
                  >
                    {Object.entries(priorityKeys).map(([value, label]) => (
                      <RadioButton key={value} id={`${formId}-priority-${value}`} value={value} labelText={t(label)} />
                    ))}
                  </RadioButtonGroup>
                  {fields.priority === 'veryUrgent' && (
                    <p className={styles.fr08UrgentWarning}>{t('txUrgentAuthorizationHelp')}</p>
                  )}
                  {fields.priority === 'scheduled' && (
                    <div className={styles.fr08Schedule}>
                      <TextInput
                        id={`${formId}-scheduled-date`}
                        type="date"
                        labelText={t('fr08ScheduledDate')}
                        min={localDateTime().slice(0, 10)}
                        value={scheduledDate}
                        onChange={(event) => setScheduledDate(event.target.value)}
                      />
                      <TextInput
                        id={`${formId}-scheduled-time`}
                        type="time"
                        labelText={t('fr08ScheduledTime')}
                        value={scheduledTime}
                        onChange={(event) => setScheduledTime(event.target.value)}
                      />
                    </div>
                  )}
                </section>
                <div className={styles.fr08Grid}>
                  <TextInput
                    id={`${formId}-author`}
                    labelText={t('txDoctor')}
                    value={providerName ?? provider?.identifier ?? ''}
                    readOnly
                  />
                </div>
              </fieldset>
            </form>
          </>
        )}
      </ModalBody>
      <ModalFooter className={styles.fr08Footer}>
        {issued && !editingConsent && <PrintFr08 order={issued.order} t={t} />}
        {issued && (
          <Button
            type="button"
            kind="tertiary"
            disabled={savingConsent}
            onClick={() => setEditingConsent(!editingConsent)}
          >
            {editingConsent ? t('fr08Title') : consentText('openRecipient')}
          </Button>
        )}
        <Button kind="secondary" disabled={saving || savingConsent} onClick={onClose}>
          {t('close')}
        </Button>
        {!issued && (
          <Button kind="primary" type="submit" form={formId} disabled={!ready || saving}>
            {t('fr08Send')}
          </Button>
        )}
      </ModalFooter>
    </ComposedModal>
  );
}
