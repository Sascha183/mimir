import type { Bit } from '../../lib/gates/types';

/**
 * Two-faced module:
 *
 *  - `Bulb` (named export) — an SVG <g> group meant to be embedded inside a
 *    parent <svg>. Used by SwitchRoom so the bulb sits inside the room's own
 *    wall outline. Takes parent-SVG coordinates.
 *
 *  - `OutputBulb` (default export) — a self-contained HTML+SVG component with
 *    an optional label. Used by CircuitCanvas at the right edge of a circuit.
 *
 * Visual language is shared: amber bulb (#fbbf24) when on, outline-only when off,
 * three stacked halos for the glow, smooth opacity/fill transitions that respect
 * prefers-reduced-motion.
 */

interface BulbGlyphProps {
  /** Center of the bulb body in parent-SVG coordinates. */
  cx: number;
  /** Center of the bulb body in parent-SVG coordinates. */
  cy: number;
  value: Bit;
  /**
   * Optional. If given, draws a cord from (cx, cordTop) down to the cap.
   * Omit for canvas use where the bulb is a free-standing widget.
   */
  cordTop?: number;
  /** Bulb body radius. Defaults to 24. The cap and halos scale from this. */
  r?: number;
}

export function Bulb({ cx, cy, value, cordTop, r = 24 }: BulbGlyphProps) {
  const isOn = value === 1;
  const capHeight = Math.round(r * 0.5);
  const capWidth = Math.round(r * 0.67);
  const capOverlap = 4;
  const capTop = cy - r - capHeight + capOverlap;

  // Three halo radii, biggest first so they paint behind the body.
  const halo3 = Math.round(r * 2.2);
  const halo2 = Math.round(r * 1.6);
  const halo1 = Math.round(r * 1.25);

  return (
    <g>
      {cordTop !== undefined && (
        <>
          <line
            x1={cx}
            y1={cordTop}
            x2={cx}
            y2={capTop}
            stroke="currentColor"
            strokeWidth="2"
          />
          <rect
            x={cx - capWidth / 2}
            y={capTop}
            width={capWidth}
            height={capHeight}
            rx="1.5"
            stroke="currentColor"
            strokeWidth="2"
            fill="#fbfbfd"
          />
        </>
      )}

      <circle
        cx={cx}
        cy={cy}
        r={halo3}
        fill="#fbbf24"
        className="transition-opacity duration-300 motion-reduce:transition-none"
        style={{ opacity: isOn ? 0.08 : 0 }}
      />
      <circle
        cx={cx}
        cy={cy}
        r={halo2}
        fill="#fbbf24"
        className="transition-opacity duration-300 motion-reduce:transition-none"
        style={{ opacity: isOn ? 0.18 : 0 }}
      />
      <circle
        cx={cx}
        cy={cy}
        r={halo1}
        fill="#fbbf24"
        className="transition-opacity duration-300 motion-reduce:transition-none"
        style={{ opacity: isOn ? 0.32 : 0 }}
      />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        stroke="currentColor"
        strokeWidth="2"
        className="transition-all duration-300 motion-reduce:transition-none"
        style={{ fill: isOn ? '#fbbf24' : 'transparent' }}
      />
    </g>
  );
}

interface OutputBulbProps {
  value: Bit;
  label?: string;
  /** Width in CSS pixels. The bulb scales with this. Defaults to 64. */
  size?: number;
}

/**
 * Free-standing bulb widget for circuit canvases. Includes a short cord stub
 * at the top so the wire from a gate output can connect there visually.
 */
export default function OutputBulb({ value, label, size = 64 }: OutputBulbProps) {
  // Internal SVG layout: 64 wide, 80 tall, centered horizontally on x=0.
  // The cord stub starts at y=0 and the bulb body sits at (0, 50).
  return (
    <div className="flex flex-col items-center gap-1.5 text-apple-text">
      <svg
        viewBox="-32 0 64 80"
        width={size}
        height={(size * 80) / 64}
        aria-hidden="true"
        className="block"
      >
        <Bulb cx={0} cy={50} value={value} cordTop={0} r={20} />
      </svg>
      {label && <span className="text-xs text-apple-text-secondary">{label}</span>}
    </div>
  );
}
