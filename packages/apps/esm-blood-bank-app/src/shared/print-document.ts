import type { ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

export const processingPrintCss = `
  @page { size: A4; margin: 14mm; }
  body { margin: 0; font: 11pt Arial, sans-serif; color: #111; }
  article { max-width: 180mm; margin: auto; } h2 { text-align: center; font-size: 16pt; }
  dl { display: grid; grid-template-columns: 1fr 1fr; gap: 10pt; } dt { font-weight: bold; } dd { margin: 3pt 0; }
  p, dd { overflow-wrap: anywhere; white-space: pre-wrap; } dl > div { break-inside: avoid; }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; } th, td { padding: 6pt; border: 1px solid #aaa; overflow-wrap: anywhere; white-space: pre-wrap; }
  tr { break-inside: avoid; } footer { margin-top: 20pt; border-top: 1px solid #999; padding-top: 8pt; }
  [data-label] { max-width: 110mm; padding: 8mm; border: 1px solid #111; }
  [data-demo] { text-align: center; font-weight: bold; padding: 6pt; border: 1px solid #111; }
  [data-blood-group] { display: flex; justify-content: center; align-items: baseline; gap: 9pt; margin: 6pt 0 12pt; font-size: 15pt; font-weight: bold; }
  [data-blood-group] strong { font-size: 32pt; line-height: 1; }
  [data-manual-volume] { display: inline-block; width: 32mm; border-bottom: 1px solid; margin-right: 4pt; }
`;
export function printDocument(
  content: ReactNode,
  title: string,
  onError?: () => void,
  css = processingPrintCss,
  onPrintRequested?: () => void,
) {
  // Use the shell's shared client renderer. A dev server renderer can depend on
  // React debug internals that the production shell does not provide.
  // The detached tree contains only our presentational print components.
  const container = document.createElement('div');
  const root = createRoot(container);
  let markup: string;
  try {
    flushSync(() => root.render(content));
    markup = container.innerHTML;
  } finally {
    root.unmount();
  }
  const owner = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const dialog = owner?.closest('[role="dialog"]');
  const restoreFocus = () => {
    const target =
      owner?.isConnected && !owner.matches(':disabled')
        ? owner
        : dialog?.querySelector<HTMLElement>('button:not(:disabled), input:not(:disabled)');
    if (target?.isConnected) target.focus({ preventScroll: true });
  };
  const frame = document.createElement('iframe');
  let printStarted = false;
  frame.title = title;
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0;';
  frame.onload = () => {
    if (!frame.isConnected) return;
    printStarted = true;
    frame.contentWindow?.addEventListener(
      'afterprint',
      () => {
        frame.remove();
        restoreFocus();
      },
      { once: true },
    );
    try {
      if (!frame.contentWindow) throw new Error('PRINT_WINDOW_UNAVAILABLE');
      frame.contentWindow.focus();
      frame.contentWindow.print();
      onPrintRequested?.();
    } catch (error) {
      if (onError) onError();
      else throw error;
    } finally {
      restoreFocus();
    }
  };
  const language = document.documentElement.lang === 'en' ? 'en' : 'es';
  frame.srcdoc = `<!doctype html><html lang="${language}"><head><meta charset="utf-8"><style>${css}</style></head><body>${markup}</body></html>`;
  document.body.appendChild(frame);
  setTimeout(() => {
    frame.remove();
    if (onPrintRequested && !printStarted) {
      restoreFocus();
      onError?.();
    }
  }, 120000);
}
