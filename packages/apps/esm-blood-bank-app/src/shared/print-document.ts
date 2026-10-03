import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

export const processingPrintCss = `
  @page { size: A4; margin: 14mm; }
  body { margin: 0; font: 11pt Arial, sans-serif; color: #111; }
  article { max-width: 180mm; margin: auto; } h2 { text-align: center; font-size: 16pt; }
  dl { display: grid; grid-template-columns: 1fr 1fr; gap: 10pt; } dt { font-weight: bold; } dd { margin: 3pt 0; }
  p, dd { overflow-wrap: anywhere; white-space: pre-wrap; } dl > div { break-inside: avoid; }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; } th, td { padding: 6pt; border: 1px solid #aaa; }
  tr { break-inside: avoid; } footer { margin-top: 20pt; border-top: 1px solid #999; padding-top: 8pt; }
  [data-label] { max-width: 110mm; padding: 8mm; border: 1px solid #111; }
  [data-demo] { text-align: center; font-weight: bold; padding: 6pt; border: 1px solid #111; }
`;
export function printDocument(content: ReactNode, title: string) {
  const frame = document.createElement('iframe');
  frame.title = title;
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0;';
  frame.onload = () => {
    frame.contentWindow?.addEventListener('afterprint', () => frame.remove(), { once: true });
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
  };
  const language = document.documentElement.lang === 'en' ? 'en' : 'es';
  frame.srcdoc = `<!doctype html><html lang="${language}"><head><meta charset="utf-8"><style>${processingPrintCss}</style></head><body>${renderToStaticMarkup(content)}</body></html>`;
  document.body.appendChild(frame);
  setTimeout(() => frame.remove(), 120000);
}
