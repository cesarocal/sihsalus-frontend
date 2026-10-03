import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import spanish from '../../translations/es.json';
import { ExitConfirmation, type ExitSaveResult } from './exit-confirmation.component';

const t = (key: string) => (spanish.processing as Record<string, string>)[key] ?? key;
const props = () => ({
  title: t('exitTitle'),
  description: t('exitHelp'),
  closeLabel: 'Cerrar confirmación',
  saving: false,
  saveErrorText: t('collectionSaveFailed'),
  t,
  onCancel: vi.fn(),
  onSave: vi.fn().mockResolvedValue('saved'),
  onExit: vi.fn(),
});
describe('two-action exit confirmation', () => {
  it('has two footer choices and saves progress by default before exiting', async () => {
    const callbacks = props();
    render(<ExitConfirmation {...callbacks} />);
    expect(screen.getByLabelText(t('saveBeforeExit'))).toBeChecked();
    const footer = document.querySelector('.cds--modal-footer');
    if (!footer) throw new Error('Missing modal footer');
    expect(
      within(footer as HTMLElement)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Seguir editando', 'Salir']);
    fireEvent.click(screen.getByRole('button', { name: 'Salir' }));
    await waitFor(() => expect(callbacks.onExit).toHaveBeenCalledWith('saved'));
    expect(callbacks.onSave).toHaveBeenCalledOnce();
  });
  it('does not save when discard is explicitly chosen', () => {
    const callbacks = props();
    render(<ExitConfirmation {...callbacks} />);
    fireEvent.click(screen.getByLabelText(t('saveBeforeExit')));
    fireEvent.click(screen.getByRole('button', { name: /Salir$/ }));
    expect(callbacks.onExit).toHaveBeenCalledWith('discarded');
    expect(callbacks.onSave).not.toHaveBeenCalled();
  });
  it('returns to the workflow without saving or exiting when Keep editing is chosen', () => {
    const callbacks = props();
    render(<ExitConfirmation {...callbacks} />);
    fireEvent.click(screen.getByRole('button', { name: 'Seguir editando' }));
    expect(callbacks.onCancel).toHaveBeenCalledOnce();
    expect(callbacks.onExit).not.toHaveBeenCalled();
    expect(callbacks.onSave).not.toHaveBeenCalled();
  });
  it('does not exit when the workflow reports a save failure', async () => {
    const callbacks = props();
    callbacks.onSave.mockResolvedValue('failed');
    render(<ExitConfirmation {...callbacks} />);
    fireEvent.click(screen.getByRole('button', { name: 'Salir' }));
    await waitFor(() => expect(callbacks.onCancel).toHaveBeenCalledOnce());
    expect(callbacks.onExit).not.toHaveBeenCalled();
  });
  it('keeps an unexpectedly rejected save recoverable and hides backend details', async () => {
    const callbacks = props();
    callbacks.onSave.mockRejectedValue(new Error('PRIVATE_SAVE_TRACE'));
    render(<ExitConfirmation {...callbacks} />);
    fireEvent.click(screen.getByRole('button', { name: 'Salir' }));
    expect(await screen.findByText(t('collectionSaveFailed'))).toBeInTheDocument();
    expect(screen.queryByText('PRIVATE_SAVE_TRACE')).not.toBeInTheDocument();
    expect(callbacks.onExit).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Salir' })).toBeEnabled();
    callbacks.onSave.mockResolvedValue('saved');
    fireEvent.click(screen.getByRole('button', { name: 'Salir' }));
    await waitFor(() => expect(callbacks.onExit).toHaveBeenCalledWith('saved'));
  });
  it('blocks duplicate saves and all closing paths while saving is pending', async () => {
    const callbacks = props();
    let finish: (saved: ExitSaveResult) => void = () => {
      throw new Error('No pending save');
    };
    callbacks.onSave.mockImplementation(
      () =>
        new Promise<ExitSaveResult>((resolve) => {
          finish = resolve;
        }),
    );
    render(<ExitConfirmation {...callbacks} />);
    fireEvent.click(screen.getByRole('button', { name: 'Salir' }));
    expect(screen.getByLabelText(t('saveBeforeExit'))).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Seguir editando' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar confirmación' }));
    expect(callbacks.onCancel).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: t('saving') }));
    expect(callbacks.onSave).toHaveBeenCalledOnce();
    expect(callbacks.onExit).not.toHaveBeenCalled();
    await act(async () => {
      finish('saved');
    });
    expect(callbacks.onExit).toHaveBeenCalledWith('saved');
  });
  it('distinguishes an unchanged close from a confirmed write', async () => {
    const callbacks = props();
    callbacks.onSave.mockResolvedValue('unchanged');
    render(<ExitConfirmation {...callbacks} />);
    fireEvent.click(screen.getByRole('button', { name: 'Salir' }));
    await waitFor(() => expect(callbacks.onExit).toHaveBeenCalledWith('unchanged'));
  });
  it('starts with saving enabled again after the confirmation is cancelled and reopened', () => {
    const callbacks = props();
    const view = render(<ExitConfirmation {...callbacks} />);
    fireEvent.click(screen.getByLabelText(t('saveBeforeExit')));
    expect(screen.getByLabelText(t('saveBeforeExit'))).not.toBeChecked();
    view.unmount();
    render(<ExitConfirmation {...callbacks} />);
    expect(screen.getByLabelText(t('saveBeforeExit'))).toBeChecked();
  });
});
