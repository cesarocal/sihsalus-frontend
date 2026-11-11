import {
  Button,
  Checkbox,
  InlineNotification,
  RadioButton,
  RadioButtonGroup,
  Select,
  SelectItem,
  TextInput,
} from '@carbon/react';
import { Printer } from '@carbon/react/icons';
import { useSession } from '@openmrs/esm-framework';
import { useCallback, useState } from 'react';
import type { CollectionApi } from '../../api/blood-bank-processing.api';
import { useApiData } from '../../api/use-api-data';
import { ProcessingModal } from '../../shared/processing-modal.component';
import type { ProcessingTranslate } from '../../shared/processing-page.component';
import { printDocument } from '../../shared/print-document';
import { notifySuccess } from '../../shared/notify-success';
import { bagLotExceedsLimit, bagLotTextContract, countUtf16Units } from '../../shared/text-field-contracts';
import { calculateReturnDate, today } from '../applicant-selection/selection-rules';
import styles from '../applicant-selection/selection.scss';
import { formatDonorDate } from '../donors/donor-utils';
import {
  CollectionIdentity,
  CollectionLabelDocument,
  collectionLabelPrintCss,
  donationCertificatePrintCss,
  DonationCertificateDocument,
} from './collection-documents.component';
import { validateCollection, validateCollectionDraft, validVolume } from './collection-rules';
import {
  collectionSteps,
  type CollectionConceptField,
  type CollectionLabel,
  type CollectionRecord,
  type DonationRegistry,
} from './collection.types';
import collectionStyles from './collection.scss';

const conceptUuidFields = {
  anticoagulant: 'anticoagulantConceptUuid',
  service: 'serviceConceptUuid',
} as const;

function useLabelConcepts(api: CollectionApi, field: CollectionConceptField, enabled: boolean) {
  const [attempt, setAttempt] = useState(0);
  const load = useCallback(() => api.listLabelConcepts(field), [api, field]);
  return { ...useApiData(enabled ? load : null, attempt), retry: () => setAttempt((current) => current + 1) };
}

export function CollectionWorkflow({
  initial,
  api,
  onClose,
  onSaved,
  t,
}: {
  initial: CollectionRecord;
  api: CollectionApi;
  onClose: () => void;
  onSaved: () => void;
  t: ProcessingTranslate;
}) {
  const [storedRecord, setRecord] = useState(initial);
  const { authenticated, user } = useSession();
  const operatorName = authenticated ? (user?.person?.display?.trim() ?? '') : '';
  const [step, setStep] = useState(initial.status === 'completed' ? 3 : Math.min(initial.completedSteps.length, 3));
  const [errors, setErrors] = useState<string[]>([]);
  const [failed, setFailed] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const stage = collectionSteps[step];
  const finalized = storedRecord.status === 'completed';
  const locked = finalized || storedRecord.completedSteps.includes(stage);
  const editingLabel = stage === 'label' && !locked;
  const editingRegistry = stage === 'registry' && !locked;
  const record = {
    ...storedRecord,
    label: editingLabel ? { ...storedRecord.label, collectedBy: operatorName } : storedRecord.label,
    registry: editingRegistry ? { ...storedRecord.registry, attendedBy: operatorName } : storedRecord.registry,
  };
  const anticoagulants = useLabelConcepts(api, 'anticoagulant', editingLabel);
  const services = useLabelConcepts(api, 'service', editingLabel);
  const validateLabelCatalogs = (missing: string[]) => {
    if (!editingLabel) return;
    if (!missing.includes('service') && !services.data?.some(({ uuid }) => uuid === record.label.serviceConceptUuid))
      missing.push('service');
    if (
      record.label.anticoagulantConceptUuid &&
      !anticoagulants.data?.some(({ uuid }) => uuid === record.label.anticoagulantConceptUuid)
    )
      missing.push('anticoagulantUnavailable');
  };
  const change = (next: CollectionRecord) => {
    setRecord(next);
    setDirty(true);
  };
  const save = async (advance = false) => {
    if (saving) return false;
    if (advance && locked) {
      setStep((value) => Math.min(value + 1, 3));
      return true;
    }
    const missing = advance ? validateCollection(record, stage) : validateCollectionDraft(record);
    if (advance) validateLabelCatalogs(missing);
    setErrors(missing);
    setFailed('');
    if (missing.length) return false;
    setSaving(true);
    try {
      const result = await api.saveCollection(record, advance ? stage : undefined);
      setRecord(result);
      setDirty(false);
      if (advance && stage === 'certificate') onSaved();
      else {
        const message = advance
          ? stage === 'label'
            ? 'collectionLabelSaved'
            : stage === 'volume'
              ? 'collectionVolumeSaved'
              : 'collectionRegistrySaved'
          : record.revision === 0
            ? 'collectionDraftCreated'
            : 'collectionDraftUpdated';
        notifySuccess(t(message));
        if (advance) setStep((value) => value + 1);
      }
      return true;
    } catch {
      setFailed('collectionSaveFailed');
      return false;
    } finally {
      setSaving(false);
    }
  };
  const print = (kind: 'unit' | 'sample' | 'certificate') => {
    const missing = validateCollection(record, kind === 'certificate' ? 'certificate' : 'label').filter(
      (key) => key !== 'observationsTooLong',
    );
    if (kind !== 'certificate') validateLabelCatalogs(missing);
    setErrors(missing);
    setFailed('');
    if (missing.length) return;
    try {
      printDocument(
        kind === 'certificate' ? (
          <DonationCertificateDocument record={record} t={t} />
        ) : (
          <CollectionLabelDocument record={record} t={t} sample={kind === 'sample'} print />
        ),
        t(kind === 'certificate' ? 'printCertificate' : kind === 'sample' ? 'printSample' : 'printUnit'),
        () => setFailed('printFailed'),
        kind === 'certificate' ? donationCertificatePrintCss : collectionLabelPrintCss,
      );
    } catch {
      setFailed('printFailed');
    }
  };
  const labelInput = (
    field: Exclude<
      keyof CollectionLabel,
      'leukocytesReduced' | 'anticoagulantConceptUuid' | 'serviceConceptUuid' | 'collectedBy' | 'plannedVolume'
    >,
  ) => (
    <TextInput
      key={field}
      id={`collection-${field}`}
      labelText={t(field)}
      value={record.label[field]}
      readOnly={locked}
      disabled={saving && !locked}
      invalid={errors.includes(field) || (field === 'preservative' && errors.includes('anticoagulantOrPreservative'))}
      invalidText={t(field === 'preservative' ? 'anticoagulantOrPreservative' : 'requiredFields')}
      onChange={(event) => change({ ...record, label: { ...record.label, [field]: event.target.value } })}
    />
  );
  const labelConcept = (field: CollectionConceptField) => {
    if (locked) return labelInput(field);
    const catalog = field === 'anticoagulant' ? anticoagulants : services;
    const uuidField = conceptUuidFields[field];
    const selected = record.label[uuidField] ?? '';
    const options = catalog.data ?? [];
    const unavailable = selected && !options.some(({ uuid }) => uuid === selected);
    const previousValue =
      !selected && record.label[field] ? `${t('collectionPreviousValue')} ${record.label[field]}` : '';
    const validationKey = field === 'service' ? 'service' : 'anticoagulantUnavailable';
    const status = catalog.isLoading
      ? 'collectionConceptsLoading'
      : catalog.error
        ? 'collectionConceptsFailed'
        : options.length
          ? ''
          : 'collectionConceptsEmpty';
    return (
      <div>
        <Select
          id={`collection-${field}`}
          labelText={t(field)}
          value={selected}
          disabled={saving || (options.length === 0 && !(field === 'anticoagulant' && selected))}
          invalid={errors.includes(validationKey)}
          invalidText={t(status || (field === 'service' ? 'requiredFields' : validationKey))}
          helperText={
            status || previousValue ? (
              <span role="status">
                {status && t(status)} {previousValue}
              </span>
            ) : undefined
          }
          onChange={(event) => {
            const concept = options.find(({ uuid }) => uuid === event.target.value);
            change({
              ...record,
              label: { ...record.label, [field]: concept?.display ?? '', [uuidField]: concept?.uuid ?? '' },
            });
            setErrors((current) =>
              current.filter(
                (key) => key !== validationKey && (field !== 'anticoagulant' || key !== 'anticoagulantOrPreservative'),
              ),
            );
          }}
        >
          <SelectItem value="" text={t('choose')} />
          {unavailable && <SelectItem disabled value={selected} text={record.label[field]} />}
          {options.map(({ uuid, display }) => (
            <SelectItem key={uuid} value={uuid} text={display} />
          ))}
        </Select>
        {!catalog.isLoading && (catalog.error || options.length === 0) && (
          <Button kind="ghost" size="sm" disabled={saving} onClick={catalog.retry}>
            {t('retry')}
          </Button>
        )}
      </div>
    );
  };
  const registryInput = (field: 'date' | 'bagLot' | 'attendedBy') => {
    const lot = field === 'bagLot';
    const overflow = lot && !locked && bagLotExceedsLimit(record.registry.bagLot);
    const counter = `${countUtf16Units(record.registry.bagLot)} / ${bagLotTextContract.maxUtf16Units}`;
    const currentDate = today();
    const isDateField = field === 'date';
    return (
      <TextInput
        key={field}
        id={`collection-${field}`}
        labelText={t(field === 'date' ? 'collectionDate' : field)}
        value={isDateField && locked ? formatDonorDate(record.registry.date) : record.registry[field]}
        type={isDateField && !locked ? 'date' : 'text'}
        min={isDateField ? record.application.admission.date : undefined}
        max={isDateField ? currentDate : undefined}
        readOnly={locked || field === 'attendedBy'}
        disabled={saving && !locked && field !== 'attendedBy'}
        helperText={lot && !locked ? <span aria-live="polite">{counter}</span> : undefined}
        invalid={
          overflow ||
          (isDateField && !locked && record.registry.date > currentDate) ||
          errors.includes(isDateField ? 'collectionDate' : field)
        }
        invalidText={
          lot ? (
            <span aria-live="polite">
              {t(overflow ? 'bagLotTooLong' : 'requiredFields')} {counter}
            </span>
          ) : (
            t(isDateField ? 'collectionDateRange' : 'requiredFields')
          )
        }
        onChange={(event) => {
          if (locked || field === 'attendedBy') return;
          change({
            ...record,
            registry: { ...record.registry, [field]: event.target.value },
            certificate:
              field === 'date'
                ? {
                    ...record.certificate,
                    resultsAvailableOn: calculateReturnDate(event.target.value, '10', 'days') ?? '',
                  }
                : record.certificate,
          });
        }}
      />
    );
  };
  const extras =
    step === 0 ? (
      <>
        <Button kind="ghost" renderIcon={Printer} disabled={saving} onClick={() => print('unit')}>
          {t('printUnit')}
        </Button>
        <Button kind="ghost" renderIcon={Printer} disabled={saving} onClick={() => print('sample')}>
          {t('printSample')}
        </Button>
      </>
    ) : step === 1 ? (
      <Button kind="ghost" disabled>
        {t('adverseReaction')}
      </Button>
    ) : step === 3 ? (
      <Button kind="ghost" renderIcon={Printer} disabled={saving} onClick={() => print('certificate')}>
        {t('printCertificate')}
      </Button>
    ) : null;
  return (
    <ProcessingModal
      title={t('collectionTitle')}
      steps={collectionSteps}
      step={step}
      completed={record.completedSteps}
      finalized={finalized}
      saving={saving}
      errors={errors}
      failed={failed}
      saveErrorText={t('collectionSaveFailed')}
      onClose={onClose}
      onDraft={() => save()}
      onSaveBeforeExit={async () => {
        if (!dirty && record.revision > 0) return 'unchanged';
        return (await save()) ? 'saved' : 'failed';
      }}
      onAdvance={() => {
        void save(true);
      }}
      onPrevious={() => {
        setStep((value) => value - 1);
        setErrors([]);
        setFailed('');
      }}
      advanceLabel={t(step === 3 ? 'certificateSave' : 'next')}
      advanceDisabled={step === 1 && !validVolume(record.extractedVolume)}
      extraActions={extras}
      t={t}
    >
      <CollectionIdentity record={record} t={t} />
      {step === 0 && (
        <>
          <p>{t('labelHelp')}</p>
          <div className={styles.fields}>
            {labelInput('component')}
            {labelConcept('anticoagulant')}
            {labelInput('preservative')}
            {labelInput('sedimentingAgent')}
            {labelConcept('service')}
            <TextInput
              id="collection-collectedBy"
              labelText={t('collectedBy')}
              value={record.label.collectedBy}
              readOnly
            />
            {locked ? (
              <TextInput
                id="collection-leukocytes"
                labelText={t('leukocytesReduced')}
                value={t(record.label.leukocytesReduced ? 'yes' : 'no')}
                readOnly
              />
            ) : (
              <Checkbox
                id="collection-leukocytes"
                labelText={t('leukocytesReduced')}
                checked={record.label.leukocytesReduced}
                disabled={saving}
                onChange={(_event, { checked }) =>
                  change({ ...record, label: { ...record.label, leukocytesReduced: checked } })
                }
              />
            )}
          </div>
          {record.application.admission.donationType === 'autologous' && (
            <>
              <InlineNotification
                hideCloseButton
                kind="info"
                title={t('autologous')}
                subtitle={t('autologousWarning')}
              />
              <div className={styles.fields}>
                {(['recipientName', 'recipientDocument', 'recipientService', 'recipientHistory'] as const).map(
                  (field) => labelInput(field),
                )}
              </div>
            </>
          )}
        </>
      )}
      {step === 1 && (
        <>
          <CollectionLabelDocument record={record} t={t} />
          <div className={styles.fields}>
            <TextInput
              id="collection-extractedVolume"
              type={locked ? 'text' : 'number'}
              min={0.01}
              max={999999.99}
              step={0.01}
              labelText={t('extractedVolume')}
              value={record.extractedVolume}
              readOnly={locked}
              disabled={saving && !locked}
              invalid={errors.includes('extractedVolume')}
              invalidText={t('requiredFields')}
              onChange={(event) => change({ ...record, extractedVolume: event.target.value })}
            />
          </div>
          <InlineNotification
            className={collectionStyles.quarantineNotice}
            hideCloseButton
            kind="warning"
            lowContrast
            title={t('quarantine')}
            subtitle={t('volumeHelp')}
          />
        </>
      )}
      {step === 2 && (
        <div className={styles.fields}>
          {(['date', 'bagLot', 'attendedBy'] as const).map(registryInput)}
          {locked ? (
            <>
              <TextInput
                id="collection-complications"
                labelText={t('complications')}
                value={record.registry.complications ? t(record.registry.complications) : '—'}
                readOnly
              />
              <TextInput
                id="collection-outcome"
                labelText={t('extractionStatus')}
                value={record.registry.extractionStatus ? t(record.registry.extractionStatus) : '—'}
                readOnly
              />
            </>
          ) : (
            <>
              <RadioButtonGroup
                name="collection-complications"
                legendText={t('complications')}
                valueSelected={record.registry.complications}
                disabled={saving}
                onChange={(value) =>
                  change({ ...record, registry: { ...record.registry, complications: value as 'yes' | 'no' } })
                }
              >
                <RadioButton id="collection-complications-no" value="no" labelText={t('no')} />
                <RadioButton id="collection-complications-yes" value="yes" labelText={t('yes')} />
              </RadioButtonGroup>
              <RadioButtonGroup
                name="collection-outcome"
                legendText={t('extractionStatus')}
                valueSelected={record.registry.extractionStatus}
                disabled={saving}
                onChange={(value) =>
                  change({
                    ...record,
                    registry: {
                      ...record.registry,
                      extractionStatus: value as DonationRegistry['extractionStatus'],
                    },
                  })
                }
              >
                <RadioButton id="collection-outcome-complete" value="complete" labelText={t('complete')} />
                <RadioButton id="collection-outcome-incomplete" value="incomplete" labelText={t('incomplete')} />
              </RadioButtonGroup>
            </>
          )}
        </div>
      )}
      {step === 3 && (
        <>
          <div className={styles.fields}>
            <TextInput
              id="certificate-date"
              type={locked ? 'text' : 'date'}
              labelText={t('resultsAvailableOn')}
              value={
                locked ? formatDonorDate(record.certificate.resultsAvailableOn) : record.certificate.resultsAvailableOn
              }
              readOnly={locked}
              disabled={saving && !locked}
              invalid={errors.includes('resultsAvailableOn')}
              invalidText={t('requiredFields')}
              onChange={(event) =>
                change({ ...record, certificate: { ...record.certificate, resultsAvailableOn: event.target.value } })
              }
            />
            {locked ? (
              <TextInput
                id="certificate-consent"
                labelText={t('emailConsent')}
                value={record.certificate.emailConsent ? t(record.certificate.emailConsent) : '—'}
                readOnly
              />
            ) : (
              <RadioButtonGroup
                name="certificate-consent"
                legendText={t('emailConsent')}
                valueSelected={record.certificate.emailConsent}
                disabled={saving}
                onChange={(value) =>
                  change({ ...record, certificate: { ...record.certificate, emailConsent: value as 'yes' | 'no' } })
                }
              >
                <RadioButton id="certificate-email-no" value="no" labelText={t('no')} />
                <RadioButton id="certificate-email-yes" value="yes" labelText={t('yes')} />
              </RadioButtonGroup>
            )}
            {record.certificate.emailConsent === 'yes' && (
              <TextInput
                id="certificate-email"
                type={locked ? 'text' : 'email'}
                labelText={t('email')}
                value={record.certificate.email}
                readOnly={locked}
                disabled={saving && !locked}
                invalid={errors.includes('email')}
                invalidText={t('requiredFields')}
                onChange={(event) =>
                  change({ ...record, certificate: { ...record.certificate, email: event.target.value } })
                }
              />
            )}
          </div>
          <DonationCertificateDocument record={record} t={t} />
        </>
      )}
    </ProcessingModal>
  );
}
