import { useEffect, useState } from 'react';
import type { Bit } from '../lib/gates/types';
import InputSwitch from './gates/InputSwitch';

/**
 * RandomAccessMemory — lesson-13 scene.
 *
 * 256 bytes of memory laid out as a 16×16 grid. Two parallel inputs:
 *   - MAR (Memory Address Register): 8 toggles → integer 0..255 → selects one
 *     cell in the grid. Clicking a grid cell also writes that cell's index
 *     into the MAR, so the address can be reached by either route.
 *   - Data lines: a separate 8-toggle pattern that gets captured into the
 *     selected cell when Write is pressed.
 *
 * Internally each byte is stored as a single number 0..255 — vastly less
 * bookkeeping than 256 × Bit[8], and the byte representations are derived on
 * the fly. Persistence: the whole 256-element array goes to localStorage as
 * a number array (~1 KB JSON, well within budget).
 *
 * Pedagogically the widget compresses the 16×16 grid to ~22-px cells: every
 * cell is on screen, but no cell tries to display its 8 bits. Cells with
 * non-zero data get a faint blue tint so the learner can see at a glance
 * which addresses they have populated. The selected cell gets a thicker
 * blue ring regardless.
 */

const STORAGE_KEY = 'hciw:ram:state';
const ZERO_BYTE: Bit[] = [0, 0, 0, 0, 0, 0, 0, 0];
const TOTAL = 256;
const GRID_SIDE = 16;

interface PersistedState {
  cells: number[]; // length 256, each 0..255
  mar: Bit[];      // length 8, LSB-first
  data: Bit[];     // length 8, LSB-first
}

function defaultState(): PersistedState {
  return {
    cells: Array(TOTAL).fill(0),
    mar: [...ZERO_BYTE],
    data: [...ZERO_BYTE],
  };
}

function validateByte(arr: unknown): Bit[] | null {
  if (!Array.isArray(arr) || arr.length !== 8) return null;
  if (!arr.every((b) => b === 0 || b === 1)) return null;
  return arr as Bit[];
}

function validateCells(arr: unknown): number[] | null {
  if (!Array.isArray(arr) || arr.length !== TOTAL) return null;
  if (!arr.every((n) => typeof n === 'number' && n >= 0 && n <= 255 && Number.isInteger(n))) {
    return null;
  }
  return arr as number[];
}

function loadState(): PersistedState {
  if (typeof window === 'undefined') return defaultState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      cells: validateCells(parsed.cells) ?? Array(TOTAL).fill(0),
      mar: validateByte(parsed.mar) ?? [...ZERO_BYTE],
      data: validateByte(parsed.data) ?? [...ZERO_BYTE],
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

function numberToBits(n: number): Bit[] {
  const bits: Bit[] = [];
  for (let i = 0; i < 8; i++) bits.push(((n >> i) & 1) as Bit);
  return bits;
}

function bitsAsBinary(bits: Bit[]): string {
  const msbFirst = [...bits].reverse().join('');
  return `${msbFirst.slice(0, 4)} ${msbFirst.slice(4)}`;
}

const POSITIONS = [7, 6, 5, 4, 3, 2, 1, 0] as const;

export default function RandomAccessMemory() {
  const [state, setState] = useState<PersistedState>(defaultState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(loadState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // localStorage may be disabled — keep going.
    }
  }, [hydrated, state]);

  const address = bitsToNumber(state.mar);
  const selectedValue = state.cells[address] ?? 0;
  const selectedBits = numberToBits(selectedValue);
  const dataValue = bitsToNumber(state.data);
  const populatedCount = state.cells.filter((v) => v !== 0).length;

  function setMarBit(i: number, v: Bit) {
    setState((prev) => ({
      ...prev,
      mar: prev.mar.map((b, j) => (j === i ? v : b)),
    }));
  }

  function setDataBit(i: number, v: Bit) {
    setState((prev) => ({
      ...prev,
      data: prev.data.map((b, j) => (j === i ? v : b)),
    }));
  }

  function selectCell(idx: number) {
    setState((prev) => ({ ...prev, mar: numberToBits(idx) }));
  }

  function write() {
    setState((prev) => {
      const addr = bitsToNumber(prev.mar);
      const value = bitsToNumber(prev.data);
      if (prev.cells[addr] === value) return prev;
      const cells = prev.cells.slice();
      cells[addr] = value;
      return { ...prev, cells };
    });
  }

  function clearCell() {
    setState((prev) => {
      const addr = bitsToNumber(prev.mar);
      if (prev.cells[addr] === 0) return prev;
      const cells = prev.cells.slice();
      cells[addr] = 0;
      return { ...prev, cells };
    });
  }

  function clearAll() {
    setState((prev) => ({ ...prev, cells: Array(TOTAL).fill(0) }));
  }

  function reset() {
    setState(defaultState());
  }

  return (
    <div className="not-prose mx-auto my-12 w-full max-w-[680px] text-apple-text">
      {/* MAR */}
      <div className="text-center text-xs font-semibold uppercase tracking-widest text-apple-text-secondary">
        Memory Address Register (MAR)
      </div>
      {/*
        MAR row: 8 toggle switches in a horizontal line so the binary address
        reads left-to-right. On viewports too narrow for ~600px of toggles
        the row scrolls horizontally rather than wrapping (wrapping would
        break the bit-position mental model).
      */}
      <div className="-mx-4 mt-2 overflow-x-auto px-4">
        <div
          className="mx-auto grid place-items-center"
          style={{ gridTemplateColumns: 'repeat(8, 64px)', columnGap: '12px', width: 'max-content' }}
        >
          {POSITIONS.map((pos) => (
            <div key={`mar-${pos}`} className="flex flex-col items-center gap-1.5">
              <span className="font-mono text-[11px] text-apple-text-secondary">
                bit {pos}
              </span>
              <InputSwitch
                value={state.mar[pos]}
                onChange={(v) => setMarBit(pos, v)}
                label={`MAR bit ${pos}`}
              />
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 text-center text-sm text-apple-text-secondary" aria-live="polite">
        Address{' '}
        <output
          aria-label="address as binary"
          className="font-mono text-base font-semibold tracking-widest text-apple-text"
        >
          {bitsAsBinary(state.mar)}
        </output>{' '}
        — decimal{' '}
        <output aria-label="address as number" className="font-medium text-apple-text">
          {address}
        </output>
      </p>

      {/*
        The 16x16 grid. At ~382px wide it fits on most phones; on the
        narrowest viewports (≲ 360px) the grid overflows its parent and the
        outer overflow-x-auto wrapper scrolls.
      */}
      <div
        role="grid"
        aria-label="256-byte memory grid"
        className="mx-auto mt-6 inline-grid"
        style={{
          gridTemplateColumns: `repeat(${GRID_SIDE}, 22px)`,
          gridTemplateRows: `repeat(${GRID_SIDE}, 22px)`,
          gap: '2px',
        }}
      >
        {state.cells.map((value, idx) => {
          const isSelected = idx === address;
          const hasData = value !== 0;
          return (
            <button
              key={idx}
              type="button"
              role="gridcell"
              aria-selected={isSelected}
              aria-label={`Address ${idx}, value ${value}${isSelected ? ', selected' : ''}`}
              onClick={() => selectCell(idx)}
              className={`flex h-[22px] w-[22px] items-center justify-center rounded-sm transition-all duration-150 motion-reduce:transition-none focus:outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-apple-blue ${
                isSelected
                  ? 'bg-apple-blue ring-2 ring-apple-blue ring-offset-1'
                  : hasData
                    ? 'bg-apple-blue/30 hover:bg-apple-blue/50'
                    : 'bg-apple-border/30 hover:bg-apple-border/60'
              }`}
            />
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-center gap-4 text-xs text-apple-text-secondary">
        <span>
          16 × 16 grid · {populatedCount} of {TOTAL} cells populated
        </span>
        <button
          type="button"
          onClick={clearAll}
          className="rounded-full border border-apple-border bg-apple-surface px-3 py-1 text-xs font-medium text-apple-text-secondary transition-colors duration-200 hover:text-apple-text focus:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue focus-visible:ring-offset-2 motion-reduce:transition-none"
        >
          Clear all
        </button>
      </div>

      {/* Selected cell readout */}
      <div className="mx-auto mt-6 inline-block rounded-xl border border-apple-border bg-apple-surface px-5 py-3 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-apple-text-secondary">
          Cell at address {address}
        </p>
        <p className="mt-1">
          <output
            aria-label="selected cell as binary"
            className="font-mono text-xl font-semibold tracking-widest text-apple-text"
          >
            {bitsAsBinary(selectedBits)}
          </output>
        </p>
        <p className="mt-0.5 text-sm text-apple-text-secondary">
          decimal{' '}
          <output
            aria-label="selected cell as number"
            className="font-medium text-apple-text"
          >
            {selectedValue}
          </output>
        </p>
      </div>

      {/* Data input + write controls */}
      <div className="mt-8 text-center text-xs font-semibold uppercase tracking-widest text-apple-text-secondary">
        Data to write
      </div>
      <div className="mt-2 grid place-items-center" style={{ gridTemplateColumns: 'repeat(8, 64px)', columnGap: '12px' }}>
        {POSITIONS.map((pos) => (
          <div key={`data-${pos}`} className="flex flex-col items-center gap-1.5">
            <span className="font-mono text-[11px] text-apple-text-secondary">
              bit {pos}
            </span>
            <InputSwitch
              value={state.data[pos]}
              onChange={(v) => setDataBit(pos, v)}
              label={`Data bit ${pos}`}
            />
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-sm text-apple-text-secondary">
        Will write{' '}
        <span className="font-mono font-semibold text-apple-text">
          {bitsAsBinary(state.data)}
        </span>{' '}
        (decimal{' '}
        <span className="font-medium text-apple-text">{dataValue}</span>) into address {address}.
      </p>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={write}
          aria-label={`Write the data into address ${address}`}
          className="rounded-lg border border-apple-blue bg-apple-blue px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-apple-blue/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue focus-visible:ring-offset-2 motion-reduce:transition-none"
        >
          Write
        </button>
        <button
          type="button"
          onClick={clearCell}
          aria-label={`Clear address ${address}`}
          className="rounded-lg border border-apple-border bg-apple-surface px-4 py-2 text-sm font-medium text-apple-text transition-colors duration-200 hover:border-apple-blue/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue focus-visible:ring-offset-2 motion-reduce:transition-none"
        >
          Clear cell
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-full border border-apple-border bg-apple-surface px-4 py-1.5 text-xs font-medium text-apple-text-secondary transition-colors duration-200 hover:text-apple-text focus:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue focus-visible:ring-offset-2 motion-reduce:transition-none"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
