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
        // Only internal pointer focus skips centering. Keyboard navigation and the
        // modal's outside focus trap still bubble to Carbon normally.
        if (
          pointerFocus.current &&
          event.relatedTarget instanceof Node &&
          event.currentTarget.contains(event.relatedTarget)
        )
          event.stopPropagation();
      }}
    >
      {children}
    </div>
  );
}
