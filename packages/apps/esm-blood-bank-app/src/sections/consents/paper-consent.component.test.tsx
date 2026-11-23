import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';
import { transfusionRequestsMock } from '../../mocks/transfusions.mock';
import { printDocument } from '../../shared/print-document';
import { PaperConsentEditor } from './paper-consent.component';
import { type ConsentSubject, listConsent, recipientConsentSubject, saveConsent } from './paper-consent.resource';

const metadata = vi.hoisted(() => ({ recipientEncounterTypeUuid: 'fr12' }));
const provider = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
vi.mock('@openmrs/esm-framework', () => ({
  useConfig: () => ({ paperConsent: metadata }),
  useSession: () => ({ authenticated: true, currentProvider: { uuid: provider } }),
  userHasAccess: () => true,
  showSnackbar: vi.fn(),
}));
vi.mock(import('./paper-consent.resource'), async (load) => ({
  ...(await load()),
  listConsent: vi.fn(),
  saveConsent: vi.fn(),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }) }));
vi.mock('../../shared/print-document', () => ({ printDocument: vi.fn() }));

const [request] = transfusionRequestsMock();
const recipient = recipientConsentSubject({
  ...request.order,
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  patientId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  encounterId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  sex: 'F',
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listConsent).mockResolvedValue([]);
});

it('prints the FR12 layout with recipient demographics and leaves the paper decision unsigned', () => {
  render(<PaperConsentEditor subject={recipient} />);
  fireEvent.click(screen.getByRole('button', { name: 'Imprimir consentimiento' }));
  const [content, title, , css] = vi.mocked(printDocument).mock.lastCall ?? [];
  const markup = renderToStaticMarkup(content);

  expect(title).toBe('EG05 - FR12: Consentimiento informado del receptor');
  expect(css).toContain('size: A4');
  expect(markup).toContain('data-fr12');
  expect(markup).toContain('35 años');
  expect(markup).toContain(recipient.identification);
  expect(markup).not.toContain(recipient.number);
  expect(markup).toContain('<span class="fr12-mark">×</span>Femenino');
  expect(markup).toContain('Huella digital');
  expect(markup).toContain('Autorizo la transfusión');
  expect(markup).toContain('Revoco mi consentimiento');
  expect(markup).toContain('Firma y sello del médico solicitante');
  expect(markup).not.toMatch(/folio/i);
  expect(markup.match(/class="fr12-digit"/g)).toHaveLength(6);
});

it('preserves the original FR05 print when the subject is a prospective donor', () => {
  const donor: ConsentSubject = { ...recipient, kind: 'donor', number: 'QA-001' };
  render(<PaperConsentEditor subject={donor} />);
  fireEvent.click(screen.getByRole('button', { name: 'Imprimir EG05-FR05' }));
  const [content, title, , css] = vi.mocked(printDocument).mock.lastCall ?? [];
  const markup = renderToStaticMarkup(content);

  expect(title).toContain('EG05-FR05');
  expect(css).toBeUndefined();
  expect(markup).toContain('Número de postulante');
  expect(markup).not.toContain('data-fr12');
});

it('keeps the FR12 save locked until printing is requested and the signature is verified', async () => {
  render(<PaperConsentEditor subject={recipient} />);
  const formDecision = screen.getByRole('combobox', { name: 'Decisión' });
  await waitFor(() => expect(formDecision).toBeEnabled());
  fireEvent.change(formDecision, { target: { value: 'granted' } });
  const save = screen.getByRole('button', { name: 'Guardar decisión' });
  const verify = screen.getByRole('checkbox', { name: 'Verifiqué la firma del documento y la decisión registrada.' });
  expect(screen.getByLabelText('Fecha y hora de firma')).toBeEnabled();
  expect(screen.queryByLabelText(/folio/i)).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Actualizar estado' })).not.toBeInTheDocument();
  expect(verify).toBeDisabled();
  expect(save).toBeDisabled();

  const print = screen.getByRole('button', { name: 'Imprimir consentimiento' });
  fireEvent.click(print);
  expect(save).toBeDisabled();
  // A failed print does not unlock verification or saving.
  act(() => vi.mocked(printDocument).mock.lastCall?.[2]?.());
  expect(verify).toBeDisabled();
  expect(save).toBeDisabled();
  fireEvent.click(print);
  act(() => vi.mocked(printDocument).mock.lastCall?.[4]?.());
  expect(save).toBeDisabled();
  fireEvent.click(verify);
  expect(save).toBeEnabled();
  fireEvent.click(save);

  await waitFor(() => expect(saveConsent).toHaveBeenCalledTimes(1));
  const [, subject, decision, issuer] = vi.mocked(saveConsent).mock.calls[0];
  expect(subject).toBe(recipient);
  expect(issuer).toBe(provider);
  expect(decision).toMatchObject({ decision: 'granted', signerRole: 'self' });
  expect(decision).not.toHaveProperty('folio');
  await waitFor(() => expect(verify).toBeDisabled());
});
