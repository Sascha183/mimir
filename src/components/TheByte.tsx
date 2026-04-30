import { useEffect, useRef, useState } from 'react';
import type { Bit } from '../lib/gates/types';
import InputSwitch from './gates/InputSwitch';

/**
 * TheByte — lesson-9 scene.
 *
 * Eight memory bits in a row, sharing a single "set" wire. The learner toggles
 * eight input switches independently, then a single Store click captures all
 * eight inputs into the stored byte at the same instant — the pedagogical point
 * being that the shared 's' wire is what makes a byte atomic.
 *
 * The widget is purely state-machine — no gate-level simulator. Two parallel
 * eight-bit arrays:
 *   - `inputs`  — what the toggles currently say.
 *   - `stored`  — what got captured the last time Store was pressed.
 * Decimal and binary readouts reflect `stored`, never `inputs`. Until the
 * learner presses Store, changing the toggles does not change the byte; this
 * separation is the whole point of the lesson.
 */

const STORAGE_KEY = 'hciw:the-byte:state';
const FLASH_MS = 380;
const ZERO_BYTE: Bit[] = [0, 0, 0, 0, 0, 0, 0, 0];

interface PersistedState {
  inputs: Bit[];
  stored: Bit[];
}

function defaultState(): PersistedState {
  return { inputs: [...ZERO_BYTE], stored: [...ZERO_BYTE] };
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

// Render the byte MSB-first, grouped in two nibbles ("0010 1101").
function bitsAsBinary(bits: Bit[]): string {
  const msbFirst = [...bits].reverse().join('');
  return `${msbFirst.slice(0, 4)} ${msbFirst.slice(4)}`;
}

// Layout constants — kept fixed so the SVG wire aligns precisely with the
// flex/grid columns above and below it. Switches and cells are 64 px wide
// (Tailwind w-16); the gap is 12 px (gap-3); 8 columns total.
const COL_WIDTH = 64;
const COL_GAP = 12;
const COL_COUNT = 8;
const ROW_WIDTH = COL_COUNT * COL_WIDTH + (COL_COUNT - 1) * COL_GAP; // 596
const COL_CENTER = (i: number) => COL_WIDTH / 2 + i * (COL_WIDTH + COL_GAP);

const POSITIONS = [7, 6, 5, 4, 3, 2, 1, 0] as const; // MSB → LSB, left → right

export default function TheByte() {
  // Combined state so `store()` can read the freshest `inputs` via a
  // functional update — avoids stale-closure bugs when something fires
  // multiple state-changing events without an intervening render.
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
      // localStorage may be disabled (private mode, etc.) — keep going.
    }
  }, [hydrated, state]);

  const { inputs, stored } = state;

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

  function reset() {
    if (flashTimer.current !== null) {
      window.clearTimeout(flashTimer.current);
      flashTimer.current = null;
    }
    setFlash(false);
    setState(defaultState());
  }

  const decimalValue = bitsToNumber(stored);
  const binaryString = bitsAsBinary(stored);

  return (
    <div className="not-prose mx-auto my-12 w-full max-w-[680px] text-apple-text">
      <div className="overflow-x-auto pb-1">
        <div className="mx-auto" style={{ width: ROW_WIDTH }}>
          <div className="text-center text-xs font-semibold uppercase tracking-widest text-apple-text-secondary">
            Inputs
          </div>

          {/* Input switches, MSB on the left. */}
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

          {/* Stub from each input switch down into the cell below. */}
          <svg
            viewBox={`0 0 ${ROW_WIDTH} 20`}
            width={ROW_WIDTH}
            height={20}
            className="mt-3 block"
            aria-hidden="true"
          >
            {POSITIONS.map((pos, idx) => {
              const cx = COL_CENTER(idx);
              const active = inputs[pos] === 1;
              return (
                <line
                  key={`data-${pos}`}
                  x1={cx}
                  y1={0}
                  x2={cx}
                  y2={20}
                  stroke={active ? 'rgb(var(--apple-blue))' : 'rgb(var(--apple-text-secondary))'}
                  strokeWidth={2}
                  className="transition-colors duration-200 motion-reduce:transition-none"
                />
              );
            })}
          </svg>

          {/* Stored cells. */}
          <div
            className="grid place-items-center"
            style={{
              gridTemplateColumns: `repeat(${COL_COUNT}, ${COL_WIDTH}px)`,
              columnGap: `${COL_GAP}px`,
            }}
          >
            {POSITIONS.map((pos) => (
              <StoredBitCell
                key={`stored-${pos}`}
                value={stored[pos]}
                flash={flash}
              />
            ))}
          </div>

          {/* Shared 'set' wire: stubs from each cell down to a horizontal line.
              The wire flashes blue on Store to make the "atomic" capture
              visceral — all eight stubs and the line light up at once. */}
          <svg
            viewBox={`0 0 ${ROW_WIDTH} 56`}
            width={ROW_WIDTH}
            height={56}
            className="block"
            aria-hidden="true"
          >
            {POSITIONS.map((pos, idx) => {
              const cx = COL_CENTER(idx);
              return (
                <line
                  key={`set-stub-${pos}`}
                  x1={cx}
                  y1={0}
                  x2={cx}
                  y2={36}
                  stroke={flash ? 'rgb(var(--apple-blue))' : 'rgb(var(--apple-text-secondary))'}
                  strokeWidth={2}
                  className="transition-colors duration-200 motion-reduce:transition-none"
                />
              );
            })}
            <line
              x1={COL_CENTER(0)}
              y1={36}
              x2={COL_CENTER(COL_COUNT - 1)}
              y2={36}
              stroke={flash ? 'rgb(var(--apple-blue))' : 'rgb(var(--apple-text-secondary))'}
              strokeWidth={2}
              className="transition-colors duration-200 motion-reduce:transition-none"
            />
            <text
              x={COL_CENTER(COL_COUNT - 1) + 12}
              y={40}
              fontSize={12}
              style={{ fill: "rgb(var(--apple-text-secondary))" }}
              stroke="none"
            >
              s
            </text>
          </svg>

          {/* Store button. */}
          <div className="mt-4 flex items-center justify-center gap-4">
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
            <button
              type="button"
              onClick={reset}
              className="rounded-full border border-apple-border bg-apple-surface px-4 py-1.5 text-xs font-medium text-apple-text-secondary transition-colors duration-200 hover:text-apple-text focus:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue focus-visible:ring-offset-2 motion-reduce:transition-none"
            >
              Reset to 0
            </button>
          </div>
        </div>
      </div>

      {/* Live readouts of the stored byte. */}
      <div className="mt-8 space-y-1 text-center" aria-live="polite">
        <p className="text-base">
          <span className="text-apple-text-secondary">As bits:</span>{' '}
          <output
            aria-label="byte as binary"
            className="font-mono text-2xl font-semibold tracking-widest text-apple-text"
          >
            {binaryString}
          </output>
        </p>
        <p className="text-lg">
          <span className="text-apple-text-secondary">As a number:</span>{' '}
          <output
            aria-label="byte as number"
            className="font-medium text-apple-text"
          >
            {decimalValue}
          </output>
        </p>
        <p className="text-xs text-apple-text-secondary">
          One of 256 possible bytes
        </p>
      </div>
    </div>
  );
}

function StoredBitCell({ value, flash }: { value: Bit; flash: boolean }) {
  const isOn = value === 1;
  return (
    <div
      role="status"
      aria-label={`Stored bit: ${value}`}
      className={`flex h-12 w-16 items-center justify-center rounded-lg border font-mono text-lg font-semibold transition-all duration-300 motion-reduce:transition-none ${
        isOn
          ? 'border-apple-blue bg-apple-blue text-white'
          : 'border-apple-border bg-apple-surface text-apple-text-secondary'
      } ${flash ? 'ring-2 ring-apple-blue ring-offset-2' : ''}`}
    >
      {value}
    </div>
  );
}
