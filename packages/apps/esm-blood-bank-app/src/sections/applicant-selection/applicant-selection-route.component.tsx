import type { DashboardShortcut } from '../dashboard/dashboard-shortcuts';
import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { BloodBankApi } from '../../api';
import { bloodBankPrivileges } from '../../access/blood-bank-privileges';
import { ProtectedSection } from '../../access/protected-section.component';
import { ApplicantSelectionPage } from './applicant-selection-page.component';
import { donorIdFromNavigationState } from './donor-application';

export function ApplicantSelectionRoute({ api, shortcut }: { api: BloodBankApi; shortcut?: DashboardShortcut }) {
  const location = useLocation();
  const navigate = useNavigate();
  const consumeDonorRequest = useCallback(() => {
    void navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null });
  }, [navigate, location.pathname, location.search]);
  const donorId = donorIdFromNavigationState(location.state);
  const page = (
    <ApplicantSelectionPage
      shortcut={shortcut}
      api={api.selection}
      initialDonorId={donorId}
      loadDonor={api.getDonorDetail}
      onDonorRequestConsumed={consumeDonorRequest}
    />
  );
  return (
    <ProtectedSection privilege={donorId ? bloodBankPrivileges.donors : bloodBankPrivileges.applicantSelection}>
      {page}
    </ProtectedSection>
  );
}
