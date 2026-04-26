interface Props {
  from: { x: number; y: number };
  to: { x: number; y: number };
  active?: boolean;
}

/**
 * A wire drawn as a smooth cubic Bezier from `from` to `to`.
 *
 * Active (carrying a 1) → apple-blue, slightly thicker.
 * Inactive (carrying a 0) → secondary text color, thin.
 * Stroke and stroke-width transition together, so flipping a switch lights up
 * the path of wires it drives.
 */
export default function Wire({ from, to, active = false }: Props) {
  const dx = to.x - from.x;
  // Pull the control points horizontally so the curve flows left-to-right.
  // The 0.4 factor gives a gentle S-curve when from/to are vertically offset.
  const cx = Math.max(40, Math.abs(dx) * 0.4);
  const path = `M ${from.x} ${from.y} C ${from.x + cx} ${from.y}, ${
    to.x - cx
  } ${to.y}, ${to.x} ${to.y}`;

  return (
    <path
      d={path}
      fill="none"
      strokeLinecap="round"
      className="transition-all duration-300 motion-reduce:transition-none"
      style={{
        stroke: active ? '#0071e3' : '#6e6e73',
        strokeWidth: active ? 2 : 1.25,
      }}
    />
  );
}
