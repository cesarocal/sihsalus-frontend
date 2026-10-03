import {
  Button,
  Checkbox,
  InlineNotification,
  RadioButton,
  RadioButtonGroup,
  Select,
  SelectItem,
  TextArea,
  TextInput,
} from '@carbon/react';
import { Printer } from '@carbon/react/icons';
import { useState } from 'react';
import type { CollectionApi } from '../../api/blood-bank-processing.api';
import { ProcessingModal } from '../../shared/processing-modal.component';
import type { ProcessingTranslate } from '../../shared/processing-page.component';
import { printDocument } from '../../shared/print-document';
import { calculateReturnDate } from '../applicant-selection/selection-rules';
import styles from '../applicant-selection/selection.scss';
import {
  CollectionIdentity,
  CollectionLabelDocument,
  DonationCertificateDocument,
} from './collection-documents.component';
import { validateCollection, validVolume } from './collection-rules';
import {
  collectionSteps,
  type CollectionLabel,
  type CollectionRecord,
  type DonationRegistry,
} from './collection.types';

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
  const [record, setRecord] = useState(initial);
  const [step, setStep] = useState(initial.status === 'completed' ? 3 : Math.min(initial.completedSteps.length, 3));
  const [errors, setErrors] = useState<string[]>([]);
  const [failed, setFailed] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const stage = collectionSteps[step];
  const finalized = record.status === 'completed';
  const locked = finalized || record.completedSteps.includes(stage);
  const change = (next: CollectionRecord) => {
    setRecord(next);
    setSaved(false);
  };
  const save = async (advance = false) => {
    if (saving) return false;
    if (advance && locked) {
      setStep((value) => Math.min(value + 1, 3));
      return true;
    }
    const missing = advance ? validateCollection(record, stage) : [];
    setErrors(missing);
    setFailed('');
    if (missing.length) return false;
    setSaving(true);
    try {
      const result = await api.saveCollection(record, advance ? stage : undefined);
      setRecord(result);
      setSaved(true);
      if (advance && stage === 'certificate') onSaved();
      else if (advance) setStep((value) => value + 1);
      return true;
    } catch {
      setFailed('saveFailed');
      return false;
    } finally {
      setSaving(false);
    }
  };
  const print = (kind: 'unit' | 'sample' | 'certificate') => {
    const missing = validateCollection(record, kind === 'certificate' ? 'certificate' : 'label');
    setErrors(missing);
    setFailed('');
    if (missing.length) return;
    try {
      printDocument(
        kind === 'certificate' ? (
          <DonationCertificateDocument record={record} t={t} />
        ) : (
          <CollectionLabelDocument record={record} t={t} sample={kind === 'sample'} />
        ),
        t(kind === 'certificate' ? 'printCertificate' : kind === 'sample' ? 'printSample' : 'printUnit'),
      );
    } catch {
      setFailed('printFailed');
    }
  };
  const labelInput = (field: Exclude<keyof CollectionLabel, 'leukocytesReduced'>, numeric = false) => (
    <TextInput
      key={field}
      id={`collection-${field}`}
      labelText={t(field)}
      value={record.label[field]}
      type={numeric ? 'number' : 'text'}
      min={numeric ? 0.01 : undefined}
      step={numeric ? 0.01 : undefined}
      readOnly={locked}
      disabled={saving}
      invalid={errors.includes(field)}
      invalidText={t('requiredFields')}
      onChange={(event) => change({ ...record, label: { ...record.label, [field]: event.target.value } })}
    />
  );
  const registryInput = (
    field: Exclude<keyof DonationRegistry, 'complications' | 'extractionStatus' | 'observations'>,
  ) => (
    <TextInput
      key={field}
      id={`collection-${field}`}
      labelText={t(field === 'date' ? 'collectionDate' : field)}
      value={record.registry[field]}
      type={field === 'date' ? 'date' : 'text'}
      readOnly={locked}
      disabled={saving}
      invalid={errors.includes(field === 'date' ? 'collectionDate' : field)}
      invalidText={t('requiredFields')}
      onChange={(event) =>
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
        })
      }
    />
  );
  const extras =
    step <= 1 ? (
      <>
        <Button kind="ghost" renderIcon={Printer} disabled={saving} onClick={() => print('unit')}>
          {t('printUnit')}
        </Button>
        <Button kind="ghost" renderIcon={Printer} disabled={saving} onClick={() => print('sample')}>
          {t('printSample')}
        </Button>
        {step === 1 && (
          <Button kind="ghost" disabled>
            {t('adverseReaction')}
          </Button>
        )}
      </>
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
      onClose={onClose}
      onDraft={() => save()}
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
      {saved && <InlineNotification hideCloseButton kind="success" title={t('saved')} />}
      {locked && <p className={styles.help}>{t('locked')}</p>}
      {step === 0 && (
        <>
          <p>{t('labelHelp')}</p>
          <div className={styles.fields}>
            {(
              [
                'component',
                'anticoagulant',
                'preservative',
                'sedimentingAgent',
                'service',
                'collectedBy',
                'sampleType',
                'sampleContainer',
              ] as const
            ).map((field) => labelInput(field))}
            {labelInput('plannedVolume', true)}
            <Checkbox
              id="collection-leukocytes"
              labelText={t('leukocytesReduced')}
              checked={record.label.leukocytesReduced}
              disabled={locked || saving}
              onChange={(_event, { checked }) =>
                change({ ...record, label: { ...record.label, leukocytesReduced: checked } })
              }
            />
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
              type="number"
              min={0.01}
              max={999999.99}
              step={0.01}
              labelText={t('extractedVolume')}
              value={record.extractedVolume}
              readOnly={locked}
              disabled={saving}
              invalid={errors.includes('extractedVolume')}
              invalidText={t('requiredFields')}
              onChange={(event) => change({ ...record, extractedVolume: event.target.value })}
            />
          </div>
          <InlineNotification hideCloseButton kind="info" title={t('quarantine')} subtitle={t('volumeHelp')} />
        </>
      )}
      {step === 2 && (
        <div className={styles.fields}>
          {(['date', 'bagLot', 'attendedBy'] as const).map(registryInput)}
          <RadioButtonGroup
            name="collection-complications"
            legendText={t('complications')}
            valueSelected={record.registry.complications}
            disabled={locked || saving}
            onChange={(value) =>
              change({ ...record, registry: { ...record.registry, complications: value as 'yes' | 'no' } })
            }
          >
            <RadioButton id="collection-complications-no" value="no" labelText={t('no')} />
            <RadioButton id="collection-complications-yes" value="yes" labelText={t('yes')} />
          </RadioButtonGroup>
          <Select
            id="collection-outcome"
            labelText={t('extractionStatus')}
            value={record.registry.extractionStatus}
            disabled={locked || saving}
            invalid={errors.includes('extractionStatus')}
            invalidText={t('requiredFields')}
            onChange={(event) =>
              change({
                ...record,
                registry: {
                  ...record.registry,
                  extractionStatus: event.target.value as DonationRegistry['extractionStatus'],
                },
              })
            }
          >
            <SelectItem value="" text={t('choose')} />
            <SelectItem value="complete" text={t('complete')} />
            <SelectItem value="incomplete" text={t('incomplete')} />
          </Select>
          <TextArea
            id="collection-observations"
            labelText={t('observations')}
            value={record.registry.observations}
            readOnly={locked}
            disabled={saving}
            onChange={(event) =>
              change({ ...record, registry: { ...record.registry, observations: event.target.value } })
            }
          />
        </div>
      )}
      {step === 3 && (
        <>
          <div className={styles.fields}>
            <TextInput
              id="certificate-date"
              type="date"
              labelText={t('resultsAvailableOn')}
              value={record.certificate.resultsAvailableOn}
              readOnly={locked}
              disabled={saving}
              invalid={errors.includes('resultsAvailableOn')}
              invalidText={t('requiredFields')}
              onChange={(event) =>
                change({ ...record, certificate: { ...record.certificate, resultsAvailableOn: event.target.value } })
              }
            />
            <RadioButtonGroup
              name="certificate-consent"
              legendText={t('emailConsent')}
              valueSelected={record.certificate.emailConsent}
              disabled={locked || saving}
              onChange={(value) =>
                change({ ...record, certificate: { ...record.certificate, emailConsent: value as 'yes' | 'no' } })
              }
            >
              <RadioButton id="certificate-email-no" value="no" labelText={t('no')} />
              <RadioButton id="certificate-email-yes" value="yes" labelText={t('yes')} />
            </RadioButtonGroup>
            {record.certificate.emailConsent === 'yes' && (
              <TextInput
                id="certificate-email"
                type="email"
                labelText={t('email')}
                value={record.certificate.email}
                readOnly={locked}
                disabled={saving}
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
