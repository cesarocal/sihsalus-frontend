/** Local vector for a blood-sample tube; inherits the existing red sample color. */
export function SampleTubeIcon({ className }: { className?: string }) {
  return (
    <svg
      width={48}
      height={48}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
      data-sample-icon="test-tube"
    >
      <rect x={10} y={2} width={12} height={5} rx={1} fill="currentColor" />
      <path d="M12 7v18a4 4 0 0 0 8 0V7" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
      <path d="M13.5 20h5v5a2.5 2.5 0 0 1-5 0Z" fill="currentColor" />
      <path d="M16 11h2M16 15h2" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  );
}
