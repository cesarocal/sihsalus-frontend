import { Button, Form, FormGroup, InlineNotification, TextInput } from '@carbon/react';
import { type FormEvent, useState } from 'react';
import { notifySuccess } from '../../shared/notify-success';
import { ProcessingPage, useProcessingTranslation } from '../../shared/processing-page.component';
import {
  type BloodBankSettings,
  isExpiryWarningDays,
  maxExpiryWarningDays,
  signatoryLookupError,
} from './blood-bank-settings';
import styles from './settings.scss';

export function BloodBankSettingsPage({
  settings,
  onSave,
}: {
  settings: BloodBankSettings;
  onSave?: (settings: BloodBankSettings) => Promise<void>;
}) {
  const t = useProcessingTranslation();
  const [days, setDays] = useState(String(settings.expiryWarningDays));
  const [service, setService] = useState(settings.servicePersonUuid);
  const [epidemiology, setEpidemiology] = useState(settings.epidemiologyPersonUuid);
  const [invalidDays, setInvalidDays] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!onSave || saving) return;
    const expiryWarningDays = Number(days);
    setError('');
    if (!isExpiryWarningDays(expiryWarningDays)) {
      setInvalidDays(true);
      return;
    }
    setSaving(true);
    try {
      await onSave({
        expiryWarningDays,
        servicePersonUuid: service.trim(),
        epidemiologyPersonUuid: epidemiology.trim(),
      });
      notifySuccess(t('settingsSaved'));
    } catch (failure) {
      setError(
        failure instanceof Error && failure.message === signatoryLookupError
          ? 'settingsSignatoryError'
          : 'settingsSaveError',
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <ProcessingPage title={t('settingsTitle')} counts={[]} illustration="settings">
      <Form className={styles.form} noValidate onSubmit={(event) => void submit(event)}>
        {!onSave && <InlineNotification kind="warning" hideCloseButton title={t('settingsUnavailable')} />}
        <FormGroup legendText={t('settingsInventory')}>
          <TextInput
            id="blood-bank-expiry-warning-days"
            labelText={t('settingsExpiryWarningDays')}
            helperText={t('settingsExpiryWarningHelp')}
            type="number"
            min={1}
            max={maxExpiryWarningDays}
            step={1}
            value={days}
            readOnly={!onSave || saving}
            invalid={invalidDays}
            invalidText={t('settingsInvalidExpiryWarningDays')}
            onChange={(event) => {
              setDays(event.target.value);
              setInvalidDays(false);
            }}
          />
        </FormGroup>
        <FormGroup legendText={t('settingsDisposalSignatories')}>
          <div className={styles.signatories}>
            <TextInput
              id="blood-bank-service-signatory"
              labelText={t('inventoryServiceResponsible')}
              helperText={t('settingsPersonUuid')}
              value={service}
              readOnly={!onSave || saving}
              onChange={(event) => setService(event.target.value)}
            />
            <TextInput
              id="blood-bank-epidemiology-signatory"
              labelText={t('inventoryEpidemiologyResponsible')}
              helperText={t('settingsPersonUuid')}
              value={epidemiology}
              readOnly={!onSave || saving}
              onChange={(event) => setEpidemiology(event.target.value)}
            />
          </div>
        </FormGroup>
        {error && <InlineNotification kind="error" hideCloseButton title={t(error)} />}
        <Button type="submit" disabled={!onSave || saving}>
          {t(saving ? 'saving' : 'settingsSave')}
        </Button>
      </Form>
    </ProcessingPage>
  );
}
