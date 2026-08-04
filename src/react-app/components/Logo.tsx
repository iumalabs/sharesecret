/**
 * Brand mark: a hexagonal cipher block with a keyhole cut out of it -- a
 * sealed container you can only look into with the key. Never rotate,
 * outline, gradient, or re-space it (see docs/ brand kit).
 */
export default function Logo({ size = 20 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinejoin="miter"
    >
      <path d="M16 2.6 27.6 9.3v13.4L16 29.4 4.4 22.7V9.3z" />
      <circle cx={16} cy={14} r={3.3} />
      <path d="M15.4 17.4h1.2l.7 6h-2.6z" fill="currentColor" stroke="none" />
    </svg>
  );
}
