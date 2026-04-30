import { useEffect, useState } from 'react';
import type { Bit } from '../lib/gates/types';
import InputSwitch from './gates/InputSwitch';

/**
 * BitEncoder — intuition-builder for what bits can represent.
 *
 * Three sections, top to bottom:
 *   1. A row of bit toggles (1 to 8 bits) with +/− buttons.
 *      Bits are stored LSB-first (bits[0] is bit 0). The row is rendered
 *      MSB-first so the leftmost toggle is the highest-order bit.
 *   2. A live readout: bits string (MSB-first), decimal value,
 *      "one of N possible combinations".
 *   3. A grid of 2^N squares with the current value highlighted, plus a
 *      calibration line that ties the bit count to a real-world quantity.
 */

const STORAGE_KEY = 'hciw:bit-encoder';
const MIN_BITS = 1;
const MAX_BITS = 8;
const DEFAULT_BITS: Bit[] = [0, 0, 0];

// Indexed by (N - 1).
const CALIBRATIONS: string[] = [
  'With 1 bit, you can represent 2 things — like on/off, true/false, yes/no.',
  'With 2 bits, you can represent 4 things — like the four seasons, or the four suits in a deck of cards.',
  'With 3 bits, you can represent 8 things — like the eight musical notes in an octave.',
  'With 4 bits, you can represent 16 things — like every hex digit, 0 through F.',
  'With 5 bits, you can represent 32 things — more than enough for the alphabet.',
  'With 6 bits, 64 — every square on a chessboard.',
  'With 7 bits, 128 — the original ASCII character set.',
  'With 8 bits, 256 — every shade of gray in a black-and-white photo. This is one byte.',
];

function loadState(): Bit[] {
  if (typeof window === 'undefined') return DEFAULT_BITS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_BITS;
    const parsed = JSON.parse(raw);
    if (
      Array.isArray(parsed) &&
      parsed.length >= MIN_BITS &&
      parsed.length <= MAX_BITS &&
      parsed.every((b) => b === 0 || b === 1)
    ) {
      return parsed as Bit[];
    }
  } catch {
    // fall through
  }
  return DEFAULT_BITS;
}

function bitsToNumber(bits: Bit[]): number {
  let n = 0;
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] === 1) n += 1 << i;
  }
  return n;
}

function bitsString(bits: Bit[]): string {
  return [...bits].reverse().join(' ');
}

/**
 * Choose a column count for the possibility grid based on bit count.
 * Goal: keep the grid roughly rectangular and visually balanced.
 *   1 bit →  2 cols × 1 row
 *   2 bits → 4 × 1
 *   3 bits → 8 × 1
 *   4 bits → 8 × 2
 *   5 bits → 8 × 4
 *   6 bits → 16 × 4
 *   7 bits → 16 × 8
 *   8 bits → 32 × 8
 */
function gridCols(n: number): number {
  const total = 1 << n;
  if (total <= 8) return total;
  if (total <= 32) return 8;
  if (total <= 128) return 16;
  return 32;
}

export default function BitEncoder() {
  const [bits, setBits] = useState<Bit[]>(DEFAULT_BITS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setBits(loadState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bits));
    } catch {
      // localStorage may be disabled — continue silently.
    }
  }, [hydrated, bits]);

  function setBit(i: number, v: Bit) {
    setBits((prev) => prev.map((b, j) => (j === i ? v : b)));
  }

  function addBit() {
    setBits((prev) => (prev.length >= MAX_BITS ? prev : [...prev, 0]));
  }

  function removeBit() {
    setBits((prev) => (prev.length <= MIN_BITS ? prev : prev.slice(0, -1)));
  }

  const numberValue = bitsToNumber(bits);
  const total = 1 << bits.length;
  const cols = gridCols(bits.length);
  // Cap grid width at 28px-per-cell so low-N grids stay small/intimate.
  const gridMaxWidth = Math.min(640, cols * 28 - 4);

  return (
    <div className="not-prose mx-auto my-12 w-full max-w-[640px] text-apple-text">
      {/* Toggle row, MSB on the left */}
      <div className="flex items-end justify-center gap-3">
        {[...bits]
          .map((value, i) => ({ value, idx: i }))
          .reverse()
          .map(({ value, idx }) => (
            <BitToggle
              key={`bit-${idx}`}
              bitIdx={idx}
              value={value}
              onSet={(v) => setBit(idx, v)}
            />
          ))}
      </div>

      {/* Add / Remove */}
      <div className="mt-5 flex justify-center gap-3">
        <button
          type="button"
          onClick={removeBit}
          disabled={bits.length <= MIN_BITS}
          aria-label="Remove a bit"
          className="rounded-full border border-apple-border bg-apple-surface px-3 py-1.5 text-xs font-medium text-apple-text-secondary transition-colors duration-200 hover:text-apple-text disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue focus-visible:ring-offset-2 motion-reduce:transition-none"
        >
          − Remove a bit
        </button>
        <button
          type="button"
          onClick={addBit}
          disabled={bits.length >= MAX_BITS}
          aria-label="Add a bit"
          className="rounded-full border border-apple-border bg-apple-surface px-3 py-1.5 text-xs font-medium text-apple-text-secondary transition-colors duration-200 hover:text-apple-text disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue focus-visible:ring-offset-2 motion-reduce:transition-none"
        >
          + Add a bit
        </button>
      </div>

      {/* Live readout */}
      <div className="mt-10 space-y-2 text-center">
        <p className="text-base">
          <span className="text-apple-text-secondary">As bits:</span>{' '}
          <output
            aria-label="bits as binary"
            className="font-mono text-2xl font-semibold tracking-widest text-apple-text"
          >
            {bitsString(bits)}
          </output>
        </p>
        <p className="text-lg">
          <span className="text-apple-text-secondary">As a number:</span>{' '}
          <output
            aria-label="bits as number"
            className="font-medium text-apple-text"
          >
            {numberValue}
          </output>
        </p>
        <p className="text-sm text-apple-text-secondary">
          One of {total.toLocaleString('en-US')} possible combinations
        </p>
      </div>

      {/* Possibility grid */}
      <div className="mt-10">
        <div
          className="mx-auto"
          style={{ maxWidth: `${gridMaxWidth}px` }}
        >
          <div
            role="presentation"
            aria-label={`possibility grid with ${total} cells`}
            className="grid gap-1"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: total }, (_, i) => (
              <div
                key={i}
                className={`aspect-square rounded-sm transition-colors duration-200 motion-reduce:transition-none ${
                  i === numberValue ? 'bg-apple-blue' : 'bg-apple-border/40'
                }`}
              />
            ))}
          </div>
        </div>
        <p className="mt-3 text-center text-xs text-apple-text-secondary">
          Each square is one possible combination of {bits.length} bit
          {bits.length === 1 ? '' : 's'}.
        </p>
      </div>

      {/* Calibration */}
      <p className="mx-auto mt-8 max-w-prose text-center text-sm leading-relaxed text-apple-text">
        {CALIBRATIONS[bits.length - 1]}
      </p>
    </div>
  );
}

function BitToggle({
  bitIdx,
  value,
  onSet,
}: {
  bitIdx: number;
  value: Bit;
  onSet: (v: Bit) => void;
}) {
  // Mount with opacity 0 + a slight leftward offset, then transition in on
  // the next frame. New toggles (added via the +) get a gentle slide-in;
  // existing toggles preserve their identity via stable React keys and don't
  // re-trigger this effect when other bits change.
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = window.requestAnimationFrame(() => setShown(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  return (
    <div
      className="flex flex-col items-center gap-1.5 transition-all duration-200 motion-reduce:duration-0"
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? 'translateX(0)' : 'translateX(-8px)',
      }}
    >
      <span
        className={`font-mono text-base font-semibold ${
          value === 1 ? 'text-apple-text' : 'text-apple-text-secondary'
        }`}
      >
        {value}
      </span>
      <InputSwitch
        value={value}
        onChange={onSet}
        label={`Bit ${bitIdx}`}
      />
    </div>
  );
}
