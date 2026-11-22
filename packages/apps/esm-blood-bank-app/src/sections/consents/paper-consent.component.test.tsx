import { fireEvent, render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { transfusionRequestsMock } from '../../mocks/transfusions.mock';
import { printDocument } from '../../shared/print-document';
import { PaperConsentEditor } from './paper-consent.component';
import { type ConsentSubject, recipientConsentSubject } from './paper-consent.resource';

vi.mock('@openmrs/esm-framework', () => ({
  useConfig: () => ({}),
  useSession: () => ({ authenticated: true }),
  userHasAccess: () => true,
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

it('prints the FR12 layout with recipient demographics and leaves the paper decision unsigned', () => {
  render(<PaperConsentEditor subject={recipient} />);
  fireEvent.click(screen.getByRole('button', { name: 'Imprimir EG05-FR12' }));
  const [content, title, , css] = vi.mocked(printDocument).mock.lastCall ?? [];
  const markup = renderToStaticMarkup(content);

  expect(title).toContain('EG05-FR12');
  expect(css).toContain('size: A4');
  expect(markup).toContain('data-fr12');
  expect(markup).toContain('35 años');
  expect(markup).toContain(recipient.identification);
  expect(markup).toContain(recipient.number);
  expect(markup).toContain('<span class="fr12-mark">×</span>Femenino');
  expect(markup).toContain('Huella digital');
  expect(markup).toContain('<span class="fr12-mark"></span>No acepto');
  expect(markup).toContain('<span class="fr12-mark"></span>Retiro mi consentimiento previo');
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
