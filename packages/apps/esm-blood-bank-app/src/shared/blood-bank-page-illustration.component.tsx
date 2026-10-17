import { Fork, IbmDevopsTest, Movement, RainDrop } from '@carbon/react/icons';
import {
  BloodBankPictogram,
  LaboratoryPictogram,
  PatientsPictogram,
  StockManagementPictogram,
  UserFollowIcon,
} from '@openmrs/esm-framework';
import styles from '../sections/applicant-selection/selection.scss';

export type BloodBankIllustration =
  | 'donors'
  | 'selection'
  | 'collection'
  | 'screening'
  | 'fractionation'
  | 'inventory'
  | 'transfers'
  | 'transfusions'
  | 'compatibility';

/** Only the blood-bank page headers are customized; the shared navigation is unchanged. */
export function BloodBankPageIllustration({ section }: { section: BloodBankIllustration }) {
  return (
    <span className={styles.headerIllustration} aria-hidden="true">
      {section === 'donors' && <PatientsPictogram />}
      {section === 'selection' && <UserFollowIcon size={64} className={styles.selectionIllustration} />}
      {section === 'collection' && <BloodBankPictogram />}
      {section === 'screening' && <LaboratoryPictogram />}
      {section === 'fractionation' && <Fork size={64} className={styles.selectionIllustration} />}
      {section === 'inventory' && <StockManagementPictogram />}
      {section === 'transfers' && <Movement size={64} className={styles.selectionIllustration} />}
      {section === 'transfusions' && <RainDrop size={64} className={styles.selectionIllustration} />}
      {section === 'compatibility' && <IbmDevopsTest size={64} className={styles.selectionIllustration} />}
    </span>
  );
}
