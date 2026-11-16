import { Button, Checkbox, Form, FormGroup, InlineNotification, TextInput } from '@carbon/react';
import { type FormEvent, useState } from 'react';
import { notifySuccess } from '../../shared/notify-success';
import { ProcessingPage, useProcessingTranslation } from '../../shared/processing-page.component';
import { componentDefinitions, componentTypes } from '../laboratory/fractionation/fractionation-rules';
import type { ComponentType } from '../laboratory/fractionation/fractionation.types';
import {
  type BloodBankSettings,
  type StockMinimums,
  isExpiryWarningDays,
  isStockMinimum,
  maxExpiryWarningDays,
  signatoryLookupError,
} from './blood-bank-settings';
import { SignatoryPicker } from './signatory-picker.component';
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
  const [cardComponents, setCardComponents] = useState(settings.inventoryCardComponents);
  const [minimums, setMinimums] = useState<Partial<Record<ComponentType, string>>>(() =>
    Object.fromEntries(Object.entries(settings.stockMinimums).map(([component, value]) => [component, String(value)])),
  );
  const [invalidMinimums, setInvalidMinimums] = useState<ComponentType[]>([]);
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
    const stockMinimums: StockMinimums = {};
    const invalidComponents: ComponentType[] = [];
    for (const component of componentTypes) {
      const input = minimums[component];
      if (!input) continue;
      const minimum = Number(input);
      if (isStockMinimum(minimum)) stockMinimums[component] = minimum;
      else invalidComponents.push(component);
    }
    const validDays = isExpiryWarningDays(expiryWarningDays);
    setInvalidDays(!validDays);
    setInvalidMinimums(invalidComponents);
    if (!validDays || invalidComponents.length) return;
    setSaving(true);
    try {
      await onSave({
        expiryWarningDays,
        stockMinimums,
        inventoryCardComponents: componentTypes.filter((component) => cardComponents.includes(component)),
        servicePersonUuid: service,
        epidemiologyPersonUuid: epidemiology,
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
        <FormGroup legendText={t('settingsInventoryCards')}>
          <p className={styles.settingHelp}>{t('settingsInventoryCardsHelp')}</p>
          <div className={styles.cardVisibilityGrid}>
            {componentTypes.map((component) => (
              <Checkbox
                key={component}
                id={`blood-bank-inventory-card-${component}`}
                labelText={t(componentDefinitions[component].key)}
                checked={cardComponents.includes(component)}
                disabled={!onSave || saving}
                onChange={(_event, { checked }) => {
                  setCardComponents((current) =>
                    checked ? [...current, component] : current.filter((item) => item !== component),
                  );
                }}
              />
            ))}
          </div>
        </FormGroup>
        <FormGroup legendText={t('settingsStockMinimums')}>
          <p className={styles.settingHelp}>{t('settingsStockMinimumsHelp')}</p>
          <div className={styles.minimumGrid}>
            {componentTypes.map((component) => (
              <TextInput
                key={component}
                id={`blood-bank-stock-minimum-${component}`}
                labelText={t(componentDefinitions[component].key)}
                type="number"
                min={0}
                step={1}
                value={minimums[component] ?? ''}
                readOnly={!onSave || saving}
                invalid={invalidMinimums.includes(component)}
                invalidText={t('settingsInvalidStockMinimum')}
                onChange={(event) => {
                  const value = event.target.value;
                  setMinimums((current) => ({ ...current, [component]: value }));
                  setInvalidMinimums((current) => current.filter((item) => item !== component));
                }}
              />
            ))}
          </div>
        </FormGroup>
        <FormGroup legendText={t('settingsDisposalSignatories')}>
          <div className={styles.signatories}>
            <SignatoryPicker
              label={t('inventoryServiceResponsible')}
              personUuid={service}
              editable={Boolean(onSave)}
              saving={saving}
              onChange={setService}
            />
            <SignatoryPicker
              label={t('inventoryEpidemiologyResponsible')}
              personUuid={epidemiology}
              editable={Boolean(onSave)}
              saving={saving}
              onChange={setEpidemiology}
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
