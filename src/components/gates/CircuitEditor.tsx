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
  /**
   * Optional fully-wired solution. When provided, a "Show solution" button
   * appears next to Reset; clicking it (after confirmation) replaces the
   * current circuit with this one. The learner can keep editing afterwards.
   */
  solutionCircuit?: Circuit;
  onSolved?: () => void;
  storageKey: string;
}

// ─── Layout constants ───────────────────────────────────────────────────────
// SVG coordinate space. The actual rendered size is responsive (CSS scales
// the SVG via viewBox), but internal coordinates always speak in these units.
const CANVAS_W = 568;
const CANVAS_H = 368;
const FRAME_PAD = 16; // padding inside the bordered frame, in SVG units
const FRAME_W = CANVAS_W + FRAME_PAD * 2; // 600
const FRAME_H = CANVAS_H + FRAME_PAD * 2; // 400

const INPUT_WIDTH = 64;
const INPUT_TOTAL_HEIGHT = 48;
const OUTPUT_WIDTH = 64;
const OUTPUT_TOTAL_HEIGHT = 80;
const EDGE_PADDING = 12;

const GRID = 20; // gate positions snap to this on drop / drag-end
const PORT_R = 5;
const PORT_HIT_R = 14; // bigger hit area for finger taps

// Distance (in SVG units) from the visible edge of an input switch / output
// bulb to the port circle that lives at the boundary with the canvas. Large
// enough that the port circle is clearly visible and its hit area sits on
// the canvas side of the HTML overlay rather than on top of the button/bulb.
const EDGE_PORT_GAP = 14;

// Two gates count as "overlapping" if their centers are within these
// distances. The gate body is ~32x32; this leaves a small breathing margin.
const MIN_GAP_X = 40;
const MIN_GAP_Y = 32;

// Keep gate centers this far inside the canvas edges so they don't crash
// into the input switches or output bulbs.
const PLACEMENT_MARGIN_X = 100;
const PLACEMENT_MARGIN_Y = 40;

// Drag threshold in SVG units — pointer needs to move this far before a
// gesture is treated as a drag (rather than a tap-to-select).
const DRAG_THRESHOLD = 4;

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
  solutionCircuit,
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
    pointerId: number;
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
        // Port sits ~14 SVG units to the right of the input switch's right
        // edge, on the canvas side. This keeps the port circle visible and
        // its hit area off the HTML overlay so taps go to the SVG.
        const idx = circuit.inputs.findIndex((i) => i.id === ref.inputId);
        return {
          x: EDGE_PADDING + INPUT_WIDTH + EDGE_PORT_GAP,
          y: inputCenterY(idx),
        };
      }
      // Output port: ~14 SVG units to the left of the bulb body, vertically
      // centered on the bulb. The bulb's decorative cord at the top no longer
      // serves as the wire entry point; the wire ends at this port instead.
      const idx = circuit.outputs.findIndex((o) => o.id === ref.outputId);
      return {
        x: CANVAS_W - EDGE_PADDING - OUTPUT_WIDTH - EDGE_PORT_GAP,
        y: outputCenterY(idx),
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

  // ─── Adding gates from the palette ───────────────────────────────────────
  // A single tap on a palette item adds a gate at a free spot near the
  // canvas center. This is the touch-friendly path. On desktop the same
  // click works; the legacy HTML5 drag-and-drop has been removed since it
  // never worked on touch and is now redundant.
  function addGateFromPalette(kind: GateKind) {
    if (!allowAddGates) return;
    if (!availableGates.includes(kind)) return;
    const id = makeId();
    setCircuit((prev) => {
      const desired = clampToBounds({
        x: snap(CANVAS_W / 2),
        y: snap(CANVAS_H / 2),
      });
      const free = findFreePosition(prev.gates, null, desired);
      const newGate: GateInstance = { id, kind, position: free };
      return { ...prev, gates: [...prev.gates, newGate] };
    });
    setSelected({ kind: 'gate', id });
  }

  // ─── Gate dragging via pointer events (works for mouse, touch, pen) ──────
  function handleGatePointerDown(e: React.PointerEvent, gateId: string) {
    if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') {
      return;
    }
    e.stopPropagation();
    const gate = circuit.gates.find((g) => g.id === gateId);
    if (!gate) return;
    const pt = screenToSvg(e.clientX, e.clientY);
    dragRef.current = {
      pointerId: e.pointerId,
      gateId,
      startSvg: pt,
      gateStart: { ...gate.position },
      moved: false,
    };
    // Capture the pointer so move/up events keep firing even if it leaves
    // the gate's hit area.
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }

  function handleGatePointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const pt = screenToSvg(e.clientX, e.clientY);
    const dx = pt.x - d.startSvg.x;
    const dy = pt.y - d.startSvg.y;
    if (!d.moved && Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) {
      return;
    }
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

  function handleGatePointerUp(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
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
      // Tap → select.
      setSelected({ kind: 'gate', id: d.gateId });
    }
    dragRef.current = null;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  }

  // Wire creation by clicking a source port, then a destination port.
  function handlePortClick(e: React.MouseEvent | React.PointerEvent, ref: PortRef) {
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

  // Delete the currently selected gate or wire. Wired up to:
  //   - Delete / Backspace key
  //   - The visible "Delete" button (touch users have no keyboard)
  function deleteSelected() {
    if (!allowDelete) return;
    if (!selected) return;
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

  // Keyboard: Escape cancels pending / selection; Delete or Backspace removes
  // the selected gate or wire.
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
      deleteSelected();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // deleteSelected is stable enough — it captures `selected` and
    // `allowDelete` from closure each render, fine for keydown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  function showSolution() {
    if (!solutionCircuit) return;
    const ok = window.confirm(
      'Reveal the solution? You can keep editing the circuit afterwards.',
    );
    if (!ok) return;
    setCircuit(solutionCircuit);
    setSelected(null);
    setPendingFrom(null);
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="not-prose mx-auto my-12 w-full max-w-[760px] text-apple-text">
      <p className="sr-only">
        Interactive circuit builder — visual interaction required. The current
        circuit&rsquo;s truth table is shown below the canvas.
      </p>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <Palette
          gates={availableGates}
          enabled={allowAddGates}
          onAdd={addGateFromPalette}
        />

        <div className="flex flex-1 flex-col gap-3 min-w-0">
          {/*
            Responsive frame: the SVG scales by viewBox, the HTML overlays
            (input switches, output bulbs) are positioned in percentage of the
            frame so they slide along when the canvas resizes. The aspect
            ratio is locked to the SVG's so nothing distorts.
          */}
          <div
            className="relative w-full rounded-xl border border-apple-border bg-apple-frame"
            style={{
              aspectRatio: `${FRAME_W} / ${FRAME_H}`,
              maxWidth: FRAME_W,
              touchAction: 'none',
            }}
          >
            <svg
              ref={svgRef}
              viewBox={`${-FRAME_PAD} ${-FRAME_PAD} ${FRAME_W} ${FRAME_H}`}
              preserveAspectRatio="xMidYMid meet"
              className="absolute inset-0 h-full w-full select-none text-apple-text"
              style={{ cursor: pendingFrom ? 'crosshair' : 'default', touchAction: 'none' }}
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
                      style={{ fill: isActive ? 'rgb(var(--apple-blue))' : 'rgb(var(--apple-text))' }}
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
                    onPointerDown={(e) => handleGatePointerDown(e, g.id)}
                    onPointerMove={handleGatePointerMove}
                    onPointerUp={handleGatePointerUp}
                    onPointerCancel={handleGatePointerUp}
                    onClick={(e) => e.stopPropagation()}
                    onMouseEnter={() => setHoveredGateId(g.id)}
                    onMouseLeave={() =>
                      setHoveredGateId((curr) => (curr === g.id ? null : curr))
                    }
                    style={{ cursor: 'grab', touchAction: 'none' }}
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
                        style={{ stroke: "rgb(var(--apple-blue))" }}
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
                        style={{
                          fill: 'rgb(var(--apple-blue) / 0.08)',
                          stroke: 'rgb(var(--apple-blue))',
                        }}
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

            {/*
              Input switches and output bulbs are HTML overlays positioned in
              percentages of the SVG coordinate space (which equals the
              container, since aspect-ratio matches viewBox). They do not
              shrink — input switches need a fingertip-sized hit area at any
              viewport — so on very small viewports the visual density
              increases but interaction stays workable.
            */}
            {circuit.inputs.map((input, idx) => {
              const cy = inputCenterY(idx);
              return (
                <div
                  key={input.id}
                  // pointer-events-none on the wrapper means clicks fall
                  // through to the SVG behind it (so port circles right at
                  // the wrapper's edge stay clickable). The InputSwitch's
                  // own button has pointer-events: auto from the browser
                  // default and still receives toggles normally.
                  className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
                  style={{
                    left: `${((EDGE_PADDING + INPUT_WIDTH / 2) / FRAME_W) * 100 + (FRAME_PAD / FRAME_W) * 100}%`,
                    top: `${(cy / FRAME_H) * 100 + (FRAME_PAD / FRAME_H) * 100}%`,
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
              );
            })}

            {circuit.outputs.map((output, idx) => {
              const cy = outputCenterY(idx);
              return (
                <div
                  key={output.id}
                  className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
                  style={{
                    left: `${((CANVAS_W - EDGE_PADDING - OUTPUT_WIDTH / 2) / FRAME_W) * 100 + (FRAME_PAD / FRAME_W) * 100}%`,
                    top: `${(cy / FRAME_H) * 100 + (FRAME_PAD / FRAME_H) * 100}%`,
                  }}
                >
                  <OutputBulb
                    value={outputValues[output.id] ?? 0}
                    label={output.label}
                  />
                </div>
              );
            })}

            {/* Error tooltip — also positioned as a percentage. */}
            {errorMsg && (
              <div
                className="pointer-events-none absolute rounded-md bg-apple-surface px-2 py-1 text-xs font-medium text-red-600 shadow-md ring-1 ring-red-300"
                style={{
                  left: `${((errorMsg.at.x + 12) / FRAME_W) * 100 + (FRAME_PAD / FRAME_W) * 100}%`,
                  top: `${((errorMsg.at.y - 24) / FRAME_H) * 100 + (FRAME_PAD / FRAME_H) * 100}%`,
                }}
              >
                {errorMsg.text}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-apple-text-secondary">
            <span>
              {pendingFrom
                ? 'Tap a destination port to complete the wire (Esc to cancel).'
                : selected
                  ? selected.kind === 'gate'
                    ? 'Gate selected. Tap Delete to remove, or drag to move.'
                    : 'Wire selected. Tap Delete to remove.'
                  : 'Tap a gate in the palette to add it. Tap ports to wire.'}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {selected && allowDelete && (
                <button
                  type="button"
                  onClick={deleteSelected}
                  className="rounded-full border border-red-300 bg-apple-surface px-4 py-1.5 text-xs font-medium text-red-600 transition-colors duration-200 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 motion-reduce:transition-none"
                >
                  Delete
                </button>
              )}
              {solutionCircuit && (
                <button
                  type="button"
                  onClick={showSolution}
                  className="rounded-full border border-apple-border bg-apple-surface px-4 py-1.5 text-xs font-medium text-apple-text-secondary transition-colors duration-200 hover:text-apple-text focus:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue focus-visible:ring-offset-2 motion-reduce:transition-none"
                >
                  Show solution
                </button>
              )}
              <button
                type="button"
                onClick={reset}
                className="rounded-full border border-apple-border bg-apple-surface px-4 py-1.5 text-xs font-medium text-apple-text-secondary transition-colors duration-200 hover:text-apple-text focus:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue focus-visible:ring-offset-2 motion-reduce:transition-none"
              >
                Reset
              </button>
            </div>
          </div>

          <TruthTablesPanel
            live={liveTruthTable}
            target={targetTruthTable}
            solved={isSolved}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function Palette({
  gates,
  enabled,
  onAdd,
}: {
  gates: GateKind[];
  enabled: boolean;
  onAdd: (kind: GateKind) => void;
}) {
  return (
    <div className="w-full lg:w-[140px] lg:flex-shrink-0">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-apple-text-secondary">
        Palette
      </h3>
      <div className="flex flex-row flex-wrap gap-2 lg:flex-col">
        {gates.map((kind) => (
          <PaletteItem key={kind} kind={kind} enabled={enabled} onAdd={onAdd} />
        ))}
      </div>
    </div>
  );
}

function PaletteItem({
  kind,
  enabled,
  onAdd,
}: {
  kind: GateKind;
  enabled: boolean;
  onAdd: (kind: GateKind) => void;
}) {
  return (
    <button
      type="button"
      disabled={!enabled}
      onClick={() => onAdd(kind)}
      className={`flex flex-col items-center gap-1 rounded-lg border border-apple-border bg-apple-surface p-2 transition-colors duration-200 motion-reduce:transition-none ${
        enabled
          ? 'cursor-pointer hover:border-apple-blue/40 active:bg-apple-bg/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue focus-visible:ring-offset-2'
          : 'opacity-60'
      }`}
      aria-label={`Add a ${kind} gate to the canvas`}
      title={enabled ? `Add a ${kind} gate` : `${kind} gate`}
    >
      <svg viewBox="-32 -22 64 50" className="block h-10 w-full text-apple-text">
        <GateSymbol kind={kind} x={0} y={0} size={40} showLabel={false} />
      </svg>
      <p className="text-xs font-medium text-apple-text-secondary">{kind}</p>
    </button>
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

  const stroke = valid || hovered ? 'rgb(var(--apple-blue))' : 'rgb(var(--apple-text))';
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
          style={{ stroke: "rgb(var(--apple-blue))" }}
          strokeWidth="1.5"
          opacity="0.35"
          style={{ pointerEvents: 'none' }}
        />
      )}
      {/*
        Larger invisible hit-area circle. Sized for fingertips (PORT_HIT_R)
        so taps land reliably on touch.
      */}
      <circle
        cx={point.x}
        cy={point.y}
        r={PORT_HIT_R}
        fill="transparent"
        style={{ cursor: 'crosshair', touchAction: 'none' }}
        onPointerDown={(e) => e.stopPropagation()}
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
          style={{ stroke: "rgb(var(--apple-blue))" }}
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
          strokeWidth="16"
          style={{ cursor: 'pointer', touchAction: 'none' }}
          onPointerDown={(e) => e.stopPropagation()}
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
      style={{ stroke: "rgb(var(--apple-blue))" }}
      strokeWidth="1.5"
      strokeDasharray="5 4"
      strokeLinecap="round"
      opacity="0.7"
      style={{ pointerEvents: 'none' }}
    />
  );
}

function TruthTablesPanel({
  live,
  target,
  solved,
}: {
  live: TruthTable;
  target?: TruthTable;
  solved: boolean;
}) {
  // Live and Target sit side-by-side in a horizontal row. Each is capped at
  // a sensible width so the tables don't stretch absurdly wide; the row
  // centers within the canvas column. Below them, the verification status.
  return (
    <div className="mt-3 flex flex-col gap-3">
      <div className="flex flex-wrap items-start gap-6">
        <div className="min-w-[140px] flex-1">
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
          <div className="min-w-[140px] flex-1">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-apple-text-secondary">
              Target
            </h3>
            <TruthTableDisplay table={target} />
          </div>
        )}
      </div>

      {target && (
        <div
          className={`rounded-md p-2 text-xs ${
            solved
              ? 'bg-green-50/60 text-apple-text dark:bg-green-900/20'
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
