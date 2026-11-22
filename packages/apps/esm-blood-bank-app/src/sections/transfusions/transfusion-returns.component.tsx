import { Button, Checkbox, InlineNotification, Select, SelectItem, Tag, TextArea, TextInput } from '@carbon/react';
import { ArrowLeft, Checkmark, Delivery, DocumentAdd } from '@carbon/react/icons';
import { useId, useRef, useState } from 'react';
import { formatListDate } from '../../shared/format-list-date';
import { notifySuccess } from '../../shared/notify-success';
import type { ProcessingTranslate } from '../../shared/processing-page.component';
import { componentDefinitions } from '../laboratory/fractionation/fractionation-rules';
import {
  requiresReturnTemperature,
  validReturnInspection,
  validReturnReceipt,
  validReturnTemperature,
} from './transfusion-return-rules';
import styles from './transfusions.scss';
import type {
  TransfusionBookEntry,
  TransfusionReturn,
  TransfusionReturnInspection,
  TransfusionReturnReceipt,
  TransfusionReturnView,
} from './transfusions.types';

export interface ReturnActions {
  operator: string;
  receive(dispatch: TransfusionBookEntry, receipt: TransfusionReturnReceipt): Promise<TransfusionReturn>;
  inspect(dispatch: TransfusionBookEntry, inspection: TransfusionReturnInspection): Promise<TransfusionReturn>;
}

const checks = [
  ['notAdministered', 'txReturnUnusedVerified'],
  ['intact', 'txReturnIntact'],
  ['identityVerified', 'txReturnIdentity'],
  ['segmentAttached', 'txReturnSegment'],
  ['conservationVerified', 'txReturnConservation'],
] as const;

const useLabels = { unused: 'txReturnUnused', started: 'txReturnStarted', unknown: 'txReturnUnknown' } as const;

const returnStatus = (record?: TransfusionReturnView) =>
  record?.disposal
    ? 'txReturnDisposed'
    : record?.inspection?.decision === 'approved'
      ? 'txReturnApproved'
      : record?.inspection?.decision === 'rejected'
        ? 'txReturnRejected'
        : record
          ? 'txReturnInspection'
          : 'txReturnPending';

const returnTag = (record?: TransfusionReturnView) =>
  record?.disposal
    ? 'warm-gray'
    : record?.inspection?.decision === 'approved'
      ? 'green'
      : record?.inspection?.decision === 'rejected'
        ? 'red'
        : record
          ? 'warm-gray'
          : 'blue';

function returnError(error: unknown) {
  if (error instanceof Error) {
    if (error.message === 'TRANSFUSION_RETURN_STARTED') return 'txReturnStartedError';
    if (error.message === 'TRANSFUSION_RETURN_STOCK_CONFLICT') return 'txReturnStockConflict';
    if (error.message === 'TRANSFUSION_RETURN_CONTEXT') return 'txReturnContextError';
  }
  return 'txReturnSaveFailed';
}

export function TransfusionReturns({
  dispatches,
  records,
  actions,
  t,
}: {
  dispatches: TransfusionBookEntry[];
  records: TransfusionReturnView[];
  actions?: ReturnActions;
  t: ProcessingTranslate;
}) {
  const [selected, setSelected] = useState('');
  const [saved, setSaved] = useState<Record<string, TransfusionReturnView>>({});
  const heading = useId();

  return (
    <section className={styles.returnSection} aria-labelledby={heading}>
      <h3 id={heading}>
        <Delivery size={20} aria-hidden="true" /> {t('txReturnUnits')}
      </h3>
      {dispatches.length === 0 && <p>{t('txReturnNoLocalDispatch')}</p>}
      {dispatches.map((dispatch) => {
        const current = records.find((value) => value.dispatchId === dispatch.id);
        const record = current?.inspection ? current : (saved[dispatch.id] ?? current);
        const title = componentDefinitions[dispatch.component]?.key ?? 'fractionationComponent';
        return (
          <article key={dispatch.id} className={styles.returnCard}>
            <div className={styles.returnCardHeader}>
              <div>
                <p>{t(title)}</p>
                <h4>{dispatch.unitCode}</h4>
              </div>
              <Tag type={returnTag(record)} size="sm">
                {t(returnStatus(record))}
              </Tag>
            </div>
            <dl className={styles.returnFacts}>
              <div>
                <dt>{t('txNumber')}</dt>
                <dd>{dispatch.orderNumber}</dd>
              </div>
              <div>
                <dt>{t('txSeal')}</dt>
                <dd>{dispatch.seal}</dd>
              </div>
              <div>
                <dt>{t('txDeliveredAt')}</dt>
                <dd>{formatListDate(dispatch.at)}</dd>
              </div>
              {record && (
                <>
                  <div>
                    <dt>{t('txReturnReceivedAt')}</dt>
                    <dd>{formatListDate(record.receipt.at)}</dd>
                  </div>
                  <div>
                    <dt>{t('txReturnReturnedBy')}</dt>
                    <dd>{record.receipt.returnedBy}</dd>
                  </div>
                  <div>
                    <dt>{t('txReturnReceivedBy')}</dt>
                    <dd>{record.receipt.receivedBy}</dd>
                  </div>
                  <div>
                    <dt>{t('txReturnReason')}</dt>
                    <dd>{record.receipt.reason}</dd>
                  </div>
                  <div>
                    <dt>{t('txReturnAdministration')}</dt>
                    <dd>{t(useLabels[record.receipt.administration])}</dd>
                  </div>
                </>
              )}
              {record?.disposal && (
                <>
                  <div>
                    <dt>{t('txReturnDisposalAct')}</dt>
                    <dd>{record.disposal.operationId}</dd>
                  </div>
                  <div>
                    <dt>{t('txReturnDisposedAt')}</dt>
                    <dd>{formatListDate(record.disposal.at)}</dd>
                  </div>
                </>
              )}
              {record?.inspection && (
                <>
                  <div>
                    <dt>{t('txReturnInspectedAt')}</dt>
                    <dd>{formatListDate(record.inspection.at)}</dd>
                  </div>
                  <div>
                    <dt>{t('txReturnInspectedBy')}</dt>
                    <dd>{record.inspection.inspectedBy}</dd>
                  </div>
                  {record.inspection.evidence && (
                    <div>
                      <dt>{t('txReturnEvidence')}</dt>
                      <dd>{record.inspection.evidence}</dd>
                    </div>
                  )}
                  {record.inspection.minimumTemperature && record.inspection.maximumTemperature && (
                    <div>
                      <dt>{t('txReturnTemperature')}</dt>
                      <dd>
                        {record.inspection.minimumTemperature}–{record.inspection.maximumTemperature} °C
                      </dd>
                    </div>
                  )}
                  {record.inspection.rejectionReason && (
                    <div>
                      <dt>{t('txReturnRejectionReason')}</dt>
                      <dd>{record.inspection.rejectionReason}</dd>
                    </div>
                  )}
                </>
              )}
            </dl>
            {actions &&
              !record?.inspection &&
              (selected === dispatch.id ? (
                <ReturnEditor
                  dispatch={dispatch}
                  record={record}
                  actions={actions}
                  onClose={() => setSelected('')}
                  onSaved={(newRecord) => {
                    setSaved((current) => ({ ...current, [dispatch.id]: newRecord }));
                    setSelected('');
                  }}
                  t={t}
                />
              ) : (
                <div className={styles.returnActions}>
                  <Button
                    kind="tertiary"
                    size="sm"
                    renderIcon={record ? Checkmark : DocumentAdd}
                    disabled={Boolean(selected)}
                    onClick={() => setSelected(dispatch.id)}
                  >
                    {t(record ? 'txReturnInspect' : 'txRegisterReturn')}
                  </Button>
                </div>
              ))}
          </article>
        );
      })}
    </section>
  );
}

function ReturnEditor({
  dispatch,
  record,
  actions,
  onSaved,
  onClose,
  t,
}: {
  dispatch: TransfusionBookEntry;
  record?: TransfusionReturn;
  actions: ReturnActions;
  onSaved: (value: TransfusionReturn) => void;
  onClose: () => void;
  t: ProcessingTranslate;
}) {
  const id = useId();
  const [returnedBy, setReturnedBy] = useState('');
  const [reason, setReason] = useState(t('txReturnDefaultReason'));
  const [administration, setAdministration] = useState<TransfusionReturnReceipt['administration'] | ''>('');
  const [decision, setDecision] = useState<TransfusionReturnInspection['decision'] | ''>('');
  const [evidence, setEvidence] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [minimumTemperature, setMinimumTemperature] = useState('');
  const [maximumTemperature, setMaximumTemperature] = useState('');
  const [verified, setVerified] = useState({
    notAdministered: false,
    intact: false,
    segmentAttached: false,
    identityVerified: false,
    conservationVerified: false,
  });
  const saving = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const receipt = administration ? { returnedBy, reason, administration, receivedBy: actions.operator } : undefined;
  const inspection = decision
    ? {
        decision,
        inspectedBy: actions.operator,
        evidence,
        rejectionReason,
        minimumTemperature,
        maximumTemperature,
        ...verified,
      }
    : undefined;
  const invalidTemperature =
    Boolean(minimumTemperature && maximumTemperature) &&
    !validReturnTemperature(minimumTemperature, maximumTemperature);
  const canSave = record
    ? inspection && validReturnInspection(inspection, record.receipt.administration, dispatch.component)
    : receipt && validReturnReceipt(receipt);

  const save = async () => {
    if (!canSave || saving.current) return;
    saving.current = true;
    setBusy(true);
    setError('');
    try {
      const result =
        record && inspection
          ? await actions.inspect(dispatch, inspection)
          : receipt
            ? await actions.receive(dispatch, receipt)
            : undefined;
      if (!result) return;
      notifySuccess(t(record ? 'txReturnInspectionSaved' : 'txReturnReceiptSaved'));
      onSaved(result);
    } catch (failure) {
      setError(returnError(failure));
    } finally {
      setBusy(false);
      saving.current = false;
    }
  };

  return (
    <div className={styles.returnEditor}>
      <h5>{t(record ? 'txReturnInspect' : 'txRegisterReturn')}</h5>
      {error && <InlineNotification lowContrast hideCloseButton kind="error" title={t(error)} />}
      <fieldset disabled={busy} aria-label={t(record ? 'txReturnInspect' : 'txRegisterReturn')}>
        {!record ? (
          <>
            <div className={styles.returnFields}>
              <TextInput
                id={id + '-returned-by'}
                labelText={t('txReturnReturnedBy')}
                maxLength={200}
                value={returnedBy}
                onChange={(event) => setReturnedBy(event.target.value)}
              />
              <TextInput
                id={id + '-received-by'}
                labelText={t('txReturnReceivedBy')}
                value={actions.operator}
                readOnly
              />
              <Select
                id={id + '-administration'}
                labelText={t('txReturnAdministration')}
                value={administration}
                onChange={(event) => setAdministration(event.target.value as typeof administration)}
              >
                <SelectItem disabled value="" text={t('txReturnChoose')} />
                {Object.entries(useLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key} text={t(label)} />
                ))}
              </Select>
            </div>
            <TextArea
              id={id + '-reason'}
              labelText={t('txReturnReason')}
              rows={2}
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </>
        ) : (
          <>
            <div className={styles.returnFields}>
              <TextInput
                id={id + '-inspected-by'}
                labelText={t('txReturnInspectedBy')}
                value={actions.operator}
                readOnly
              />
              <Select
                id={id + '-decision'}
                labelText={t('txReturnDecision')}
                value={decision}
                onChange={(event) => setDecision(event.target.value as typeof decision)}
              >
                <SelectItem disabled value="" text={t('txReturnChoose')} />
                <SelectItem
                  value="approved"
                  text={t('txReturnApprove')}
                  disabled={record.receipt.administration === 'started'}
                />
                <SelectItem value="rejected" text={t('txReturnReject')} />
              </Select>
            </div>
            {record.receipt.administration === 'started' && <p>{t('txReturnStartedError')}</p>}
            {decision === 'approved' && (
              <>
                <div className={styles.returnChecklist}>
                  {checks.map(([key, label]) => (
                    <Checkbox
                      id={id + '-' + key}
                      key={key}
                      checked={verified[key]}
                      labelText={t(label)}
                      onChange={(_event, { checked }) => setVerified((current) => ({ ...current, [key]: checked }))}
                    />
                  ))}
                </div>
                {requiresReturnTemperature(dispatch.component) && (
                  <div className={styles.returnFields}>
                    <TextInput
                      id={id + '-min'}
                      type="number"
                      step="any"
                      labelText={t('txReturnTemperatureMin')}
                      value={minimumTemperature}
                      onChange={(event) => setMinimumTemperature(event.target.value)}
                    />
                    <TextInput
                      id={id + '-max'}
                      type="number"
                      step="any"
                      labelText={t('txReturnTemperatureMax')}
                      invalid={invalidTemperature}
                      invalidText={t('txReturnTemperatureInvalid')}
                      value={maximumTemperature}
                      onChange={(event) => setMaximumTemperature(event.target.value)}
                    />
                  </div>
                )}
                <TextArea
                  id={id + '-evidence'}
                  labelText={t('txReturnEvidence')}
                  helperText={t('txReturnEvidenceHelp')}
                  rows={2}
                  maxLength={500}
                  value={evidence}
                  onChange={(event) => setEvidence(event.target.value)}
                />
              </>
            )}
            {decision === 'rejected' && (
              <TextArea
                id={id + '-rejection'}
                labelText={t('txReturnRejectionReason')}
                rows={2}
                maxLength={500}
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
              />
            )}
          </>
        )}
      </fieldset>
      <div className={styles.returnActions}>
        <Button type="button" kind="ghost" size="sm" renderIcon={ArrowLeft} disabled={busy} onClick={onClose}>
          {t('txReturnCancel')}
        </Button>
        <Button type="button" size="sm" disabled={!canSave || busy} onClick={() => void save()}>
          {t(record ? (decision === 'approved' ? 'txReturnApprove' : 'txReturnSaveInspection') : 'txReturnSaveReceipt')}
        </Button>
      </div>
    </div>
  );
}
