import type { Bit, Circuit, GateInstance, PortRef, Wire as WireType } from '../../lib/gates/types';
import { simulateAll } from '../../lib/gates/simulator';
import { getGateArity } from '../../lib/gates/gates';
import GateSymbol from './GateSymbol';
import Wire from './Wire';
import InputSwitch from './InputSwitch';
import OutputBulb from './OutputBulb';

interface Props {
  circuit: Circuit;
  inputValues: Record<string, Bit>;
  outputValues: Record<string, Bit>;
  onInputChange: (id: string, v: Bit) => void;
  width?: number;
  height?: number;
}

// Layout constants. The HTML overlays for input switches and output bulbs are
// sized in pixels; the inner SVG uses a 1:1 viewBox so SVG coords == CSS pixels.
const INPUT_WIDTH = 64;
const INPUT_TOTAL_HEIGHT = 48;
const OUTPUT_WIDTH = 64;
const OUTPUT_TOTAL_HEIGHT = 80;
const EDGE_PADDING = 12;

// Local gate-port offsets — these mirror the geometry in GateSymbol.tsx.
const PORT_OUT_X = 32;
const PORT_IN_X = -28;
const PORT_IN_Y_OFFSET = 10;

/**
 * Declarative circuit renderer.
 *
 * Lays out InputSwitches at the left edge, OutputBulbs at the right, and gates
 * at their `position` coordinates. Wires are drawn between the resolved port
 * anchors and styled by the value flowing through them.
 *
 * No editing yet — the canvas only visualizes whatever Circuit it's given.
 * Drag/drop, port-snapping, and wire creation come in a later layer.
 */
export default function CircuitCanvas({
  circuit,
  inputValues,
  outputValues,
  onInputChange,
  width = 480,
  height = 240,
}: Props) {
  // Re-simulate so we know the value flowing through every wire (for active styling).
  // For circuits this small the cost is negligible; if it ever matters, the parent
  // can pass node values down explicitly.
  const { gateOutputs } = simulateAll(circuit, inputValues);

  function inputCenterY(idx: number): number {
    const total = circuit.inputs.length;
    return ((idx + 1) / (total + 1)) * height;
  }
  function outputCenterY(idx: number): number {
    const total = circuit.outputs.length;
    return ((idx + 1) / (total + 1)) * height;
  }

  function refPoint(ref: PortRef): { x: number; y: number } {
    if ('source' in ref) {
      if (ref.source === 'input') {
        const idx = circuit.inputs.findIndex((i) => i.id === ref.inputId);
        // Wire emerges at the right edge of the toggle, vertically centered on it.
        return { x: EDGE_PADDING + INPUT_WIDTH, y: inputCenterY(idx) };
      }
      const idx = circuit.outputs.findIndex((o) => o.id === ref.outputId);
      // Wire enters at the top of the bulb's cord (top-center of its bounding box).
      return {
        x: width - EDGE_PADDING - OUTPUT_WIDTH / 2,
        y: outputCenterY(idx) - OUTPUT_TOTAL_HEIGHT / 2,
      };
    }
    const gate = circuit.gates.find((g) => g.id === ref.gateId);
    if (!gate) throw new Error(`unknown gate: ${ref.gateId}`);
    return getGatePortAnchor(gate, ref.port);
  }

  function wireActive(wire: WireType): boolean {
    if ('source' in wire.from) {
      if (wire.from.source === 'input') {
        return (inputValues[wire.from.inputId] ?? 0) === 1;
      }
      return false; // outputs aren't sources
    }
    if (wire.from.port === 'out') {
      return (gateOutputs[wire.from.gateId] ?? 0) === 1;
    }
    return false;
  }

  // Group wires by their source port so we can render fan-outs as a single
  // trunk + branches with a visible junction dot. Without this, two wires
  // from the same input look like two independent connections — the opposite
  // of what fan-out actually means.
  const wireGroups: { sourceKey: string; wires: WireType[] }[] = [];
  const groupIndex = new Map<string, number>();
  for (const w of circuit.wires) {
    const key = sourceRefKey(w.from);
    let idx = groupIndex.get(key);
    if (idx === undefined) {
      idx = wireGroups.length;
      wireGroups.push({ sourceKey: key, wires: [] });
      groupIndex.set(key, idx);
    }
    wireGroups[idx].wires.push(w);
  }

  return (
    <div
      className="relative mx-auto w-full text-apple-text"
      style={{ maxWidth: width, aspectRatio: `${width} / ${height}` }}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 h-full w-full block"
        aria-hidden="true"
      >
        {/*
          Wires drawn beneath gates so the gate symbols visually cover any overlap.
          For fan-out (multiple wires from one source) we draw a trunk to a
          junction point near the destinations, then branches from there to each
          destination, plus a small filled circle at the junction.
        */}
        {wireGroups.map(({ sourceKey, wires }) => {
          const sourceP = refPoint(wires[0].from);
          const isActive = wireActive(wires[0]);

          if (wires.length === 1) {
            return (
              <Wire
                key={wires[0].id}
                from={sourceP}
                to={refPoint(wires[0].to)}
                active={isActive}
              />
            );
          }

          const dests = wires.map((w) => refPoint(w.to));
          const avgDestX = dests.reduce((s, p) => s + p.x, 0) / dests.length;
          const avgDestY = dests.reduce((s, p) => s + p.y, 0) / dests.length;
          // Junction sits ~70px before the destinations, but never further left
          // than the midpoint to the source (so it stays a visual branch point).
          const junctionX = Math.max(avgDestX - 70, (sourceP.x + avgDestX) / 2);
          const junctionP = { x: junctionX, y: avgDestY };

          return (
            <g key={sourceKey}>
              <Wire from={sourceP} to={junctionP} active={isActive} />
              {wires.map((w) => (
                <Wire
                  key={w.id}
                  from={junctionP}
                  to={refPoint(w.to)}
                  active={isActive}
                />
              ))}
              <circle
                cx={junctionP.x}
                cy={junctionP.y}
                r="5"
                stroke="none"
                className="transition-colors duration-300 motion-reduce:transition-none"
                style={{ fill: isActive ? 'rgb(var(--apple-blue))' : 'rgb(var(--apple-text))' }}
              />
            </g>
          );
        })}
        {circuit.gates.map((gate) => (
          <GateSymbol
            key={gate.id}
            kind={gate.kind}
            x={gate.position.x}
            y={gate.position.y}
          />
        ))}
      </svg>

      {/*
        HTML overlays positioned in percentages of the SVG coord space so they
        track when the canvas is scaled down on narrow viewports. The
        InputSwitch/OutputBulb themselves keep fixed pixel dimensions (so the
        toggle stays fingertip-sized at any width).
      */}
      {circuit.inputs.map((input, idx) => (
        <div
          key={input.id}
          className="absolute flex -translate-y-1/2 items-center"
          style={{
            left: `${(EDGE_PADDING / width) * 100}%`,
            top: `${(inputCenterY(idx) / height) * 100}%`,
          }}
        >
          <InputSwitch
            value={inputValues[input.id] ?? 0}
            onChange={(v) => onInputChange(input.id, v)}
            label={input.label}
          />
        </div>
      ))}

      {circuit.outputs.map((output, idx) => (
        <div
          key={output.id}
          className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center"
          style={{
            left: `${((width - EDGE_PADDING - OUTPUT_WIDTH / 2) / width) * 100}%`,
            top: `${(outputCenterY(idx) / height) * 100}%`,
          }}
        >
          <OutputBulb value={outputValues[output.id] ?? 0} label={output.label} />
        </div>
      ))}
    </div>
  );
}

function sourceRefKey(ref: PortRef): string {
  if ('source' in ref) {
    return ref.source === 'input'
      ? `input:${ref.inputId}`
      : `output:${ref.outputId}`;
  }
  return `gate:${ref.gateId}:${ref.port}`;
}

function getGatePortAnchor(
  gate: GateInstance,
  port: 'in1' | 'in2' | 'out',
): { x: number; y: number } {
  const arity = getGateArity(gate.kind);
  let local: { x: number; y: number };
  if (port === 'out') {
    local = { x: PORT_OUT_X, y: 0 };
  } else if (arity === 1) {
    local = { x: PORT_IN_X, y: 0 };
  } else if (port === 'in1') {
    local = { x: PORT_IN_X, y: -PORT_IN_Y_OFFSET };
  } else {
    local = { x: PORT_IN_X, y: PORT_IN_Y_OFFSET };
  }
  return { x: gate.position.x + local.x, y: gate.position.y + local.y };
}
