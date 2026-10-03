import { applicationsMock } from '../../mocks/applicant-selection.mock';
import type { SelectionApplication } from './selection.types';

export function validApplication(): SelectionApplication {
  const application = applicationsMock()[2];
  return { ...application, id: '', number: '', revision: 0, status: 'draft', completedSteps: [], updatedAt: '' };
}
