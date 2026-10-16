import { Button, Select, SelectItem, TextArea, TextInput } from '@carbon/react';
import { Add, TrashCan } from '@carbon/react/icons';
import type { ProcessingTranslate } from '../../shared/processing-page.component';
import shared from '../applicant-selection/selection.scss';
import type { ComponentType } from '../laboratory/fractionation/fractionation.types';
import { componentDefinitions } from '../laboratory/fractionation/fractionation-rules';
import styles from './transfers.scss';
import type { TransferRequestData } from './transfers.types';
import { transferBloodGroups } from './transfers-rules';

export function TransferRequestFields({
  data,
  busy,
  outgoing = false,
  onChange,
  t,
}: {
  data: TransferRequestData;
  busy: boolean;
  outgoing?: boolean;
  onChange: (data: TransferRequestData) => void;
  t: ProcessingTranslate;
}) {
  const text = (field: keyof TransferRequestData, label: string, type = 'text') => (
    <TextInput
      key={field}
      id={`transfer-${field}`}
      labelText={t(label)}
      type={type}
      disabled={busy}
      value={String(data[field] ?? '')}
      onChange={(event) => onChange({ ...data, [field]: event.target.value })}
    />
  );
  return (
    <>
      {outgoing && <p className={styles.notice}>{t('transferOutgoingHelp')}</p>}
      <div className={shared.fields}>
        {text('office', 'transferRequestOffice')}
        {text('date', 'transferRequestDate', 'date')}
        {!outgoing && (
          <Select
            id="transfer-channel"
            labelText={t('transferChannel')}
            disabled={busy}
            value={data.channel}
            onChange={(event) => onChange({ ...data, channel: event.target.value as 'email' | 'paper' })}
          >
            <SelectItem value="email" text={t('transferEmail')} />
            <SelectItem value="paper" text={t('transferPaper')} />
          </Select>
        )}
        {!outgoing && text('externalId', 'transferExternalId')}
        {text('requestingInstitution', 'transferRequestingInstitution')}
        {text('destinationInstitution', 'transferDestinationInstitution')}
        {text('requestingDirector', 'transferRequestingDirector')}
        {text('addressedDirector', 'transferAddressedDirector')}
        {text('attention', 'transferAttention')}
        {text('requestingAttention', 'transferRequestingAttention')}
        {text('contact', 'transferContact')}
      </div>
      <h4 className={styles.subheading}>{t('transferRecipient')}</h4>
      <div className={shared.fields}>
        {text('patientName', 'transferPatientName')}
        {text('patientAge', 'transferPatientAge', 'number')}
        {text('patientDocument', 'transferPatientDocument')}
        {text('patientHistory', 'transferHistoryNumber')}
        <Select
          id="transfer-patientBloodGroup"
          labelText={t('bloodGroup')}
          disabled={busy}
          value={data.patientBloodGroup}
          onChange={(event) => onChange({ ...data, patientBloodGroup: event.target.value })}
        >
          <SelectItem value="" text={t('transferChooseGroup')} />
          {transferBloodGroups.map((group) => (
            <SelectItem key={group} value={group} text={group} />
          ))}
        </Select>
        {text('ward', 'transferWard')}
        {text('bed', 'transferBed')}
        {text('diagnosis', 'transferDiagnosis')}
        {text('requestingDoctor', 'transferDoctorOptional')}
        {text('requestingDoctorLicense', 'transferDoctorLicenseOptional')}
        <TextArea
          id="transfer-transfusionReason"
          labelText={t('transferTransfusionReason')}
          disabled={busy}
          value={data.transfusionReason}
          onChange={(event) => onChange({ ...data, transfusionReason: event.target.value })}
        />
        <TextArea
          id="transfer-transferReason"
          labelText={t('transferReason')}
          disabled={busy}
          value={data.transferReason}
          onChange={(event) => onChange({ ...data, transferReason: event.target.value })}
        />
        <TextInput
          id="transfer-age-limit"
          labelText={t('transferAgeLimit')}
          helperText={t('transferAgeLimitHelp')}
          type="number"
          min={1}
          step={1}
          value={data.maxCollectionAgeDays ?? ''}
          disabled={busy}
          onChange={(event) =>
            onChange({ ...data, maxCollectionAgeDays: event.target.value === '' ? null : Number(event.target.value) })
          }
        />
      </div>
      <h4 className={styles.subheading}>{t('transferRequirement')}</h4>
      {data.items.map((item, index) => (
        <div key={item.id} className={styles.itemFields}>
          <Select
            id={`transfer-component-${item.id}`}
            labelText={`${t('fractionationComponent')} ${index + 1}`}
            disabled={busy}
            value={item.component}
            onChange={(event) =>
              onChange({
                ...data,
                items: data.items.map((row) =>
                  row.id === item.id ? { ...row, component: event.target.value as ComponentType } : row,
                ),
              })
            }
          >
            {Object.entries(componentDefinitions).map(([value, def]) => (
              <SelectItem key={value} value={value} text={t(def.key)} />
            ))}
          </Select>
          <TextInput
            id={`transfer-quantity-${item.id}`}
            labelText={t('transferQuantity')}
            type="number"
            min={1}
            step={1}
            disabled={busy}
            value={item.quantity || ''}
            onChange={(event) =>
              onChange({
                ...data,
                items: data.items.map((row) =>
                  row.id === item.id ? { ...row, quantity: Number(event.target.value) } : row,
                ),
              })
            }
          />
          <Select
            id={`transfer-group-${item.id}`}
            labelText={t('transferAcceptedGroup')}
            disabled={busy}
            value={item.bloodGroup}
            onChange={(event) =>
              onChange({
                ...data,
                items: data.items.map((row) => (row.id === item.id ? { ...row, bloodGroup: event.target.value } : row)),
              })
            }
          >
            <SelectItem value="" text={t('transferChooseGroup')} />
            {transferBloodGroups.map((group) => (
              <SelectItem key={group} value={group} text={group} />
            ))}
          </Select>
          <Button
            kind="ghost"
            size="sm"
            renderIcon={TrashCan}
            disabled={busy || data.items.length === 1}
            onClick={() => onChange({ ...data, items: data.items.filter((row) => row.id !== item.id) })}
          >
            {t('transferRemoveItem')}
          </Button>
        </div>
      ))}
      <Button
        kind="ghost"
        renderIcon={Add}
        disabled={busy}
        onClick={() =>
          onChange({
            ...data,
            items: [
              ...data.items,
              {
                id: `item-${Math.max(0, ...data.items.map((item) => Number(item.id.split('-').at(-1)) || 0)) + 1}`,
                component: 'wholeBlood',
                quantity: 1,
                bloodGroup: data.patientBloodGroup,
              },
            ],
          })
        }
      >
        {t('transferAddItem')}
      </Button>
    </>
  );
}
