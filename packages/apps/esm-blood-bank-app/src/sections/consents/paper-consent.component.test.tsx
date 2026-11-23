import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';
import { transfusionRequestsMock } from '../../mocks/transfusions.mock';
import { printDocument } from '../../shared/print-document';
import { PaperConsentEditor } from './paper-consent.component';
import {
  type ConsentRecord,
  type ConsentSubject,
  listConsent,
  recipientConsentSubject,
  saveConsent,
} from './paper-consent.resource';

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

const savedConsent: ConsentRecord = {
  uuid: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  decision: 'granted',
  decidedAt: new Date(2026, 10, 20, 15, 30).toISOString(),
  recordedAt: new Date(2026, 10, 20, 15, 31).toISOString(),
  signer: 'Carmen López Flores',
  signerRole: 'representative',
  provider,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listConsent).mockResolvedValue([]);
});

it('prints the FR12 with the saved decision, signature date, and representative', async () => {
  vi.mocked(listConsent).mockResolvedValue([savedConsent]);
  render(<PaperConsentEditor subject={recipient} />);
  const print = screen.getByRole('button', { name: 'Imprimir consentimiento' });
  await waitFor(() => expect(print).toBeEnabled());
  fireEvent.click(print);
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
  expect(markup).toContain('<span class="fr12-mark">×</span>Autorizo la transfusión');
  expect(markup).toContain('<span class="fr12-mark"></span>Revoco mi consentimiento');
  expect(markup).toContain('class="fr12-representative">Carmen López Flores');
  expect(markup).toContain('Firma y sello del médico solicitante');
  expect(markup).not.toMatch(/folio/i);
  expect(Array.from(markup.matchAll(/class="fr12-digit">([0-9])</g), ([, digit]) => digit).join('')).toBe('201126');
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

it('enables printing only after the FR12 decision is verified and saved', async () => {
  vi.mocked(saveConsent).mockImplementationOnce(async () => {
    vi.mocked(listConsent).mockResolvedValue([savedConsent]);
    return savedConsent;
  });
  render(<PaperConsentEditor subject={recipient} />);
  const formDecision = screen.getByRole('combobox', { name: 'Decisión' });
  await waitFor(() => expect(formDecision).toBeEnabled());
  fireEvent.change(formDecision, { target: { value: 'granted' } });
  const save = screen.getByRole('button', { name: 'Guardar decisión' });
  const verify = screen.getByRole('checkbox', { name: 'Verifiqué la firma del documento y la decisión registrada.' });
  expect(screen.getByLabelText('Fecha y hora de firma')).toBeEnabled();
  expect(screen.queryByLabelText(/folio/i)).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Actualizar estado' })).not.toBeInTheDocument();
  const print = screen.getByRole('button', { name: 'Imprimir consentimiento' });
  expect(verify).toBeEnabled();
  expect(save).toBeDisabled();
  expect(print).toBeDisabled();
  fireEvent.click(print);
  expect(printDocument).not.toHaveBeenCalled();
  fireEvent.click(verify);
  expect(save).toBeEnabled();
  fireEvent.click(save);

  await waitFor(() => expect(saveConsent).toHaveBeenCalledTimes(1));
  const [, subject, decision, issuer] = vi.mocked(saveConsent).mock.calls[0];
  expect(subject).toBe(recipient);
  expect(issuer).toBe(provider);
  expect(decision).toMatchObject({ decision: 'granted', signerRole: 'self' });
  expect(decision).not.toHaveProperty('folio');
  await waitFor(() => expect(print).toBeEnabled());
  expect(verify).toBeDisabled();
  fireEvent.change(formDecision, { target: { value: 'revoked' } });
  expect(print).toBeDisabled();
});
