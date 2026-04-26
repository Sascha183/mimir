import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  Bit,
  Circuit,
  GateInstance,
  GateKind,
  PortRef,
  TruthTable,
  Wire as WireType,
} from '../../lib/gates/types';
import {
  simulateAll,
  simulateCircuit,
  wouldCreateCycle,
} from '../../lib/gates/simulator';
import {
  generateTruthTable,
  compareTruthTables,
} from '../../lib/gates/truth-table';
import { getGateArity } from '../../lib/gates/gates';
import GateSymbol from './GateSymbol';
import Wire from './Wire';
import InputSwitch from './InputSwitch';
import OutputBulb from './OutputBulb';

interface Props {
  initialCircuit: Circuit;
  availableGates: GateKind[];
  allowAddGates?: boolean;
  allowDelete?: boolean;
  allowEditWires?: boolean;
  targetTruthTable?: TruthTable;
  onSolved?: () => void;
  storageKey: string;
}

// ─── Layout constants ───────────────────────────────────────────────────────
// Match CircuitCanvas's geometry so circuits look identical between editor
// and read-only display.
const CANVAS_W = 568;
const CANVAS_H = 368;
const FRAME_PAD = 16;

const INPUT_WIDTH = 64;
const INPUT_TOTAL_HEIGHT = 48;
const OUTPUT_WIDTH = 64;
const OUTPUT_TOTAL_HEIGHT = 80;
const EDGE_PADDING = 12;

const GRID = 20; // gate positions snap to this on drop / drag-end
const PORT_R = 5;
const PORT_HIT_R = 9;

// Two gates count as "overlapping" if their centers are within these
// distances. The gate body is ~32x32; this leaves a small breathing margin.
const MIN_GAP_X = 40;
const MIN_GAP_Y = 32;

// Keep gate centers this far inside the canvas edges so they don't crash
// into the input switches or output bulbs.
const PLACEMENT_MARGIN_X = 100;
const PLACEMENT_MARGIN_Y = 40;

// MIME type for HTML5 drag-and-drop from the palette.
const PALETTE_MIME = 'application/x-hciw-gate-kind';

// ─── Helpers ────────────────────────────────────────────────────────────────

function snap(v: number): number {
  return Math.round(v / GRID) * GRID;
}

function isSourcePort(ref: PortRef): boolean {
  if ('source' in ref) return ref.source === 'input';
  return ref.port === 'out';
}

function isDestPort(ref: PortRef): boolean {
  if ('source' in ref) return ref.source === 'output';
  return ref.port === 'in1' || ref.port === 'in2';
}

function portRefEqual(a: PortRef, b: PortRef): boolean {
  if ('source' in a) {
    if (!('source' in b)) return false;
    if (a.source !== b.source) return false;
    if (a.source === 'input' && b.source === 'input') return a.inputId === b.inputId;
    if (a.source === 'output' && b.source === 'output') return a.outputId === b.outputId;
    return false;
  }
  if ('source' in b) return false;
  return a.gateId === b.gateId && a.port === b.port;
}

function sourceRefKey(ref: PortRef): string {
  if ('source' in ref) {
    return ref.source === 'input'
      ? `input:${ref.inputId}`
      : `output:${ref.outputId}`;
  }
  return `gate:${ref.gateId}:${ref.port}`;
}

function inPlacementBounds(p: { x: number; y: number }): boolean {
  return (
    p.x >= PLACEMENT_MARGIN_X &&
    p.x <= CANVAS_W - PLACEMENT_MARGIN_X &&
    p.y >= PLACEMENT_MARGIN_Y &&
    p.y <= CANVAS_H - PLACEMENT_MARGIN_Y
  );
}

function clampToBounds(p: { x: number; y: number }): { x: number; y: number } {
  return {
    x: Math.max(PLACEMENT_MARGIN_X, Math.min(CANVAS_W - PLACEMENT_MARGIN_X, p.x)),
    y: Math.max(PLACEMENT_MARGIN_Y, Math.min(CANVAS_H - PLACEMENT_MARGIN_Y, p.y)),
  };
}

function overlapsAny(
  gates: GateInstance[],
  excludeGateId: string | null,
  pos: { x: number; y: number },
): boolean {
  return gates.some((g) => {
    if (g.id === excludeGateId) return false;
    return (
      Math.abs(g.position.x - pos.x) < MIN_GAP_X &&
      Math.abs(g.position.y - pos.y) < MIN_GAP_Y
    );
  });
}

/**
 * Find a non-overlapping snapped position near `desired`. Spirals outward in
 * GRID-sized steps; returns the first free candidate in placement bounds, or
 * the desired position as a last resort if the canvas is too crowded.
 */
function findFreePosition(
  gates: GateInstance[],
  excludeGateId: string | null,
  desired: { x: number; y: number },
): { x: number; y: number } {
  if (inPlacementBounds(desired) && !overlapsAny(gates, excludeGateId, desired)) {
    return desired;
  }
  for (let r = 1; r <= 10; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const candidate = {
          x: desired.x + dx * GRID,
          y: desired.y + dy * GRID,
        };
        if (
          inPlacementBounds(candidate) &&
          !overlapsAny(gates, excludeGateId, candidate)
        ) {
          return candidate;
        }
      }
    }
  }
  return desired;
}

function isCircuitShape(value: unknown): value is Circuit {
  if (!value || typeof value !== 'object') return false;
  const c = value as Record<string, unknown>;
  return (
    Array.isArray(c.gates) &&
    Array.isArray(c.wires) &&
    Array.isArray(c.inputs) &&
    Array.isArray(c.outputs)
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function CircuitEditor({
  initialCircuit,
  availableGates,
  allowAddGates = true,
  allowDelete = true,
  allowEditWires = true,
  targetTruthTable,
  onSolved,
  storageKey,
}: Props) {
  const [circuit, setCircuit] = useState<Circuit>(initialCircuit);
  const [inputValues, setInputValues] = useState<Record<string, Bit>>(() => {
    const obj: Record<string, Bit> = {};
    for (const i of initialCircuit.inputs) obj[i.id] = i.value;
    return obj;
  });
  const [hydrated, setHydrated] = useState(false);

  // Editor-only UI state
  const [pendingFrom, setPendingFrom] = useState<PortRef | null>(null);
  const [cursorSvg, setCursorSvg] = useState<{ x: number; y: number } | null>(null);
  const [hoveredPort, setHoveredPort] = useState<PortRef | null>(null);
  const [hoveredGateId, setHoveredGateId] = useState<string | null>(null);
  const [selected, setSelected] = useState<
    { kind: 'gate' | 'wire'; id: string } | null
  >(null);
  const [errorMsg, setErrorMsg] = useState<{
    text: string;
    at: { x: number; y: number };
    expires: number;
  } | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{
    gateId: string;
    startSvg: { x: number; y: number };
    gateStart: { x: number; y: number };
    moved: boolean;
  } | null>(null);

  // ─── Persistence (load on mount, save on change) ─────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') {
      setHydrated(true);
      return;
    }
    try {
      const raw = window.localStorage.getItem(`${storageKey}:circuit`);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (isCircuitShape(parsed)) {
          setCircuit(parsed);
        }
      }
    } catch {
      // ignore — fall through to initialCircuit
    }
    setHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(
        `${storageKey}:circuit`,
        JSON.stringify(circuit),
      );
    } catch {
      // localStorage may be disabled — continue silently.
    }
  }, [hydrated, circuit, storageKey]);

  // ─── Simulation ──────────────────────────────────────────────────────────
  const outputValues = useMemo(
    () => simulateCircuit(circuit, inputValues),
    [circuit, inputValues],
  );
  const { gateOutputs } = useMemo(
    () => simulateAll(circuit, inputValues),
    [circuit, inputValues],
  );
  const liveTruthTable = useMemo(() => generateTruthTable(circuit), [circuit]);
  const isSolved = useMemo(
    () =>
      targetTruthTable
        ? compareTruthTables(liveTruthTable, targetTruthTable)
        : false,
    [liveTruthTable, targetTruthTable],
  );

  // Fire onSolved on the false→true transition only.
  const wasSolvedRef = useRef(false);
  useEffect(() => {
    if (isSolved && !wasSolvedRef.current) {
      wasSolvedRef.current = true;
      onSolved?.();
    } else if (!isSolved) {
      wasSolvedRef.current = false;
    }
  }, [isSolved, onSolved]);

  // Drop the selection if the selected element disappeared.
  useEffect(() => {
    if (!selected) return;
    const exists =
      selected.kind === 'gate'
        ? circuit.gates.some((g) => g.id === selected.id)
        : circuit.wires.some((w) => w.id === selected.id);
    if (!exists) setSelected(null);
  }, [circuit, selected]);

  // Auto-clear the error tooltip.
  useEffect(() => {
    if (!errorMsg) return;
    const remaining = errorMsg.expires - Date.now();
    if (remaining <= 0) {
      setErrorMsg(null);
      return;
    }
    const id = window.setTimeout(() => {
      setErrorMsg((curr) => (curr === errorMsg ? null : curr));
    }, remaining);
    return () => window.clearTimeout(id);
  }, [errorMsg]);

  // ─── Coordinate helpers (depend on circuit) ──────────────────────────────
  function inputCenterY(idx: number): number {
    return ((idx + 1) / (circuit.inputs.length + 1)) * CANVAS_H;
  }
  function outputCenterY(idx: number): number {
    return ((idx + 1) / (circuit.outputs.length + 1)) * CANVAS_H;
  }

  function refToPoint(ref: PortRef): { x: number; y: number } {
    if ('source' in ref) {
      if (ref.source === 'input') {
        const idx = circuit.inputs.findIndex((i) => i.id === ref.inputId);
        return { x: EDGE_PADDING + INPUT_WIDTH, y: inputCenterY(idx) };
      }
      const idx = circuit.outputs.findIndex((o) => o.id === ref.outputId);
      return {
        x: CANVAS_W - EDGE_PADDING - OUTPUT_WIDTH / 2,
        y: outputCenterY(idx) - OUTPUT_TOTAL_HEIGHT / 2,
      };
    }
    const gate = circuit.gates.find((g) => g.id === ref.gateId);
    if (!gate) return { x: 0, y: 0 };
    const arity = getGateArity(gate.kind);
    if (ref.port === 'out') return { x: gate.position.x + 32, y: gate.position.y };
    if (arity === 1) return { x: gate.position.x - 28, y: gate.position.y };
    if (ref.port === 'in1')
      return { x: gate.position.x - 28, y: gate.position.y - 10 };
    return { x: gate.position.x - 28, y: gate.position.y + 10 };
  }

  function screenToSvg(clientX: number, clientY: number): {
    x: number;
    y: number;
  } {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const t = pt.matrixTransform(ctm.inverse());
    return { x: t.x, y: t.y };
  }

  // ─── Wire activeness (driven by simulation) ──────────────────────────────
  function sourceRefActive(ref: PortRef): boolean {
    if ('source' in ref) {
      if (ref.source === 'input') {
        return (inputValues[ref.inputId] ?? 0) === 1;
      }
      return false;
    }
    if (ref.port === 'out') {
      return (gateOutputs[ref.gateId] ?? 0) === 1;
    }
    return false;
  }

  // ─── Wire grouping (fan-out junctions) ───────────────────────────────────
  const wireGroups = useMemo(() => {
    const groups: { sourceKey: string; wires: WireType[] }[] = [];
    const idx = new Map<string, number>();
    for (const w of circuit.wires) {
      const key = sourceRefKey(w.from);
      let i = idx.get(key);
      if (i === undefined) {
        i = groups.length;
        groups.push({ sourceKey: key, wires: [] });
        idx.set(key, i);
      }
      groups[i].wires.push(w);
    }
    return groups;
  }, [circuit.wires]);

  // ─── Handlers ────────────────────────────────────────────────────────────

  // Drag-from-palette: drop a new gate on the canvas.
  function handleDragOver(e: React.DragEvent) {
    if (!allowAddGates) return;
    if (!e.dataTransfer.types.includes(PALETTE_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }

  function handleDrop(e: React.DragEvent) {
    if (!allowAddGates) return;
    const kind = e.dataTransfer.getData(PALETTE_MIME) as GateKind;
    if (!kind || !availableGates.includes(kind)) return;
    e.preventDefault();
    const pt = screenToSvg(e.clientX, e.clientY);
    const desired = clampToBounds({ x: snap(pt.x), y: snap(pt.y) });
    const id = makeId();
    setCircuit((prev) => {
      const free = findFreePosition(prev.gates, null, desired);
      const newGate: GateInstance = { id, kind, position: free };
      return { ...prev, gates: [...prev.gates, newGate] };
    });
    setSelected({ kind: 'gate', id });
  }

  // Drag an existing gate. Mousedown starts a tentative drag; movement past
  // a small threshold commits to drag; otherwise mouseup is treated as click.
  function handleGateMouseDown(e: React.MouseEvent, gateId: string) {
    if (e.button !== 0) return;
    e.stopPropagation();
    const gate = circuit.gates.find((g) => g.id === gateId);
    if (!gate) return;
    const pt = screenToSvg(e.clientX, e.clientY);
    dragRef.current = {
      gateId,
      startSvg: pt,
      gateStart: { ...gate.position },
      moved: false,
    };
  }

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const d = dragRef.current;
      if (!d) return;
      const pt = screenToSvg(e.clientX, e.clientY);
      const dx = pt.x - d.startSvg.x;
      const dy = pt.y - d.startSvg.y;
      if (!d.moved && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
      d.moved = true;
      setCircuit((prev) => ({
        ...prev,
        gates: prev.gates.map((g) =>
          g.id === d.gateId
            ? {
                ...g,
                position: { x: d.gateStart.x + dx, y: d.gateStart.y + dy },
              }
            : g,
        ),
      }));
    }
    function onUp() {
      const d = dragRef.current;
      if (!d) return;
      if (d.moved) {
        setCircuit((prev) => ({
          ...prev,
          gates: prev.gates.map((g) => {
            if (g.id !== d.gateId) return g;
            const desired = clampToBounds({
              x: snap(g.position.x),
              y: snap(g.position.y),
            });
            const free = findFreePosition(prev.gates, d.gateId, desired);
            return { ...g, position: free };
          }),
        }));
      } else {
        // Treat as click → select this gate.
        setSelected({ kind: 'gate', id: d.gateId });
      }
      dragRef.current = null;
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  // Wire creation by clicking a source port, then a destination port.
  function handlePortClick(e: React.MouseEvent, ref: PortRef) {
    e.stopPropagation();
    if (!allowEditWires) return;

    if (pendingFrom === null) {
      if (isSourcePort(ref)) setPendingFrom(ref);
      return;
    }

    if (portRefEqual(pendingFrom, ref)) {
      setPendingFrom(null);
      return;
    }

    if (!isDestPort(ref)) {
      // Not a valid completion target — just cancel.
      setPendingFrom(null);
      return;
    }

    const newWire: WireType = {
      id: makeId(),
      from: pendingFrom,
      to: ref,
    };

    if (wouldCreateCycle(circuit, newWire)) {
      const at = refToPoint(ref);
      setErrorMsg({
        text: 'would create a loop',
        at,
        expires: Date.now() + 1500,
      });
      setPendingFrom(null);
      return;
    }

    // Multiple wires into the same destination aren't allowed — replace any
    // existing wire on this dest port.
    setCircuit((prev) => ({
      ...prev,
      wires: [
        ...prev.wires.filter((w) => !portRefEqual(w.to, ref)),
        newWire,
      ],
    }));
    setPendingFrom(null);
  }

  function handleWireClick(e: React.MouseEvent, wireId: string) {
    e.stopPropagation();
    if (pendingFrom) return;
    setSelected({ kind: 'wire', id: wireId });
  }

  function handleCanvasClick() {
    setPendingFrom(null);
    setSelected(null);
  }

  function handleSvgMouseMove(e: React.MouseEvent) {
    if (!pendingFrom) return;
    setCursorSvg(screenToSvg(e.clientX, e.clientY));
  }

  // Keyboard: Escape cancels pending / selection; Delete or Backspace removes
  // the selected gate or wire (and any wires touching a deleted gate).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setPendingFrom(null);
        setSelected(null);
        return;
      }
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      if (!allowDelete) return;
      // Don't intercept when the user is typing in an input/textarea.
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.isContentEditable)
      ) {
        return;
      }
      if (!selected) return;
      e.preventDefault();
      if (selected.kind === 'gate') {
        const gid = selected.id;
        setCircuit((prev) => ({
          ...prev,
          gates: prev.gates.filter((g) => g.id !== gid),
          wires: prev.wires.filter((w) => {
            if ('gateId' in w.from && w.from.gateId === gid) return false;
            if ('gateId' in w.to && w.to.gateId === gid) return false;
            return true;
          }),
        }));
      } else {
        const wid = selected.id;
        setCircuit((prev) => ({
          ...prev,
          wires: prev.wires.filter((w) => w.id !== wid),
        }));
      }
      setSelected(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [allowDelete, selected]);

  function reset() {
    setCircuit(initialCircuit);
    const obj: Record<string, Bit> = {};
    for (const i of initialCircuit.inputs) obj[i.id] = i.value;
    setInputValues(obj);
    setSelected(null);
    setPendingFrom(null);
    try {
      window.localStorage.removeItem(`${storageKey}:circuit`);
    } catch {
      // ignore
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="not-prose mx-auto my-12 w-full max-w-[900px] text-apple-text">
      <p className="sr-only">
        Interactive circuit builder — visual interaction required. The current
        circuit&rsquo;s truth table is shown to the right of the canvas.
      </p>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <Palette gates={availableGates} draggable={allowAddGates} />

        <div className="flex flex-1 flex-col gap-3">
          <div
            className="relative rounded-xl border border-apple-border bg-[#f5f5f7] p-4"
            style={{
              width: CANVAS_W + FRAME_PAD * 2,
              height: CANVAS_H + FRAME_PAD * 2,
            }}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <svg
              ref={svgRef}
              viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
              width={CANVAS_W}
              height={CANVAS_H}
              className="block touch-none select-none text-apple-text"
              style={{ cursor: pendingFrom ? 'crosshair' : 'default' }}
              onClick={handleCanvasClick}
              onMouseMove={handleSvgMouseMove}
            >
              {/* Wires, with junctions for fan-out. */}
              {wireGroups.map(({ sourceKey, wires }) => {
                const sourceP = refToPoint(wires[0].from);
                const isActive = sourceRefActive(wires[0].from);
                if (wires.length === 1) {
                  return (
                    <WireSelectable
                      key={wires[0].id}
                      from={sourceP}
                      to={refToPoint(wires[0].to)}
                      active={isActive}
                      selected={
                        selected?.kind === 'wire' && selected.id === wires[0].id
                      }
                      onClick={(e) => handleWireClick(e, wires[0].id)}
                    />
                  );
                }
                const dests = wires.map((w) => refToPoint(w.to));
                const avgX =
                  dests.reduce((s, p) => s + p.x, 0) / dests.length;
                const avgY =
                  dests.reduce((s, p) => s + p.y, 0) / dests.length;
                const jx = Math.max(avgX - 70, (sourceP.x + avgX) / 2);
                const jp = { x: jx, y: avgY };
                return (
                  <g key={sourceKey}>
                    <WireSelectable
                      from={sourceP}
                      to={jp}
                      active={isActive}
                      selected={false}
                      onClick={() => undefined}
                      noHit
                    />
                    {wires.map((w) => (
                      <WireSelectable
                        key={w.id}
                        from={jp}
                        to={refToPoint(w.to)}
                        active={isActive}
                        selected={
                          selected?.kind === 'wire' && selected.id === w.id
                        }
                        onClick={(e) => handleWireClick(e, w.id)}
                      />
                    ))}
                    <circle
                      cx={jp.x}
                      cy={jp.y}
                      r="5"
                      stroke="none"
                      className="transition-colors duration-300 motion-reduce:transition-none"
                      style={{ fill: isActive ? '#0071e3' : '#1d1d1f' }}
                    />
                  </g>
                );
              })}

              {/* Pending wire: dashed ghost from the source port to the cursor. */}
              {pendingFrom && cursorSvg && (
                <PendingWireGhost
                  from={refToPoint(pendingFrom)}
                  to={cursorSvg}
                />
              )}

              {/* Gates */}
              {circuit.gates.map((g) => {
                const isSelected =
                  selected?.kind === 'gate' && selected.id === g.id;
                const isHovered = hoveredGateId === g.id;
                return (
                  <g
                    key={g.id}
                    onMouseDown={(e) => handleGateMouseDown(e, g.id)}
                    onClick={(e) => e.stopPropagation()}
                    onMouseEnter={() => setHoveredGateId(g.id)}
                    onMouseLeave={() =>
                      setHoveredGateId((curr) => (curr === g.id ? null : curr))
                    }
                    style={{ cursor: 'grab' }}
                  >
                    {/*
                      Transparent hit-area that fills the gate's bounding box
                      with ~6-8px padding. Without this, gates with fill="none"
                      only register clicks on their stroke pixels, so the
                      hollow interior of a D-shape or triangle would not be
                      selectable.
                    */}
                    <rect
                      x={g.position.x - 38}
                      y={g.position.y - 24}
                      width={76}
                      height={48}
                      fill="transparent"
                      pointerEvents="all"
                    />
                    {isHovered && !isSelected && (
                      <rect
                        x={g.position.x - 30}
                        y={g.position.y - 20}
                        width={60}
                        height={40}
                        rx="6"
                        fill="none"
                        stroke="#0071e3"
                        strokeOpacity="0.35"
                        strokeWidth="1"
                      />
                    )}
                    {isSelected && (
                      <rect
                        x={g.position.x - 30}
                        y={g.position.y - 20}
                        width={60}
                        height={40}
                        rx="6"
                        fill="rgba(0, 113, 227, 0.08)"
                        stroke="#0071e3"
                        strokeWidth="1.5"
                        strokeDasharray="4 3"
                      />
                    )}
                    <GateSymbol
                      kind={g.kind}
                      x={g.position.x}
                      y={g.position.y}
                    />
                  </g>
                );
              })}

              {/* Ports — rendered last so they sit on top of gates and wires. */}
              {circuit.gates.flatMap((g) => {
                const arity = getGateArity(g.kind);
                const items: Array<{
                  ref: { gateId: string; port: 'in1' | 'in2' | 'out' };
                  point: { x: number; y: number };
                }> = [
                  {
                    ref: { gateId: g.id, port: 'in1' },
                    point: refToPoint({ gateId: g.id, port: 'in1' }),
                  },
                ];
                if (arity === 2) {
                  items.push({
                    ref: { gateId: g.id, port: 'in2' },
                    point: refToPoint({ gateId: g.id, port: 'in2' }),
                  });
                }
                items.push({
                  ref: { gateId: g.id, port: 'out' },
                  point: refToPoint({ gateId: g.id, port: 'out' }),
                });
                return items.map((p) => (
                  <Port
                    key={`${g.id}:${p.ref.port}`}
                    point={p.point}
                    ref_={p.ref}
                    pendingFrom={pendingFrom}
                    hovered={!!hoveredPort && portRefEqual(hoveredPort, p.ref)}
                    onPointerEnter={() => setHoveredPort(p.ref)}
                    onPointerLeave={() => setHoveredPort(null)}
                    onClick={(e) => handlePortClick(e, p.ref)}
                  />
                ));
              })}

              {/* Circuit input ports (sources) */}
              {circuit.inputs.map((input) => {
                const ref: PortRef = { source: 'input', inputId: input.id };
                return (
                  <Port
                    key={`input-port-${input.id}`}
                    point={refToPoint(ref)}
                    ref_={ref}
                    pendingFrom={pendingFrom}
                    hovered={!!hoveredPort && portRefEqual(hoveredPort, ref)}
                    onPointerEnter={() => setHoveredPort(ref)}
                    onPointerLeave={() => setHoveredPort(null)}
                    onClick={(e) => handlePortClick(e, ref)}
                  />
                );
              })}

              {/* Circuit output ports (destinations) */}
              {circuit.outputs.map((output) => {
                const ref: PortRef = { source: 'output', outputId: output.id };
                return (
                  <Port
                    key={`output-port-${output.id}`}
                    point={refToPoint(ref)}
                    ref_={ref}
                    pendingFrom={pendingFrom}
                    hovered={!!hoveredPort && portRefEqual(hoveredPort, ref)}
                    onPointerEnter={() => setHoveredPort(ref)}
                    onPointerLeave={() => setHoveredPort(null)}
                    onClick={(e) => handlePortClick(e, ref)}
                  />
                );
              })}
            </svg>

            {/* Input switches (HTML, on top of the SVG) */}
            {circuit.inputs.map((input, idx) => (
              <div
                key={input.id}
                className="absolute"
                style={{
                  left: EDGE_PADDING + FRAME_PAD,
                  top:
                    inputCenterY(idx) -
                    INPUT_TOTAL_HEIGHT / 2 +
                    FRAME_PAD,
                  width: INPUT_WIDTH,
                }}
              >
                <InputSwitch
                  value={inputValues[input.id] ?? 0}
                  onChange={(v) =>
                    setInputValues((prev) => ({ ...prev, [input.id]: v }))
                  }
                  label={input.label}
                />
              </div>
            ))}

            {/* Output bulbs (HTML, on top of the SVG) */}
            {circuit.outputs.map((output, idx) => (
              <div
                key={output.id}
                className="absolute"
                style={{
                  left:
                    CANVAS_W -
                    EDGE_PADDING -
                    OUTPUT_WIDTH +
                    FRAME_PAD,
                  top:
                    outputCenterY(idx) -
                    OUTPUT_TOTAL_HEIGHT / 2 +
                    FRAME_PAD,
                  width: OUTPUT_WIDTH,
                }}
              >
                <OutputBulb
                  value={outputValues[output.id] ?? 0}
                  label={output.label}
                />
              </div>
            ))}

            {/* Error tooltip (HTML overlay) */}
            {errorMsg && (
              <div
                className="pointer-events-none absolute rounded-md bg-white px-2 py-1 text-xs font-medium text-red-600 shadow-md ring-1 ring-red-300"
                style={{
                  left: errorMsg.at.x + FRAME_PAD + 12,
                  top: errorMsg.at.y + FRAME_PAD - 24,
                }}
              >
                {errorMsg.text}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-apple-text-secondary">
            <span>
              {pendingFrom
                ? 'Click a destination port to complete the wire (Esc to cancel).'
                : selected
                  ? 'Selected. Press Delete or Backspace to remove.'
                  : 'Drag a gate from the palette. Click ports to wire.'}
            </span>
            <button
              type="button"
              onClick={reset}
              className="rounded-full border border-apple-border bg-white px-4 py-1.5 text-xs font-medium text-apple-text-secondary transition-colors duration-200 hover:text-apple-text focus:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue focus-visible:ring-offset-2 motion-reduce:transition-none"
            >
              Reset
            </button>
          </div>
        </div>

        <SidePanel
          live={liveTruthTable}
          target={targetTruthTable}
          solved={isSolved}
        />
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function Palette({
  gates,
  draggable,
}: {
  gates: GateKind[];
  draggable: boolean;
}) {
  return (
    <div className="w-full lg:w-[140px]">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-apple-text-secondary">
        Palette
      </h3>
      <div className="flex flex-row gap-2 lg:flex-col">
        {gates.map((kind) => (
          <PaletteItem key={kind} kind={kind} draggable={draggable} />
        ))}
      </div>
    </div>
  );
}

function PaletteItem({
  kind,
  draggable,
}: {
  kind: GateKind;
  draggable: boolean;
}) {
  return (
    <div
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData(PALETTE_MIME, kind);
        e.dataTransfer.effectAllowed = 'copy';
      }}
      className={`flex flex-col items-center gap-1 rounded-lg border border-apple-border bg-white p-2 transition-colors duration-200 motion-reduce:transition-none ${
        draggable
          ? 'cursor-grab hover:border-apple-blue/40 active:cursor-grabbing'
          : 'opacity-60'
      }`}
      aria-label={`${kind} gate`}
      title={draggable ? `Drag to add a ${kind} gate` : `${kind} gate`}
    >
      <svg viewBox="-32 -22 64 50" className="block h-10 w-full text-apple-text">
        <GateSymbol kind={kind} x={0} y={0} size={40} showLabel={false} />
      </svg>
      <p className="text-xs font-medium text-apple-text-secondary">{kind}</p>
    </div>
  );
}

function Port({
  point,
  ref_,
  pendingFrom,
  hovered,
  onPointerEnter,
  onPointerLeave,
  onClick,
}: {
  point: { x: number; y: number };
  ref_: PortRef;
  pendingFrom: PortRef | null;
  hovered: boolean;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  onClick: (e: React.MouseEvent) => void;
}) {
  // A port is a "valid drop target" while a wire is pending iff:
  //   - it's a destination-style port (gate input or circuit output)
  //   - it isn't the same port we started from
  const valid =
    !!pendingFrom && isDestPort(ref_) && !portRefEqual(pendingFrom, ref_);

  const stroke = valid || hovered ? '#0071e3' : '#1d1d1f';
  const r = hovered || valid ? PORT_R + 1 : PORT_R;

  return (
    <>
      <circle
        cx={point.x}
        cy={point.y}
        r={r}
        fill="white"
        stroke={stroke}
        strokeWidth="1.5"
        className="transition-all duration-150 motion-reduce:transition-none"
        style={{ pointerEvents: 'none' }}
      />
      {valid && (
        <circle
          cx={point.x}
          cy={point.y}
          r={r + 4}
          fill="none"
          stroke="#0071e3"
          strokeWidth="1.5"
          opacity="0.35"
          style={{ pointerEvents: 'none' }}
        />
      )}
      {/* Larger invisible hit-area circle. */}
      <circle
        cx={point.x}
        cy={point.y}
        r={PORT_HIT_R}
        fill="transparent"
        style={{ cursor: 'crosshair' }}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onClick={onClick}
      />
    </>
  );
}

function WireSelectable({
  from,
  to,
  active,
  selected,
  onClick,
  noHit,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  active: boolean;
  selected: boolean;
  onClick: (e: React.MouseEvent) => void;
  noHit?: boolean;
}) {
  const dx = to.x - from.x;
  const cx = Math.max(40, Math.abs(dx) * 0.4);
  const path = `M ${from.x} ${from.y} C ${from.x + cx} ${from.y}, ${to.x - cx} ${to.y}, ${to.x} ${to.y}`;

  return (
    <g>
      {selected && (
        <path
          d={path}
          fill="none"
          stroke="#0071e3"
          strokeOpacity="0.25"
          strokeWidth="8"
          strokeLinecap="round"
        />
      )}
      <Wire from={from} to={to} active={active} />
      {!noHit && (
        <path
          d={path}
          fill="none"
          stroke="transparent"
          strokeWidth="12"
          style={{ cursor: 'pointer' }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={onClick}
        />
      )}
    </g>
  );
}

function PendingWireGhost({
  from,
  to,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
}) {
  const dx = to.x - from.x;
  const cx = Math.max(40, Math.abs(dx) * 0.4);
  const path = `M ${from.x} ${from.y} C ${from.x + cx} ${from.y}, ${to.x - cx} ${to.y}, ${to.x} ${to.y}`;
  return (
    <path
      d={path}
      fill="none"
      stroke="#0071e3"
      strokeWidth="1.5"
      strokeDasharray="5 4"
      strokeLinecap="round"
      opacity="0.7"
      style={{ pointerEvents: 'none' }}
    />
  );
}

function SidePanel({
  live,
  target,
  solved,
}: {
  live: TruthTable;
  target?: TruthTable;
  solved: boolean;
}) {
  return (
    <div className="w-full space-y-4 lg:w-[160px]">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-apple-text-secondary">
            Live
          </h3>
          <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-apple-text-secondary">
            <span
              aria-hidden="true"
              className="inline-block h-1.5 w-1.5 rounded-full bg-apple-blue"
            />
            updating
          </span>
        </div>
        <TruthTableDisplay table={live} />
      </div>

      {target && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-apple-text-secondary">
            Target
          </h3>
          <TruthTableDisplay table={target} />
        </div>
      )}

      {target && (
        <div
          className={`rounded-md p-2 text-xs ${
            solved
              ? 'bg-green-50/60 text-apple-text'
              : 'bg-transparent text-apple-text-secondary'
          }`}
        >
          {solved ? (
            <span className="flex items-center gap-1.5 font-medium">
              <CheckIcon />
              Circuit complete!
            </span>
          ) : (
            <span>Wire it up to match the target.</span>
          )}
        </div>
      )}
    </div>
  );
}

function TruthTableDisplay({ table }: { table: TruthTable }) {
  return (
    <table className="w-full table-fixed border-collapse text-center">
      <thead>
        <tr>
          {table.inputs.map((id) => (
            <th
              key={`i-${id}`}
              className="border-b border-apple-border px-1 py-1 text-[10px] font-semibold uppercase tracking-wider text-apple-text-secondary"
            >
              {id}
            </th>
          ))}
          {table.outputs.map((id) => (
            <th
              key={`o-${id}`}
              className="border-b border-l border-apple-border px-1 py-1 text-[10px] font-semibold uppercase tracking-wider text-apple-text-secondary"
            >
              {id}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {table.rows.map((row, i) => (
          <tr key={i}>
            {row.inputValues.map((v, j) => (
              <td
                key={`iv-${j}`}
                className="border-t border-apple-border/50 px-1 py-1 font-mono text-xs text-apple-text-secondary"
              >
                {v}
              </td>
            ))}
            {row.outputValues.map((v, j) => (
              <td
                key={`ov-${j}`}
                className="border-l border-t border-apple-border/50 px-1 py-1 font-mono text-xs font-medium text-apple-text"
              >
                {v}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CheckIcon() {
  return (
    <svg
      className="h-4 w-4 flex-shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#16a34a"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

// ─── Misc ───────────────────────────────────────────────────────────────────

function makeId(): string {
  // crypto.randomUUID exists in modern browsers and Node 19+. Fall back to a
  // simple random string if it's missing (very old environments).
  const c = (
    globalThis as { crypto?: { randomUUID?: () => string } }
  ).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
