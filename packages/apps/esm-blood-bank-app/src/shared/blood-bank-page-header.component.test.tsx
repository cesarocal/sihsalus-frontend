import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BloodBankHeaderContext, BloodBankPageHeader } from './blood-bank-page-header.component';

const session = vi.hoisted(() => ({
  current: { sessionLocation: { display: 'Ubicación de prueba' } } as
    | {
        sessionLocation?: { display: string };
      }
    | undefined,
}));
vi.mock('@openmrs/esm-framework', () => ({
  useSession: () => session.current,
  formatDatetime: (date: Date) => date.toISOString(),
  PageHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  PageHeaderContent: ({ title, illustration }: { title: string; illustration: ReactNode }) => (
    <div>
      {illustration}
      {title}
    </div>
  ),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }) }));

describe('blood bank header context', () => {
  afterEach(() => {
    vi.useRealTimers();
    session.current = { sessionLocation: { display: 'Ubicación de prueba' } };
  });
  it('shows the actual session location, a machine-readable date/time, and header actions', () => {
    render(
      <BloodBankPageHeader title="Donantes" illustration={<svg />} actions={<button type="button">Volver</button>} />,
    );
    expect(screen.getByText('Ubicación de prueba')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Volver' }).closest('header')).toBeInTheDocument();
    const time = document.querySelector('time');
    expect(time?.dateTime).toBe(time?.textContent);
    expect(time?.dateTime).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
  it('refreshes time while the page stays open and cleans up its timer on unmount', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-03T18:47:00Z'));
    const view = render(<BloodBankHeaderContext />);
    expect(screen.getByText('2026-10-03T18:47:00.000Z')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByText('2026-10-03T18:48:00.000Z')).toBeInTheDocument();
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('updates when the active session location changes and does not invent a location while session loads', () => {
    session.current = undefined;
    const view = render(<BloodBankHeaderContext />);
    expect(screen.getByText('Ubicación no disponible')).toBeInTheDocument();
    session.current = { sessionLocation: { display: 'Otra ubicación de prueba' } };
    view.rerender(<BloodBankHeaderContext />);
    expect(screen.getByText('Otra ubicación de prueba')).toBeInTheDocument();
    expect(screen.queryByText('Ubicación no disponible')).not.toBeInTheDocument();
  });
});
