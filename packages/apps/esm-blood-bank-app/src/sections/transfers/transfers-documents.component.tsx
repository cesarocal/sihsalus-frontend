import { formatDatetime } from '@openmrs/esm-framework';
import type { ProcessingTranslate } from '../../shared/processing-page.component';
import { inventoryDisplayDate } from '../inventory/inventory-rules';
import { componentDefinitions } from '../laboratory/fractionation/fractionation-rules';
import { screeningTests } from '../laboratory/screening/screening.types';
import styles from './transfers.scss';
import type { TransferRequest, TransferRequestData } from './transfers.types';
import { transferDirection } from './transfers-rules';

export const transferDocumentPrintCss = `
 [data-transfer-document] { font: 10pt Arial, sans-serif; }
 [data-transfer-document] h2 { font-size: 12pt; text-align: left; margin-bottom: 24pt; }
 [data-transfer-document] dl { display: grid; grid-template-columns: 1fr 1fr; gap: 10pt; }
 [data-transfer-document] table { table-layout: fixed; font-size: 9pt; }
 [data-transfer-document] thead { display: table-header-group; }
 [data-transfer-document] th, [data-transfer-document] td { white-space: normal; overflow-wrap: anywhere; }
 [data-transfer-signature] { margin-top: 48pt; border-top: 1px solid #333; text-align: center; break-inside: avoid; }
 [data-transfer-document] footer { break-inside: avoid; }
`;
export function TransferSummary({ data, t }: { data: TransferRequestData; t: ProcessingTranslate }) {
  const details = {
    transferRequestOffice: data.office,
    transferRequestDate: inventoryDisplayDate(data.date),
    transferRequestingInstitution: data.requestingInstitution,
    transferDestinationInstitution: data.destinationInstitution,
    transferPatientName: data.patientName,
    transferPatientAge: data.patientAge,
    transferHistoryNumber: data.patientHistory,
    transferPatientDocument: data.patientDocument,
    bloodGroup: data.patientBloodGroup,
    transferWard: data.ward,
    transferBed: data.bed,
    transferDiagnosis: data.diagnosis,
    transferTransfusionReason: data.transfusionReason,
    transferReason: data.transferReason,
  };
  return (
    <dl className={styles.summary}>
      {Object.entries(details).map(([key, value]) => (
        <div key={key}>
          <dt>{t(key)}</dt>
          <dd>{value || '—'}</dd>
        </div>
      ))}
    </dl>
  );
}
export function TransferRequestDocument({
  request,
  t,
  print = false,
}: {
  request: TransferRequest;
  t: ProcessingTranslate;
  print?: boolean;
}) {
  const data = request.data;
  return (
    <article className={styles.document} data-transfer-document>
      {print && (
        <>
          <style>{transferDocumentPrintCss}</style>
          <p data-demo>{t('printPrototype')}</p>
        </>
      )}
      <h2>EG05-FR09: {t('transferRequestDocument')}</h2>
      {request.status === 'draft' && <p>{t('transferDraftDocument')}</p>}
      {transferDirection(request) === 'outgoing' && <p>{t('transferOutgoingHelp')}</p>}
      <p>
        <strong>{t('transferAddressedDirector')}:</strong> {data.addressedDirector} — {data.destinationInstitution}
      </p>
      <p>
        <strong>{t('transferRequestingDirector')}:</strong> {data.requestingDirector} — {data.requestingInstitution}
      </p>
      <p>
        <strong>{t('transferAttention')}:</strong> {data.attention}
      </p>
      <p>{t('transferRequestIntroduction')}</p>
      <TransferSummary data={data} t={t} />
      <table aria-label={t('transferRequirement')}>
        <thead>
          <tr>
            {['fractionationComponent', 'transferQuantity', 'transferAcceptedGroup'].map((key) => (
              <th key={key}>{t(key)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.items.map((item) => (
            <tr key={item.id}>
              <td>{t(componentDefinitions[item.component].key)}</td>
              <td>{item.quantity}</td>
              <td>{item.bloodGroup || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>{t('transferTransportRequirements')}</h3>
      {data.maxCollectionAgeDays !== null && (
        <p>
          {t('transferAgeLimit')}: {data.maxCollectionAgeDays}
        </p>
      )}
      <p>{t('transferTransportInstructions')}</p>
      <p>{t('transferQualityRequirement')}</p>
      <footer>
        <p data-transfer-signature>
          {data.requestingDirector}
          <br />
          {t('transferDirectorSignature')}
        </p>
      </footer>
    </article>
  );
}
export function TransferCertificate({
  request,
  t,
  print = false,
}: {
  request: TransferRequest;
  t: ProcessingTranslate;
  print?: boolean;
}) {
  return (
    <article className={styles.document} data-transfer-document>
      {print && (
        <>
          <style>{transferDocumentPrintCss}</style>
          <p data-demo>{t('printPrototype')}</p>
        </>
      )}
      <h2>EG05-FR11: {t('transferCertificate')}</h2>
      <p>
        <strong>{t('transferDocumentOffice')}:</strong> {request.preparation.certificateOffice || '—'}
      </p>
      <p>
        <strong>{t('transferTo')}:</strong> {request.data.requestingDirector} — {request.data.requestingInstitution}
      </p>
      <p>
        <strong>{t('transferFrom')}:</strong> {request.data.addressedDirector} — {request.data.destinationInstitution}
        <br />
        {request.preparation.responsible}
      </p>
      <p>
        <strong>{t('transferAttention')}:</strong> {request.data.requestingAttention || '—'}
      </p>
      <p>
        <strong>{t('transferCertificateDate')}:</strong>{' '}
        {request.preparedAt ? formatDatetime(new Date(request.preparedAt), { noToday: true }) : '—'}
      </p>
      <p>{t('transferCertificateIntroduction')}</p>
      <p>
        {t('transferPatientName')}: {request.data.patientName} · {t('transferHistoryNumber')}:{' '}
        {request.data.patientHistory}
      </p>
      {request.status === 'rejected' ? (
        <p>
          {t('transferRejectedDocument')} {request.rejectionReason}
        </p>
      ) : request.status === 'delivered' ? (
        <p>{t('transferUnitTransferred')}</p>
      ) : (
        <p>{t('transferPendingDeliveryDocument')}</p>
      )}
      <table aria-label={t('transferCertificateUnits')}>
        <thead>
          <tr>
            {[
              'inventoryUnitNumber',
              'bagLot',
              'transferSeal',
              'inventoryAbo',
              'inventoryRh',
              'fractionationComponent',
              'transferCollectedOn',
            ].map((key) => (
              <th key={key}>{t(key)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {request.certificateUnits.map((unit) => (
            <tr key={unit.id}>
              <td>{unit.id}</td>
              <td>{unit.bagLot || '—'}</td>
              <td>{unit.sealId ? `${unit.sealId}/${unit.id}` : '—'}</td>
              <td>{unit.bloodGroup.replace(/[+−-]$/, '')}</td>
              <td>{/[+−-]$/.exec(unit.bloodGroup)?.[0]}</td>
              <td>{unit.componentType ? t(componentDefinitions[unit.componentType].key) : unit.component}</td>
              <td>{inventoryDisplayDate(unit.collectedOn)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>{t('transferScreeningResults')}</h3>
      <table aria-label={t('transferScreeningResults')}>
        <thead>
          <tr>
            <th>{t('inventoryUnitNumber')}</th>
            {screeningTests.map((test) => (
              <th key={test}>{t(test)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {request.certificateUnits.map((unit) => (
            <tr key={unit.id}>
              <td>{unit.id}</td>
              {screeningTests.map((test) => (
                <td key={test}>{unit.screening[test] ? t(unit.screening[test]) : '—'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <dl className={styles.summary}>
        <div>
          <dt>{t('transferResponsible')}</dt>
          <dd>{request.preparation.responsible}</dd>
        </div>
        <div>
          <dt>{t('transferCollectorName')}</dt>
          <dd>{request.delivery.collectorName || '—'}</dd>
        </div>
        <div>
          <dt>{t('transferCollectorDocument')}</dt>
          <dd>{request.delivery.collectorDocument || '—'}</dd>
        </div>
        <div>
          <dt>{t('transferDeliveredBy')}</dt>
          <dd>{request.delivery.deliveredBy || '—'}</dd>
        </div>
        <div>
          <dt>{t('transferPickupDate')}</dt>
          <dd>
            {request.pickupRecordedAt ? formatDatetime(new Date(request.pickupRecordedAt), { noToday: true }) : '—'}
          </dd>
        </div>
        <div>
          <dt>{t('transferDeliveryDate')}</dt>
          <dd>
            {request.deliveredAt
              ? formatDatetime(new Date(request.deliveredAt), { noToday: true })
              : t('transferAutomaticDate')}
          </dd>
        </div>
      </dl>
      <footer>
        <p data-transfer-signature>
          {request.preparation.responsible}
          <br />
          {t('transferResponsibleSignature')}
        </p>
        <p data-transfer-signature>
          {request.delivery.collectorName}
          <br />
          {t('transferCollectorSignature')}
        </p>
      </footer>
    </article>
  );
}
