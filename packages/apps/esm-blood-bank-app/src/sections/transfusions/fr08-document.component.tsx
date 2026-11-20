import { Button, InlineNotification } from '@carbon/react';
import { Printer } from '@carbon/react/icons';
import { useState } from 'react';
import { printDocument } from '../../shared/print-document';
import type { ProcessingTranslate } from '../../shared/processing-page.component';
import type { ComponentType } from '../laboratory/fractionation/fractionation.types';
import { componentDefinitions } from '../laboratory/fractionation/fractionation-rules';
import { transfusionRhLabel } from './transfusion-blood-group';
import styles from './transfusions.scss';
import type { TransfusionOrder } from './transfusions.types';

const fr08PrintCss = `
  @page { size: A4; margin: 11mm; }
  body { margin: 0; font: 10pt Arial, sans-serif; color: #111; }
  [data-fr08] { max-width: 188mm; margin: auto; }
  [data-fr08] h2 { margin: 0; font-size: 14pt; }
  [data-fr08] small { font-size: 8pt; font-weight: normal; }
  [data-fr08] h3 { margin: 4mm 0 1mm; font-size: 10pt; }
  [data-fr08] [data-fr08-identifiers] { display: flex; justify-content: space-between; margin: 3mm 0 6mm; }
  [data-fr08] table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  [data-fr08] td { border: 1px solid #222; padding: 2.6mm 1.8mm; vertical-align: top; overflow-wrap: anywhere; }
  [data-fr08] tr { break-inside: avoid; }
  [data-fr08] [data-fr08-choices] { display: flex; flex-wrap: wrap; gap: 2mm 5mm; align-items: center; }
  [data-fr08] [data-fr08-sex] { column-gap: 2mm; }
  [data-fr08] [data-fr08-priorities] { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
  [data-fr08] [data-fr08-priorities] > :nth-child(2) { justify-self: center; }
  [data-fr08] [data-fr08-priorities] > :last-child { justify-self: end; }
  [data-fr08] [data-fr08-mark] { display: inline-grid; place-items: center; border: 1px solid; width: 3.5mm; height: 3.5mm; }
  [data-fr08] [data-fr08-date-group] { display: inline-flex; margin-inline-end: 1mm; }
  [data-fr08] [data-fr08-date-group] span + span { border-inline-start: 0; }
  [data-fr08] [data-fr08-labs] { display: flex; justify-content: space-between; gap: 3mm; margin-top: 4mm; }
  [data-fr08] [data-fr08-lines] { list-style: none; padding: 0; margin: 0; }
  [data-fr08] [data-fr08-lines] li { display: flex; justify-content: space-between; gap: 2mm; align-items: center; min-height: 6.3mm; }
  [data-fr08] [data-fr08-count] { flex: none; display: inline-grid; min-width: 7mm; min-height: 4.5mm; border: 1px solid; place-items: center; }
  [data-fr08] [data-fr08-signature] { height: 20mm; }
  [data-fr08] [data-fr08-signature-line] { margin: 22mm 10% 1mm auto; width: 42%; border-top: 1px solid; text-align: center; padding-top: 1mm; }
  [data-fr08] .cds--visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
`;

const dateFormat = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
const timeFormat = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
export const formatFr08Date = (date = new Date()) => dateFormat.format(date);

const answerOptions = ['yes', 'no', 'unknown'] as const;
const requirementsLeft = ['wholeBlood', 'redCells', 'freshFrozenPlasma', 'cryoprecipitate'] as const;
const requirementsRight = ['liquidPlasma', 'platelets', 'pediatricFraction'] as const;
const printedComponents = new Set<ComponentType>([...requirementsLeft, ...requirementsRight]);
const componentLabels: Partial<Record<ComponentType, string>> = {
  redCells: 'fr08PackedCells',
  cryoprecipitate: 'fr08Cryoprecipitate',
  liquidPlasma: 'fr08Plasma',
  platelets: 'fr08Platelets',
};

function mark(label: string, checked: boolean) {
  return (
    <span key={label} data-fr08-choice>
      <span data-fr08-mark aria-hidden="true">
        {checked ? '×' : ''}
      </span>{' '}
      {label}
      {checked && <span className="cds--visually-hidden"> ✓</span>}
    </span>
  );
}

export function Fr08Document({ order, t }: { order: TransfusionOrder; t: ProcessingTranslate }) {
  const timestamp = new Date(order.requestedAt);
  const date = formatFr08Date(timestamp);
  const scheduled = order.scheduledDate ? new Date(order.scheduledDate) : undefined;
  const quantityByComponent = new Map(order.items.map(({ component, quantity }) => [component, quantity]));
  const additional = order.items.filter(({ component }) => !printedComponents.has(component));
  const diagnosis = order.diagnosisCode ? `${order.diagnosisCode} · ${order.diagnosis}` : order.diagnosis;
  const incompatibility = answerOptions.find((answer) => answer === order.maternalIncompatibility);
  const requirement = (key: string, label: string, quantity?: number) => (
    <li key={key}>
      <span>{label}</span>
      <span data-fr08-count>{quantity ?? ''}</span>
    </li>
  );
  const componentLine = (component: ComponentType) =>
    requirement(
      component,
      t(componentLabels[component] ?? componentDefinitions[component].key),
      quantityByComponent.get(component),
    );

  return (
    <article data-fr08 className={styles.fr08Document}>
      <header>
        <h2>
          {t('fr08Title')} <small>({t('fr08Page')})</small>
        </h2>
      </header>
      <div data-fr08-identifiers>
        <span>
          {t('fr08Date')} <span className="cds--visually-hidden">{date}</span>
          {date.split('/').map((part, index) => (
            <span key={['day', 'month', 'year'][index]} data-fr08-date-group aria-hidden="true">
              {[...part].map((digit, position) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: Each position is one fixed box in the printed date.
                <span data-fr08-mark key={position}>
                  {digit}
                </span>
              ))}
            </span>
          ))}
        </span>
        <span>
          {t('txReportRequestNumber')} <strong>{order.number}</strong>
        </span>
      </div>
      <h3>{t('fr08PersonalData')}</h3>
      <table aria-label={t('fr08Title')}>
        <tbody>
          <tr>
            <td colSpan={4}>
              {t('fr08FullName')}: <strong>{order.patientName}</strong>
            </td>
            <td colSpan={2}>
              {t('txSampleHistoryNumber')}: {order.historyNumber}
            </td>
          </tr>
          <tr>
            <td colSpan={2}>
              <div data-fr08-choices data-fr08-sex>
                {t('txSex')}: {mark(t('male'), order.sex === 'M')} {mark(t('female'), order.sex === 'F')}
              </div>
            </td>
            <td colSpan={2}>
              {t('txAge')}: {order.age}
            </td>
            <td colSpan={2}>
              {t('fr08Group')}: {order.bloodGroup.slice(0, -1)} &nbsp; Rh:{' '}
              {transfusionRhLabel(order.bloodGroup.slice(-1), t)}
            </td>
          </tr>
          <tr>
            <td colSpan={2}>
              {t('txService')}: {order.service}
            </td>
            <td colSpan={2}>
              {t('txWard')}: {order.ward}
            </td>
            <td colSpan={2}>
              {t('txBed')}: {order.bed}
            </td>
          </tr>
          {(
            [
              ['txPriorTransfusions', order.priorTransfusions],
              ['txPriorReactions', order.priorReactions],
            ] as const
          ).map(([label, value]) => (
            <tr key={label}>
              <td colSpan={6}>
                <div data-fr08-choices>
                  <span>{t(label)}</span>
                  {answerOptions.map((option) => mark(t(`tx${option}`), option === value))}
                </div>
              </td>
            </tr>
          ))}
          <tr>
            <td colSpan={2}>
              {t('txPregnancies')}: {order.sex === 'F' ? order.pregnancies : ''}
            </td>
            <td colSpan={2}>
              {t('txAbortions')}: {order.sex === 'F' ? order.abortions : ''}
            </td>
            <td colSpan={2}>
              {t('txMaternal')}:{' '}
              {order.sex === 'F' ? (incompatibility ? t(`tx${incompatibility}`) : order.maternalIncompatibility) : ''}
            </td>
          </tr>
          <tr>
            <td colSpan={6}>
              <div>
                {t('fr08Diagnosis')}: {diagnosis}
              </div>
              <div data-fr08-labs>
                <span>Hb: {order.hemoglobin || '………'} g/dl</span>
                <span>Hto: {order.hematocrit || '………'} %</span>
                <span>
                  {t('fr08Platelets')}: {order.platelets || '………'} /mm³
                </span>
              </div>
            </td>
          </tr>
          <tr>
            <td colSpan={6}>{t('fr08Requirement')}</td>
          </tr>
          <tr>
            <td colSpan={3}>
              <ul data-fr08-lines>{requirementsLeft.map(componentLine)}</ul>
            </td>
            <td colSpan={3}>
              <ul data-fr08-lines>
                {requirementsRight.map(componentLine)}
                {additional.map(({ component, quantity }) =>
                  requirement(
                    component,
                    `${t('fr08OtherComponent')}: ${t(componentDefinitions[component].key)}`,
                    quantity,
                  ),
                )}
                {order.otherComponent
                  ? requirement(
                      'other',
                      `${t('fr08OtherComponent')}: ${order.otherComponent.description}`,
                      order.otherComponent.quantity,
                    )
                  : !additional.length && requirement('other', t('fr08OtherComponent'))}
              </ul>
            </td>
          </tr>
          {order.priority === 'scheduled' && (
            <tr data-fr08-scheduled>
              <td colSpan={3}>
                {t('fr08Date')}: {scheduled ? formatFr08Date(scheduled) : ''}
              </td>
              <td colSpan={3}>
                {t('fr08Time')}: {scheduled ? timeFormat.format(scheduled) : ''}
              </td>
            </tr>
          )}
          <tr>
            <td colSpan={3} data-fr08-signature>
              {t('txDoctor')}: {order.orderer}
            </td>
            <td colSpan={3} data-fr08-signature>
              {t('fr08Signature')}
            </td>
          </tr>
          <tr>
            <td colSpan={6}>
              <div data-fr08-choices data-fr08-priorities>
                {mark(t('fr08VeryUrgent'), order.priority === 'veryUrgent')}
                {mark(t('txUrgent'), order.priority === 'urgent')}
                {mark(t('txScheduled'), order.priority === 'scheduled')}
              </div>
            </td>
          </tr>
          <tr>
            <td colSpan={6}>
              {t('fr08UncrossmatchedAuthorization')}
              <div data-fr08-signature-line>{t('fr08Signature')}</div>
            </td>
          </tr>
        </tbody>
      </table>
    </article>
  );
}

export function PrintFr08({
  order,
  t,
  label,
  disabled = false,
  onPrintError,
}: {
  order: TransfusionOrder;
  t: ProcessingTranslate;
  label?: string;
  disabled?: boolean;
  onPrintError?: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const fail = onPrintError ?? (() => setFailed(true));
  const print = () => {
    setFailed(false);
    try {
      printDocument(<Fr08Document order={order} t={t} />, t('fr08Title'), fail, fr08PrintCss);
    } catch {
      fail();
    }
  };
  return (
    <>
      <Button
        kind="tertiary"
        size="sm"
        onClick={print}
        renderIcon={Printer}
        disabled={disabled}
        title={label && onPrintError ? t('fr08Print') : undefined}
      >
        {label ?? t('fr08Print')}
      </Button>
      {failed && <InlineNotification kind="error" hideCloseButton title={t('printFailed')} />}
    </>
  );
}
