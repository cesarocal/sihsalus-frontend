import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
} from '@carbon/react';
import { ArrowLeft } from '@carbon/react/icons';
import { useTranslation } from 'react-i18next';

import { moduleName } from './constants';
import { donors } from './prototype-data';
import type { DonorRecord } from './types';
import styles from './root.scss';

const donorHeaders = ['donorCode', 'fullName', 'document', 'bloodGroup', 'lastDonation', 'donationCount', 'donorStatus', 'actions'];
const traceHeaders = ['donationEpisode', 'donationDate', 'donationType', 'procedure', 'volume', 'unitCode', 'components', 'donationStatus', 'responsible', 'observation'];

export function Donors({ onSelectDonor }: { onSelectDonor: (donorId: string) => void }) {
  const { t } = useTranslation(moduleName);

  return (
    <div className={styles.pageStack}>
      <section className={styles.sectionHeading}>
        <div>
          <p className={styles.eyebrow}>{t('donorDirectory', 'Registro maestro')}</p>
          <h2>{t('donors', 'Donantes')}</h2>
          <p>{t('donorsDescription', 'Personas registradas y trazabilidad de sus donaciones.')}</p>
        </div>
        <Tag type="cyan">{t('syntheticDonorData', 'Datos sintéticos')}</Tag>
      </section>

      <section className={styles.sectionCard}>
        <TableContainer title={t('donorDirectory', 'Registro de donantes')}>
          <Table size="md" useZebraStyles>
            <TableHead>
              <TableRow>{donorHeaders.map((header) => <TableHeader key={header}>{t(header, header)}</TableHeader>)}</TableRow>
            </TableHead>
            <TableBody>
              {donors.map((donor) => (
                <TableRow key={donor.id}>
                  <TableCell><strong>{donor.donorCode}</strong></TableCell>
                  <TableCell>{donor.familyName}, {donor.givenName}</TableCell>
                  <TableCell>{donor.documentType} {donor.documentNumber}</TableCell>
                  <TableCell>{donor.bloodGroup}{donor.rhFactor}</TableCell>
                  <TableCell>{donor.lastDonationDate}</TableCell>
                  <TableCell>{donor.donationCount}</TableCell>
                  <TableCell><Tag type="green">{donor.status}</Tag></TableCell>
                  <TableCell><Button kind="ghost" size="sm" onClick={() => onSelectDonor(donor.id)}>{t('viewDetails', 'Ver detalle')}</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </section>
    </div>
  );
}

export function DonorDetail({ donor, onBack }: { donor: DonorRecord; onBack: () => void }) {
  const { t } = useTranslation(moduleName);
  const personalData = [
    [t('fullName', 'Nombre completo'), `${donor.familyName}, ${donor.givenName}`],
    [t('document', 'Documento'), `${donor.documentType} ${donor.documentNumber}`],
    [t('sex', 'Sexo'), donor.sex],
    [t('birthDate', 'Fecha de nacimiento'), donor.birthDate],
    [t('phone', 'Teléfono'), donor.phone],
    [t('address', 'Domicilio'), donor.address],
    [t('placeOfBirth', 'Lugar de nacimiento'), donor.placeOfBirth],
    [t('origin', 'Procedencia'), donor.origin],
    [t('district', 'Distrito'), donor.district],
    [t('province', 'Provincia'), donor.province],
    [t('department', 'Departamento'), donor.department],
    [t('civilStatus', 'Estado civil'), donor.civilStatus],
    [t('occupation', 'Ocupación'), donor.occupation],
    [t('email', 'Correo electrónico'), donor.email],
    [t('workplace', 'Centro de trabajo'), donor.workplace],
    [t('permanence', 'Permanencia'), donor.permanence],
  ];

  return (
    <div className={styles.pageStack}>
      <Button kind="ghost" renderIcon={ArrowLeft} onClick={onBack}>{t('backToDonors', 'Volver a donantes')}</Button>
      <section className={styles.sectionHeading}>
        <div>
          <p className={styles.eyebrow}>{donor.donorCode}</p>
          <h2>{donor.familyName}, {donor.givenName}</h2>
          <p>{t('donorDetailDescription', 'Datos personales registrados y trazabilidad completa de donaciones.')}</p>
        </div>
        <Tag type="green">{donor.status}</Tag>
      </section>

      <section className={styles.sectionCard}>
        <h3>{t('donorPersonalData', 'Datos personales')}</h3>
        <div className={styles.reviewGrid}>
          {personalData.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
        </div>
      </section>

      <section className={`${styles.sectionCard} ${styles.donorTraceTable}`}>
        <h3>{t('donorTraceability', 'Trazabilidad de donaciones')}</h3>
        <p className={styles.muted}>{t('donorTraceabilityDescription', 'Historial de procedimientos, unidades y responsables asociados.')}</p>
        <TableContainer>
          <Table size="sm" useZebraStyles>
            <TableHead><TableRow>{traceHeaders.map((header) => <TableHeader key={header}>{t(header, header)}</TableHeader>)}</TableRow></TableHead>
            <TableBody>
              {donor.donations.map((donation) => (
                <TableRow key={donation.id}>
                  <TableCell>{donation.id}</TableCell>
                  <TableCell>{donation.date}</TableCell>
                  <TableCell>{donation.donationType}</TableCell>
                  <TableCell>{donation.procedure}</TableCell>
                  <TableCell>{donation.volume}</TableCell>
                  <TableCell>{donation.unitCode}</TableCell>
                  <TableCell>{donation.components}</TableCell>
                  <TableCell><Tag type="blue">{donation.status}</Tag></TableCell>
                  <TableCell>{donation.responsible}</TableCell>
                  <TableCell>{donation.observation}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </section>
    </div>
  );
}
