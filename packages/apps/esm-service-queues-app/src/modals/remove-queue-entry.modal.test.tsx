import { type FetchResponse } from '@openmrs/esm-framework';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockQueueEntryAlice } from 'test-utils';
import { type QueueEntry } from '../types';
import { endQueueEntry } from './queue-entry-actions.resource';
import RemoveQueueEntryModal from './remove-queue-entry.modal';

vi.mock('./queue-entry-actions.resource', () => ({ endQueueEntry: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

it('explains that completing a queue step does not discharge the patient or finish the appointment', async () => {
  const user = userEvent.setup();
  const closeModal = vi.fn();
  vi.mocked(endQueueEntry).mockResolvedValue({ status: 200 } as FetchResponse<QueueEntry>);
  render(<RemoveQueueEntryModal queueEntry={mockQueueEntryAlice} closeModal={closeModal} completeCare />);
  expect(screen.getByText(/La consulta, la cita y el egreso clínico se gestionan por separado/)).toBeInTheDocument();
  expect(endQueueEntry).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Finalizar en cola' }));
  await waitFor(() => expect(closeModal).toHaveBeenCalledTimes(1));
  expect(endQueueEntry).toHaveBeenCalledExactlyOnceWith(mockQueueEntryAlice.uuid);
});

it('leaves the queue unchanged when completion is cancelled', async () => {
  const user = userEvent.setup();
  const closeModal = vi.fn();
  render(<RemoveQueueEntryModal queueEntry={mockQueueEntryAlice} closeModal={closeModal} completeCare />);
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(closeModal).toHaveBeenCalledTimes(1);
  expect(endQueueEntry).not.toHaveBeenCalled();
});

it('preserves the existing removal dialog for other queues', () => {
  render(<RemoveQueueEntryModal queueEntry={mockQueueEntryAlice} closeModal={vi.fn()} />);
  expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Finalizar en cola' })).not.toBeInTheDocument();
});
