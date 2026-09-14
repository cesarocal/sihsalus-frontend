import { launchWorkspace2, useAppContext } from '@openmrs/esm-framework';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithSwr } from 'test-utils';
import { mockWardViewContext } from '../../test-utils/mock';
import { type WardViewContext } from '../types';
import AdmissionRequestsBar from './admission-requests-bar.component';

const mockUseAppContext = vi.mocked(useAppContext<WardViewContext>);
const mockLaunchWorkspace = vi.mocked(launchWorkspace2);
const defaultRequestResponse = mockWardViewContext.wardPatientGroupDetails.inpatientRequestResponse;

function setRequestResponse(overrides: Partial<typeof defaultRequestResponse>) {
  mockUseAppContext.mockReturnValue({
    ...mockWardViewContext,
    wardPatientGroupDetails: {
      ...mockWardViewContext.wardPatientGroupDetails,
      inpatientRequestResponse: { ...defaultRequestResponse, ...overrides },
    },
  });
}

describe('Admission Requests Button', () => {
  beforeEach(() => {
    setRequestResponse({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should launch workspace when clicked on manage button', async () => {
    const user = userEvent.setup();
    const wardPendingPatients = <div>Pending admissions</div>;
    renderWithSwr(<AdmissionRequestsBar wardPendingPatients={wardPendingPatients} />);

    await user.click(screen.getByRole('button', { name: /manage/i }));
    expect(mockLaunchWorkspace).toHaveBeenCalledExactlyOnceWith(
      'admission-requests-workspace',
      { wardPendingPatients },
      { startVisitWorkspaceName: 'ward-app-start-visit-workspace' },
    );
  });

  it('should have one admission request', () => {
    renderWithSwr(<AdmissionRequestsBar wardPendingPatients={[<div key="dummy-patient">Dummy Patient</div>]} />);

    expect(screen.getByText('1 admission request')).toBeInTheDocument();
  });

  it.each([
    { state: 'without data', inpatientRequests: undefined, isLoading: false },
    { state: 'while retrying without data', inpatientRequests: undefined, isLoading: true },
    { state: 'with cached data', inpatientRequests: defaultRequestResponse.inpatientRequests, isLoading: false },
  ])('shows a safe error $state', ({ inpatientRequests, isLoading }) => {
    const error = new Error('SYNTHETIC_ADMISSION_REQUEST_FAILURE');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    setRequestResponse({ inpatientRequests, isLoading, error });

    renderWithSwr(<AdmissionRequestsBar wardPendingPatients={[]} />);

    expect(screen.getByRole('status')).toHaveTextContent('Error loading patient admission requests');
    expect(screen.queryByText(error.message)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /manage/i })).not.toBeInTheDocument();
    expect(mockLaunchWorkspace).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it.each([
    { inpatientRequests: undefined },
    { inpatientRequests: defaultRequestResponse.inpatientRequests },
  ])('hides actions while loading', ({ inpatientRequests }) => {
    setRequestResponse({ inpatientRequests, isLoading: true, error: undefined });

    const { container } = renderWithSwr(<AdmissionRequestsBar wardPendingPatients={[]} />);

    expect(container).toBeEmptyDOMElement();
    expect(mockLaunchWorkspace).not.toHaveBeenCalled();
  });

  it('shows zero requests and keeps management available for a successful empty response', async () => {
    setRequestResponse({ inpatientRequests: [], isLoading: false, error: undefined });
    const user = userEvent.setup();
    const wardPendingPatients = <div>No pending admissions</div>;
    renderWithSwr(<AdmissionRequestsBar wardPendingPatients={wardPendingPatients} />);

    expect(screen.getByText('0 admission request')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /manage/i }));
    expect(mockLaunchWorkspace).toHaveBeenCalledExactlyOnceWith(
      'admission-requests-workspace',
      { wardPendingPatients },
      { startVisitWorkspaceName: 'ward-app-start-visit-workspace' },
    );
  });
});
