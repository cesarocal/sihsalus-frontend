import { act, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { printDocument } from './print-document';

// Reproduce the incompatible dev server-renderer / production host boundary.
// Printing must use the shared client renderer instead of this server entry.
vi.mock('react-dom/server', () => ({
  renderToStaticMarkup: () => {
    throw new TypeError('ReactDebugCurrentFrame.getCurrentStack is unavailable');
  },
}));
const preparePrint = (content: ReactNode, title: string, onError?: () => void) => {
  act(() => printDocument(content, title, onError));
};

describe('ESM print iframe focus and safe markup', () => {
  afterEach(() => {
    document.querySelectorAll('iframe').forEach((frame) => {
      frame.remove();
    });
    vi.restoreAllMocks();
  });
  const frame = () => {
    const element = document.querySelector('iframe');
    if (!element?.contentWindow) throw new Error('TEST_PRINT_FRAME_MISSING');
    vi.spyOn(element.contentWindow, 'focus').mockImplementation(() => {});
    Object.defineProperty(element.contentWindow, 'print', { configurable: true, value: vi.fn() });
    return element;
  };
  it('escapes user text and restores keyboard focus when the print dialog returns', () => {
    const { getByRole } = render(
      <div role="dialog">
        <button type="button">Imprimir DEMO</button>
      </div>,
    );
    const button = getByRole('button');
    button.focus();
    preparePrint(
      <article>
        <p data-demo>DEMO</p>
        <p>{'<script>synthetic</script>'}</p>
      </article>,
      'Documento DEMO',
    );
    const iframe = frame();
    expect(iframe.srcdoc).toContain('&lt;script&gt;synthetic&lt;/script&gt;');
    expect(iframe.srcdoc).not.toContain('<script>synthetic</script>');
    iframe.onload?.call(iframe, new Event('load'));
    expect(iframe.contentWindow?.print).toHaveBeenCalledOnce();
    expect(button).toHaveFocus();
    iframe.contentWindow?.dispatchEvent(new Event('afterprint'));
    expect(document.querySelector('iframe')).toBeNull();
    expect(button).toHaveFocus();
  });
  it('restores focus inside the modal if the one-time print button has become disabled', () => {
    const { getByRole } = render(
      <div role="dialog">
        <button type="button">Cerrar DEMO</button>
        <button type="button">Imprimir DEMO</button>
      </div>,
    );
    const button = getByRole('button', {
      name: 'Imprimir DEMO',
    }) as HTMLButtonElement;
    button.focus();
    preparePrint(<p>DEMO</p>, 'DEMO');
    button.disabled = true;
    const iframe = frame();
    iframe.onload?.call(iframe, new Event('load'));
    expect(getByRole('button', { name: 'Cerrar DEMO' })).toHaveFocus();
  });
  it('restores focus even when a browser printer throws; does not certify print success', () => {
    const { getByRole } = render(<button type="button">Imprimir DEMO</button>);
    getByRole('button').focus();
    preparePrint(<p>DEMO</p>, 'DEMO');
    const iframe = frame();
    if (!iframe.contentWindow) throw new Error('TEST_PRINT_FRAME_MISSING');
    vi.mocked(iframe.contentWindow.print).mockImplementation(() => {
      throw new Error('TEST_PRINTER_FAILED');
    });
    expect(() => iframe.onload?.call(iframe, new Event('load'))).toThrow('TEST_PRINTER_FAILED');
    expect(getByRole('button')).toHaveFocus();
  });

  it('reports asynchronous printer failure through a safe callback without exposing its trace', () => {
    const failure = vi.fn();
    preparePrint(<p>DEMO</p>, 'DEMO', failure);
    const iframe = frame();
    if (!iframe.contentWindow) throw new Error('TEST_PRINT_FRAME_MISSING');
    vi.mocked(iframe.contentWindow.print).mockImplementation(() => {
      throw new Error('private synthetic printer trace');
    });
    expect(() => iframe.onload?.call(iframe, new Event('load'))).not.toThrow();
    expect(failure).toHaveBeenCalledExactlyOnceWith();
  });
  it('prints client-rendered content without server debug internals and preserves page-counter CSS', () => {
    const css = '@page { @top-right { content: counter(page) " / " counter(pages); } }';
    const PrintContent = () => (
      <article>
        <style>{css}</style>
        <h2>Acta DEMO</h2>
        <p>{'<script>synthetic</script>'}</p>
      </article>
    );
    preparePrint(<PrintContent />, 'Acta DEMO');
    const iframe = frame();
    expect(iframe.srcdoc).toContain(css);
    expect(iframe.srcdoc).toContain('<h2>Acta DEMO</h2>');
    expect(iframe.srcdoc).toContain('&lt;script&gt;synthetic&lt;/script&gt;');
    expect(iframe.srcdoc).not.toContain('<script>synthetic</script>');
    expect(document.querySelector('article')).not.toBeInTheDocument();
    iframe.onload?.call(iframe, new Event('load'));
    expect(iframe.contentWindow?.print).toHaveBeenCalledOnce();
  });
});
