import { BloodBankPictogram, LaboratoryPictogram, PatientsPictogram, UserFollowIcon } from '@openmrs/esm-framework';
import styles from '../sections/applicant-selection/selection.scss';

export type BloodBankIllustration = 'donors' | 'selection' | 'collection' | 'screening';

/** Only the blood-bank page headers are customized; the shared navigation is unchanged. */
export function BloodBankPageIllustration({ section }: { section: BloodBankIllustration }) {
  return (
    <span className={styles.headerIllustration} aria-hidden="true">
      {section === 'donors' && <PatientsPictogram />}
      {section === 'selection' && <UserFollowIcon size={64} className={styles.selectionIllustration} />}
      {section === 'collection' && <BloodBankPictogram />}
      {section === 'screening' && <LaboratoryPictogram />}
    </span>
  );
}
