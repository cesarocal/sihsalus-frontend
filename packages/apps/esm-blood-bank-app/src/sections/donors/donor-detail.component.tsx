import { Button, InlineNotification, SkeletonText } from '@carbon/react';
import { Add, ArrowLeft } from '@carbon/react/icons';
import { useCallback, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { BloodBankApi } from '../../api';
import { bloodBankPrivileges } from '../../access/blood-bank-privileges';
import { ProtectedSection } from '../../access/protected-section.component';
import { applicantSelectionPath, donorsPath } from '../../constants';
import { BloodBankPageIllustration } from '../../shared/blood-bank-page-illustration.component';
import { BloodBankPageHeader } from '../../shared/blood-bank-page-header.component';
import { ProcessingTable, useProcessingData, useProcessingTranslation } from '../../shared/processing-page.component';
import { donorApplicationState } from '../applicant-selection/donor-application';
import { donorStatusKey, formatDonorDate } from './donor-utils';
import { DonationHistoryTable } from './donation-history-table.component';
import styles from '../applicant-selection/selection.scss';

export function DonorDetailPage({ api }: { api: BloodBankApi }) {
  const t = useProcessingTranslation();
  const { donorId = '' } = useParams<{ donorId: string }>();
  const navigate = useNavigate();
  const load = useCallback(async () => {
    const donor = await api.getDonorDetail(donorId);
    if (donor.summary.id !== donorId) throw new Error('DONOR_IDENTITY_MISMATCH');
    return donor;
  }, [api, donorId]);
  const { data, loading, failed, reload } = useProcessingData(load);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!loading && !failed) heading.current?.focus();
  }, [loading, failed]);
  const field = (key: string, value: string | undefined) => (
    <div key={key}>
      <dt>{t(key)}</dt>
      <dd>{value || t('notRecorded')}</dd>
    </div>
  );
  return (
    <div className={styles.page}>
      <h1 className="cds--visually-hidden">{t('donorDetail')}</h1>
      <BloodBankPageHeader
        title={t('donorDetail')}
        illustration={<BloodBankPageIllustration section="donors" />}
        actions={
          <Button kind="tertiary" size="sm" renderIcon={ArrowLeft} onClick={() => void navigate(donorsPath)}>
            {t('backToDonorList')}
          </Button>
        }
      />
      <div className={styles.content}>
        {loading ? (
          <SkeletonText paragraph lineCount={8} />
        ) : failed || !data ? (
          <div className={styles.empty}>
            <InlineNotification hideCloseButton kind="error" title={t('loadFailed')} subtitle={t('loadFailedHelp')} />
            <Button kind="tertiary" onClick={reload}>
              {t('retry')}
            </Button>
          </div>
        ) : (
          <>
            <section className={`${styles.report} ${styles.donorPersonalData}`} aria-label={t('personalData')}>
              <h2 ref={heading} tabIndex={-1}>
                {t('personalData')}
              </h2>
              <dl>
                {field('donorName', data.summary.fullName)}
                {field('donorCode', data.summary.id)}
                {field('document', `${data.documentType} ${data.summary.documentNumber}`)}
                {field('bloodGroup', data.summary.bloodGroup)}
                {field('birthDate', data.personal?.birthDate ? formatDonorDate(data.personal.birthDate) : '')}
                {field('sex', data.personal?.sex ? t(data.personal.sex === 'F' ? 'female' : 'male') : '')}
                {field('address', data.personal?.address)}
                {field('district', data.personal?.district)}
                {field('phone', data.personal?.mobile || data.personal?.phone)}
                {field('email', data.personal?.email)}
                {field('lastDonation', formatDonorDate(data.summary.lastDonationDate))}
                {field('status', t(donorStatusKey[data.summary.status]))}
              </dl>
            </section>
            <section aria-label={t('donationHistory')} className={styles.donationHistory}>
              <div className={styles.listHeading}>
                <h2>{t('donationHistory')}</h2>
                <ProtectedSection privilege={bloodBankPrivileges.applicantSelection} hideUnauthorized>
                  <Button
                    renderIcon={Add}
                    onClick={() =>
                      void navigate(applicantSelectionPath, { state: donorApplicationState(data.summary.id) })
                    }
                  >
                    {t('registerDonation')}
                  </Button>
                </ProtectedSection>
              </div>
              <DonationHistoryTable key={data.summary.id} donations={data.donations} reload={reload} t={t} />
            </section>
            <section aria-label={t('adverseReactionHistory')} className={styles.donationHistory}>
              <div className={styles.listHeading}>
                <h2>{t('adverseReactionHistory')}</h2>
              </div>
              <div className={styles.surface}>
                <ProcessingTable
                  title={t('adverseReactionHistory')}
                  columns={['date', 'unitCode', 'reactionType', 'reactionSeverity']}
                  rows={data.adverseReactions.map((record) => ({
                    id: record.id,
                    cells: [
                      formatDonorDate(record.date),
                      record.unitCode,
                      t(`reaction_${record.reaction}`),
                      t(`severity_${record.severity}`),
                    ],
                  }))}
                  loading={false}
                  failed={false}
                  reload={reload}
                  emptyHelp={t('emptyAdverseReactions')}
                  t={t}
                />
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
