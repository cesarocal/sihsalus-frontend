import { useRef, type ReactNode } from 'react';

/** Avoid moving a pointer target during Carbon 1.92's blur-driven scroll centering. */
export function FractionationContent({ children }: { children: ReactNode }) {
  const pointerFocus = useRef(false);
  return (
    <div
      onPointerDownCapture={() => {
        pointerFocus.current = true;
      }}
      onPointerUpCapture={() => {
        pointerFocus.current = false;
      }}
      onPointerCancelCapture={() => {
        pointerFocus.current = false;
      }}
      onFocusCapture={() => {
        pointerFocus.current = false;
      }}
      onBlurCapture={(event) => {
        // Keep the clicked target in place, including when focus comes from the
        // modal footer. Keyboard navigation and the outside focus trap still bubble.
        if (
          pointerFocus.current &&
          event.relatedTarget instanceof Element &&
          event.relatedTarget.closest('.cds--modal-content') &&
          event.target.closest('[role="dialog"]') === event.relatedTarget.closest('[role="dialog"]')
        )
          event.stopPropagation();
      }}
    >
      {children}
    </div>
  );
}
