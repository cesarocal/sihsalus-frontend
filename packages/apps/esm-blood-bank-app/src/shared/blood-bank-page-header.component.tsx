import { Calendar, Location } from '@carbon/react/icons';
import { formatDatetime, PageHeader, PageHeaderContent, useSession } from '@openmrs/esm-framework';
import { useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { moduleName } from '../constants';
import styles from '../sections/applicant-selection/selection.scss';

/** Uses the active OpenMRS location, never a fixed hospital or a donor's location. */
export function BloodBankHeaderContext() {
  const session = useSession();
  const { t } = useTranslation(moduleName);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <div className={styles.headerContext}>
      <span className={styles.headerContextItem}>
        <Location size={16} aria-hidden="true" />
        <span>{session?.sessionLocation?.display || t('locationUnavailable', 'Ubicación no disponible')}</span>
      </span>
      <span className={styles.headerSeparator} aria-hidden="true">
        ·
      </span>
      <span className={styles.headerContextItem}>
        <Calendar size={16} aria-hidden="true" />
        <time dateTime={now.toISOString()}>{formatDatetime(now, { noToday: true })}</time>
      </span>
    </div>
  );
}

export function BloodBankPageHeader({
  title,
  illustration,
  actions,
}: {
  title: string;
  illustration: ReactElement;
  actions?: ReactNode;
}) {
  return (
    <PageHeader className={`${styles.pageHeader} ${styles.sectionHeader}`}>
      <PageHeaderContent title={title} illustration={illustration} />
      <div className={styles.headerRight}>
        <BloodBankHeaderContext />
        {actions}
      </div>
    </PageHeader>
  );
}
