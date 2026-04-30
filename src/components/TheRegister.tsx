import { useEffect, useRef, useState } from 'react';
import type { Bit } from '../lib/gates/types';
import GateSymbol from './gates/GateSymbol';
import InputSwitch from './gates/InputSwitch';

/**
 * TheRegister — lesson-10 scene.
 *
 * Builds on lesson 9's byte (8 stored bits + a shared 'set' wire) and adds
 * the *Enabler*: eight AND gates that share a single 'enable' input. When the
 * enable line is 0, every AND outputs 0 regardless of its stored bit; when 1,
 * each AND passes its stored bit through. Byte + Enabler = a Register, the
 * unit every CPU register and every memory cell is built from.
 *
 * The widget shows all eight ANDs explicitly, rotated so data flows top-to-
 * bottom: stored cell on top → AND in the middle → output cell below. The
 * shared enable line crosses horizontally through every AND's enable input,
 * making the "one switch governs all eight" idea visceral.
 *
 * Pure state-machine — no gate-level simulator. Output is computed as
 * stored[i] AND enable for each i.
 */

const STORAGE_KEY = 'hciw:the-register:state';
const FLASH_MS = 380;
const ZERO_BYTE: Bit[] = [0, 0, 0, 0, 0, 0, 0, 0];

interface PersistedState {
  inputs: Bit[];
  stored: Bit[];
  enable: Bit;
}

function defaultState(): PersistedState {
  return { inputs: [...ZERO_BYTE], stored: [...ZERO_BYTE], enable: 0 };
}

function validateByte(arr: unknown): Bit[] | null {
  if (!Array.isArray(arr) || arr.length !== 8) return null;
  if (!arr.every((b) => b === 0 || b === 1)) return null;
  return arr as Bit[];
}

function loadState(): PersistedState {
  if (typeof window === 'undefined') return defaultState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      inputs: validateByte(parsed.inputs) ?? [...ZERO_BYTE],
      stored: validateByte(parsed.stored) ?? [...ZERO_BYTE],
      enable: parsed.enable === 1 ? 1 : 0,
    };
  } catch {
    return defaultState();
  }
}

function bitsToNumber(bits: Bit[]): number {
  let n = 0;
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] === 1) n += 1 << i;
  }
  return n;
}

function bitsAsBinary(bits: Bit[]): string {
  const msbFirst = [...bits].reverse().join('');
  return `${msbFirst.slice(0, 4)} ${msbFirst.slice(4)}`;
}

const COL_WIDTH = 64;
const COL_GAP = 12;
const COL_COUNT = 8;
const ROW_WIDTH = COL_COUNT * COL_WIDTH + (COL_COUNT - 1) * COL_GAP; // 596
const COL_CENTER = (i: number) => COL_WIDTH / 2 + i * (COL_WIDTH + COL_GAP);
const POSITIONS = [7, 6, 5, 4, 3, 2, 1, 0] as const;

// Enabler SVG layout — total 88 px tall.
//   y=0  is the top edge (where data wires enter from the stored-cells row).
//   y=22 is where the shared enable line runs (also the AND gates' input row).
//   y=36 is the AND gate center.
//   y=88 is the bottom edge (where output wires exit to the output-cells row).
// AND gates are scaled to 32 px and rotated -90° so their two inputs sit at
// the top (y=22) and the output points straight down (y=52).
const ENABLER_H = 88;
const AND_CY = 36;
const AND_SCALE = 0.5; // size 32 → scale 0.5
const AND_INPUT_Y = AND_CY - 14; // = 22
const AND_INPUT_DX = 5; // ±5 from gate center
const AND_OUT_Y = AND_CY + 16; // = 52

export default function TheRegister() {
  const [state, setState] = useState<PersistedState>(defaultState);
  const [hydrated, setHydrated] = useState(false);
  const [flash, setFlash] = useState(false);
  const flashTimer = useRef<number | null>(null);

  useEffect(() => {
    setState(loadState());
    setHydrated(true);
    return () => {
      if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // localStorage may be disabled — keep going.
    }
  }, [hydrated, state]);

  const { inputs, stored, enable } = state;

  function setBit(i: number, v: Bit) {
    setState((prev) => ({
      ...prev,
      inputs: prev.inputs.map((b, j) => (j === i ? v : b)),
    }));
  }

  function store() {
    setState((prev) => ({ ...prev, stored: [...prev.inputs] }));
    if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    setFlash(true);
    flashTimer.current = window.setTimeout(() => {
      setFlash(false);
      flashTimer.current = null;
    }, FLASH_MS);
  }

  function setEnable(v: Bit) {
    setState((prev) => ({ ...prev, enable: v }));
  }

  function reset() {
    if (flashTimer.current !== null) {
      window.clearTimeout(flashTimer.current);
      flashTimer.current = null;
    }
    setFlash(false);
    setState(defaultState());
  }

  // Output is the AND of each stored bit with the shared enable line.
  const outputs: Bit[] = stored.map((b) => ((b === 1 && enable === 1 ? 1 : 0) as Bit));

  const storedDecimal = bitsToNumber(stored);
  const storedBinary = bitsAsBinary(stored);
  const outputDecimal = bitsToNumber(outputs);
  const outputBinary = bitsAsBinary(outputs);

  const wireOff = 'rgb(var(--apple-text-secondary))';
  const wireOn = 'rgb(var(--apple-blue))';

  return (
    <div className="not-prose mx-auto my-12 w-full max-w-[680px] text-apple-text">
      <div className="overflow-x-auto pb-1">
        <div className="mx-auto" style={{ width: ROW_WIDTH }}>
          {/* Inputs */}
          <div className="text-center text-xs font-semibold uppercase tracking-widest text-apple-text-secondary">
            Inputs
          </div>
          <div
            className="mt-2 grid place-items-center"
            style={{
              gridTemplateColumns: `repeat(${COL_COUNT}, ${COL_WIDTH}px)`,
              columnGap: `${COL_GAP}px`,
            }}
          >
            {POSITIONS.map((pos) => (
              <div key={`in-${pos}`} className="flex flex-col items-center gap-1.5">
                <span className="font-mono text-[11px] text-apple-text-secondary">
                  bit {pos}
                </span>
                <InputSwitch
                  value={inputs[pos]}
                  onChange={(v) => setBit(pos, v)}
                  label={`Input bit ${pos}`}
                />
              </div>
            ))}
          </div>

          {/* Stub from each input to the stored cell below. */}
          <svg
            viewBox={`0 0 ${ROW_WIDTH} 16`}
            width={ROW_WIDTH}
            height={16}
            className="mt-3 block"
            aria-hidden="true"
          >
            {POSITIONS.map((pos, idx) => {
              const cx = COL_CENTER(idx);
              const active = inputs[pos] === 1;
              return (
                <line
                  key={`data-stub-${pos}`}
                  x1={cx}
                  y1={0}
                  x2={cx}
                  y2={16}
                  stroke={active ? wireOn : wireOff}
                  strokeWidth={2}
                  className="transition-colors duration-200 motion-reduce:transition-none"
                />
              );
            })}
          </svg>

          {/* Stored cells (the byte). */}
          <div className="text-center text-[11px] font-semibold uppercase tracking-widest text-apple-text-secondary">
            Stored byte
          </div>
          <div
            className="mt-1 grid place-items-center"
            style={{
              gridTemplateColumns: `repeat(${COL_COUNT}, ${COL_WIDTH}px)`,
              columnGap: `${COL_GAP}px`,
            }}
          >
            {POSITIONS.map((pos) => (
              <BitCell
                key={`stored-${pos}`}
                value={stored[pos]}
                ariaLabel={`Stored bit: ${stored[pos]}`}
                flash={flash}
                tone="stored"
              />
            ))}
          </div>

          {/* Enabler block: vertical data wires → 8 ANDs sharing an enable line → output stubs. */}
          <div className="mt-3 text-center text-[11px] font-semibold uppercase tracking-widest text-apple-text-secondary">
            Enabler
          </div>
          <svg
            viewBox={`0 0 ${ROW_WIDTH} ${ENABLER_H}`}
            width={ROW_WIDTH}
            height={ENABLER_H}
            className="mt-1 block text-apple-text-secondary"
            aria-hidden="true"
          >
            {/* Shared enable line: passes through every AND's right top input. */}
            <line
              x1={COL_CENTER(0) + AND_INPUT_DX}
              y1={AND_INPUT_Y}
              x2={COL_CENTER(COL_COUNT - 1) + AND_INPUT_DX + 16}
              y2={AND_INPUT_Y}
              stroke={enable === 1 ? wireOn : wireOff}
              strokeWidth={2}
              className="transition-colors duration-200 motion-reduce:transition-none"
            />
            <text
              x={COL_CENTER(COL_COUNT - 1) + AND_INPUT_DX + 22}
              y={AND_INPUT_Y + 4}
              fontSize={12}
              style={{ fill: "rgb(var(--apple-text-secondary))" }}
              stroke="none"
            >
              e
            </text>

            {POSITIONS.map((pos, idx) => {
              const cx = COL_CENTER(idx);
              const dataActive = stored[pos] === 1;
              const outActive = outputs[pos] === 1;
              const dataInX = cx - AND_INPUT_DX;
              const dataInY = AND_INPUT_Y;

              return (
                <g key={`and-col-${pos}`}>
                  {/* Data wire: drops from top, bends slightly left into the AND's left top input. */}
                  <polyline
                    points={`${cx},0 ${cx},${dataInY - 4} ${dataInX},${dataInY}`}
                    stroke={dataActive ? wireOn : wireOff}
                    strokeWidth={2}
                    fill="none"
                    className="transition-colors duration-200 motion-reduce:transition-none"
                  />
                  {/* Junction dot where the enable line meets this AND's enable input. */}
                  <circle
                    cx={cx + AND_INPUT_DX}
                    cy={dataInY}
                    r={2.5}
                    fill={enable === 1 ? wireOn : wireOff}
                    className="transition-colors duration-200 motion-reduce:transition-none"
                  />
                  {/* AND gate, rotated -90° so output points straight down. */}
                  <g transform={`rotate(-90 ${cx} ${AND_CY})`}>
                    <GateSymbol
                      kind="AND"
                      x={cx}
                      y={AND_CY}
                      size={64 * AND_SCALE}
                      showLabel={false}
                    />
                  </g>
                  {/* Output wire: down from gate output to bottom edge. */}
                  <line
                    x1={cx}
                    y1={AND_OUT_Y}
                    x2={cx}
                    y2={ENABLER_H}
                    stroke={outActive ? wireOn : wireOff}
                    strokeWidth={2}
                    className="transition-colors duration-200 motion-reduce:transition-none"
                  />
                </g>
              );
            })}
          </svg>

          {/* Output cells. */}
          <div className="text-center text-[11px] font-semibold uppercase tracking-widest text-apple-text-secondary">
            Output
          </div>
          <div
            className="mt-1 grid place-items-center"
            style={{
              gridTemplateColumns: `repeat(${COL_COUNT}, ${COL_WIDTH}px)`,
              columnGap: `${COL_GAP}px`,
            }}
          >
            {POSITIONS.map((pos) => (
              <BitCell
                key={`out-${pos}`}
                value={outputs[pos]}
                ariaLabel={`Output bit: ${outputs[pos]}`}
                tone="output"
              />
            ))}
          </div>

          {/* Controls row: Store, Reset, Enable. */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={store}
              aria-label="Store the inputs into the byte"
              className={`rounded-lg border px-6 py-2 text-sm font-semibold transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue focus-visible:ring-offset-2 motion-reduce:transition-none ${
                flash
                  ? 'border-apple-blue bg-apple-blue text-white shadow-md'
                  : 'border-apple-border bg-apple-surface text-apple-text hover:border-apple-blue/40'
              }`}
            >
              Store
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-apple-text-secondary">
                Enable
              </span>
              <InputSwitch
                value={enable}
                onChange={(v) => setEnable(v)}
                label="Enable"
              />
            </div>
            <button
              type="button"
              onClick={reset}
              className="rounded-full border border-apple-border bg-apple-surface px-4 py-1.5 text-xs font-medium text-apple-text-secondary transition-colors duration-200 hover:text-apple-text focus:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue focus-visible:ring-offset-2 motion-reduce:transition-none"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Readouts. Stored vs Output side by side so the gating is obvious. */}
      <div
        className="mt-8 grid grid-cols-1 gap-3 text-center sm:grid-cols-2"
        aria-live="polite"
      >
        <div className="rounded-xl border border-apple-border bg-apple-surface px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-apple-text-secondary">
            Stored byte
          </p>
          <p className="mt-1">
            <output
              aria-label="stored byte as binary"
              className="font-mono text-xl font-semibold tracking-widest text-apple-text"
            >
              {storedBinary}
            </output>
          </p>
          <p className="mt-0.5 text-sm text-apple-text-secondary">
            decimal{' '}
            <output
              aria-label="stored byte as number"
              className="font-medium text-apple-text"
            >
              {storedDecimal}
            </output>
          </p>
        </div>
        <div className="rounded-xl border border-apple-border bg-apple-surface px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-apple-text-secondary">
            Output (after enabler)
          </p>
          <p className="mt-1">
            <output
              aria-label="output as binary"
              className="font-mono text-xl font-semibold tracking-widest text-apple-text"
            >
              {outputBinary}
            </output>
          </p>
          <p className="mt-0.5 text-sm text-apple-text-secondary">
            decimal{' '}
            <output
              aria-label="output as number"
              className="font-medium text-apple-text"
            >
              {outputDecimal}
            </output>
          </p>
        </div>
      </div>
    </div>
  );
}

function BitCell({
  value,
  ariaLabel,
  flash = false,
  tone,
}: {
  value: Bit;
  ariaLabel: string;
  flash?: boolean;
  tone: 'stored' | 'output';
}) {
  const isOn = value === 1;
  // Stored cells use solid blue when on; output cells use the same blue but
  // a slightly different "off" tone so the two rows don't look identical at
  // a glance.
  const onClasses = 'border-apple-blue bg-apple-blue text-white';
  const offClasses =
    tone === 'stored'
      ? 'border-apple-border bg-apple-surface text-apple-text-secondary'
      : 'border-apple-border bg-apple-frame text-apple-text-secondary';
  return (
    <div
      role="status"
      aria-label={ariaLabel}
      className={`flex h-10 w-16 items-center justify-center rounded-lg border font-mono text-base font-semibold transition-all duration-300 motion-reduce:transition-none ${
        isOn ? onClasses : offClasses
      } ${flash ? 'ring-2 ring-apple-blue ring-offset-2' : ''}`}
    >
      {value}
    </div>
  );
}
