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
import { Add } from '@carbon/react/icons';
import { useConfig, usePatient, userHasAccess, useSession, useVisit } from '@openmrs/esm-framework';
import { type FormEvent, useCallback, useId, useRef, useState } from 'react';
import type { BloodBankConfig } from '../../config-schema';
import { useProcessingData } from '../../shared/processing-page.component';
import type { ComponentType } from '../laboratory/fractionation/fractionation.types';
import { componentDefinitions } from '../laboratory/fractionation/fractionation-rules';
import { Fr08Document, PrintFr08 } from './fr08-document.component';
import { transfusionBloodGroupLabel } from './transfusion-blood-group';
import {
  configuredTransfusionOrders,
  createTransfusionOrder,
  type Fr08Fields,
  type IssuedTransfusionOrder,
  loadOrderRecipient,
  type TransfusionOrderConfig,
  transfusionOrdersChanged,
  validFr08,
} from './transfusion-order.resource';
import styles from './transfusions.scss';
import { useTransfusionsTranslation } from './use-transfusions-translation';

const authorPrivileges = [
  'app:hoja.clinica.canastaOrdenes',
  'app:hoja.clinica.ordenes.editar',
  'Get Orders',
  'Add Orders',
  'Add Encounters',
];
const bloodGroups = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
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
const initialFields: Fr08Fields = {
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
  maternalIncompatibility: '',
  items: [],
};

export default function TransfusionOrderAction({ canCreateOrders }: { canCreateOrders?: boolean }) {
  const { patientUuid } = usePatient();
  const { enabled, transfusionOrders } = useConfig<BloodBankConfig>();
  const { authenticated, user } = useSession();
  const [open, setOpen] = useState(false);
  const t = useTransfusionsTranslation();
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
      <Button kind="ghost" size="sm" renderIcon={Add} disabled={!canCreateOrders} onClick={() => setOpen(true)}>
        {t('fr08New')}
      </Button>
      {open && canCreateOrders && (
        <TransfusionOrderForm
          key={patientUuid}
          config={transfusionOrders}
          patientUuid={patientUuid}
          onClose={() => setOpen(false)}
        />
      )}
    </>
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
  const session = useSession();
  const { activeVisit, currentVisit, currentVisitIsRetrospective } = useVisit(patientUuid);
  const load = useCallback(() => loadOrderRecipient(config, patientUuid), [config, patientUuid]);
  const { data: recipient, loading, failed: recipientFailed } = useProcessingData(load);
  const [fields, setFields] = useState(initialFields);
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [issued, setIssued] = useState<IssuedTransfusionOrder>();
  const inFlight = useRef(false);
  const submissionId = useRef<string>();
  const formId = useId();
  const provider = session.currentProvider;
  const providerName = session.user?.person?.display;
  const visit =
    activeVisit?.patient?.uuid === patientUuid &&
    (!currentVisitIsRetrospective || currentVisit?.uuid === activeVisit.uuid)
      ? activeVisit
      : null;
  const update = <K extends keyof Fr08Fields>(key: K, value: Fr08Fields[K]) =>
    setFields((current) => ({ ...current, [key]: value }));

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
    setAttempted(true);
    if (!validFr08(fields)) return;
    setFailed(false);
    setSaving(true);
    inFlight.current = true;
    try {
      submissionId.current ??= `FR08-${crypto.randomUUID()}`;
      const order = await createTransfusionOrder(
        config,
        {
          recipient,
          visitUuid: visit.uuid,
          locationUuid: visit.location.uuid,
          providerUuid: provider.uuid,
          registration: provider.identifier || '',
        },
        fields,
        submissionId.current,
      );
      setIssued(order);
      window.dispatchEvent(new Event(transfusionOrdersChanged));
    } catch {
      setFailed(true);
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };
  const input = (key: Exclude<keyof Fr08Fields, 'items' | 'priorTransfusions' | 'priorReactions'>, label: string) => (
    <TextInput
      key={key}
      id={`${formId}-${key}`}
      labelText={t(label)}
      maxLength={100}
      value={fields[key]}
      onChange={(event) => update(key, event.target.value)}
    />
  );
  const ready = Boolean(recipient && visit?.location?.uuid && provider?.uuid);
  return (
    <ComposedModal
      open
      size="lg"
      aria-label={t('fr08Title')}
      className={styles.modal}
      onClose={() => {
        if (!saving) onClose();
      }}
    >
      <ModalHeader title={t('fr08Title')} closeModal={saving ? undefined : onClose} />
      <ModalBody>
        {issued ? (
          <Fr08Document order={issued.order} t={t} />
        ) : (
          <>
            {recipientFailed && <InlineNotification kind="error" hideCloseButton title={t('fr08RecipientFailed')} />}
            {!visit && !loading && <InlineNotification kind="warning" hideCloseButton title={t('fr08ActiveVisit')} />}
            {!provider?.uuid && <InlineNotification kind="warning" hideCloseButton title={t('fr08ProviderRequired')} />}
            {failed && <InlineNotification kind="error" hideCloseButton title={t('fr08SaveFailed')} />}
            {attempted && !validFr08(fields) && (
              <InlineNotification kind="warning" hideCloseButton title={t('fr08Required')} />
            )}
            <form id={formId} onSubmit={submit}>
              <fieldset disabled={saving || !ready} className={styles.fr08Form}>
                <section>
                  <h3>{t('fr08Recipient')}</h3>
                  <div className={styles.fr08Grid}>
                    <TextInput
                      id={`${formId}-name`}
                      labelText={t('txSamplePatientName')}
                      value={recipient?.name ?? ''}
                      readOnly
                    />
                    <TextInput
                      id={`${formId}-history`}
                      labelText={t('txSampleHistoryNumber')}
                      value={recipient?.historyNumber ?? ''}
                      readOnly
                    />
                    <TextInput id={`${formId}-age`} labelText={t('txAge')} value={recipient?.age ?? ''} readOnly />
                    <TextInput
                      id={`${formId}-sex`}
                      labelText={t('txSex')}
                      value={recipient ? t(recipient.sex === 'F' ? 'female' : 'male') : ''}
                      readOnly
                    />
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
                    {input('service', 'txService')}
                    {input('ward', 'txWard')}
                    {input('bed', 'txBed')}
                  </div>
                </section>
                <section>
                  <h3>{t('fr08Clinical')}</h3>
                  <div className={styles.fr08Grid}>
                    {(['priorTransfusions', 'priorReactions'] as const).map((key) => (
                      <Select
                        key={key}
                        id={`${formId}-${key}`}
                        labelText={t(key === 'priorTransfusions' ? 'txPriorTransfusions' : 'txPriorReactions')}
                        value={fields[key]}
                        onChange={(event) => update(key, event.target.value as Fr08Fields[typeof key])}
                      >
                        {(['unknown', 'yes', 'no'] as const).map((value) => (
                          <SelectItem key={value} value={value} text={t(`tx${value}`)} />
                        ))}
                      </Select>
                    ))}
                    {recipient?.sex === 'F' && (
                      <>
                        {input('pregnancies', 'txPregnancies')}
                        {input('abortions', 'txAbortions')}
                        {input('maternalIncompatibility', 'txMaternal')}
                      </>
                    )}
                    {input('hemoglobin', 'txHemoglobin')}
                    {input('hematocrit', 'txHematocrit')}
                    {input('platelets', 'txPlateletCount')}
                  </div>
                  <TextArea
                    id={`${formId}-diagnosis`}
                    labelText={t('txDiagnosis')}
                    value={fields.diagnosis}
                    maxLength={500}
                    rows={2}
                    onChange={(event) => update('diagnosis', event.target.value)}
                  />
                </section>
                <section>
                  <h3>{t('txRequirement')}</h3>
                  <div className={styles.fr08Grid}>
                    {components.map((component) => (
                      <TextInput
                        key={component}
                        id={`${formId}-${component}`}
                        type="number"
                        min={0}
                        max={99}
                        step={1}
                        labelText={t(componentDefinitions[component].key)}
                        value={fields.items.find((item) => item.component === component)?.quantity ?? ''}
                        onChange={(event) => {
                          const quantity = Number(event.target.value);
                          const others = fields.items.filter((item) => item.component !== component);
                          update('items', quantity === 0 ? others : [...others, { component, quantity }]);
                        }}
                      />
                    ))}
                  </div>
                </section>
                <div className={styles.fr08Grid}>
                  <TextInput id={`${formId}-priority`} labelText={t('txPriority')} value={t('txScheduled')} readOnly />
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
        {issued && <PrintFr08 order={issued.order} t={t} />}
        <Button kind="secondary" disabled={saving} onClick={onClose}>
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
