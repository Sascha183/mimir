import type { GateKind } from '../../lib/gates/types';

interface Props {
  kind: GateKind;
  /** Center x-coordinate of the gate body in the parent SVG. */
  x: number;
  /** Center y-coordinate of the gate body in the parent SVG. */
  y: number;
  /** Width of the gate's bounding box, including input/output stubs. Defaults to 64. */
  size?: number;
  /** When true, renders the gate kind ("NAND", "NOT", …) below the body. Defaults to true. */
  showLabel?: boolean;
}

/**
 * Renders a single gate as an SVG group, to be embedded in a parent <svg>.
 *
 * Local gate coordinates (before the translate/scale transform):
 *   - Body roughly fills the rectangle (-16, -16) to (+16, +16).
 *   - Two-input gates: in1 at (-28, -10), in2 at (-28, +10).
 *   - One-input gates (NOT): in1 at (-28, 0).
 *   - Output port: at (+32, 0). Bubble (for NAND/NOT) sits between the body and the output stub.
 *
 * Stroke uses currentColor; callers control the line color via CSS. The label
 * uses a fixed apple-text-secondary fill so it stays muted regardless of context.
 */
export default function GateSymbol({ kind, x, y, size = 64, showLabel = true }: Props) {
  const scale = size / 64;
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <g
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        {kind === 'NAND' && <NandShape />}
        {kind === 'NOT' && <NotShape />}
        {kind === 'AND' && <AndShape />}
        {kind === 'OR' && <OrShape />}
        {kind === 'XOR' && <XorShape />}
      </g>
      {showLabel && (
        <text
          x={0}
          y={28}
          textAnchor="middle"
          fontSize="10"
          fontWeight="500"
          style={{ fill: "rgb(var(--apple-text-secondary))" }}
          stroke="none"
        >
          {kind}
        </text>
      )}
    </g>
  );
}

function NandShape() {
  return (
    <>
      {/* D-shape body. Sweep=0 + going (0,16) → (0,-16) gives a right-bulging arc. */}
      <path d="M -16 -16 V 16 H 0 A 16 16 0 0 0 0 -16 Z" />
      {/* NOT bubble at the output */}
      <circle cx="19" cy="0" r="3" />
      {/* Input + output stubs */}
      <line x1="-28" y1="-10" x2="-16" y2="-10" />
      <line x1="-28" y1="10" x2="-16" y2="10" />
      <line x1="22" y1="0" x2="32" y2="0" />
    </>
  );
}

function NotShape() {
  return (
    <>
      {/* Triangle pointing right */}
      <path d="M -16 -16 L 16 0 L -16 16 Z" />
      {/* NOT bubble */}
      <circle cx="19" cy="0" r="3" />
      {/* Single input + output stubs */}
      <line x1="-28" y1="0" x2="-16" y2="0" />
      <line x1="22" y1="0" x2="32" y2="0" />
    </>
  );
}

function AndShape() {
  return (
    <>
      <path d="M -16 -16 V 16 H 0 A 16 16 0 0 0 0 -16 Z" />
      <line x1="-28" y1="-10" x2="-16" y2="-10" />
      <line x1="-28" y1="10" x2="-16" y2="10" />
      <line x1="16" y1="0" x2="32" y2="0" />
    </>
  );
}

function OrShape() {
  return (
    <>
      {/* Curved-back shield with a tip on the right */}
      <path d="M -16 -16 Q 8 -16 24 0 Q 8 16 -16 16 Q -8 0 -16 -16 Z" />
      <line x1="-28" y1="-10" x2="-13" y2="-10" />
      <line x1="-28" y1="10" x2="-13" y2="10" />
      <line x1="24" y1="0" x2="32" y2="0" />
    </>
  );
}

function XorShape() {
  return (
    <>
      <path d="M -16 -16 Q 8 -16 24 0 Q 8 16 -16 16 Q -8 0 -16 -16 Z" />
      {/* Second curve, offset to the left of the body */}
      <path d="M -22 -16 Q -14 0 -22 16" />
      <line x1="-28" y1="-10" x2="-19" y2="-10" />
      <line x1="-28" y1="10" x2="-19" y2="10" />
      <line x1="24" y1="0" x2="32" y2="0" />
    </>
  );
}
