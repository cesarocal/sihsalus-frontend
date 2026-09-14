import RecentPatientsPreview from './compact-patient-search/recent-patients-preview.component';
import { useRestPatients } from './patient-search.resource';
import { useRecentlyViewedPatients } from './recently-viewed-patients.store';

export default function RecentlyViewedPatients() {
  const { recentlyViewedPatientUuids } = useRecentlyViewedPatients(true);
  const response = useRestPatients(recentlyViewedPatientUuids);
  return <RecentPatientsPreview {...response} />;
}
