import { useEffect, useState } from 'react';
import type { Bit } from '../lib/gates/types';
import InputSwitch from './gates/InputSwitch';

/**
 * TheDecoder — lesson-12 scene.
 *
 * A 2-to-4 decoder. Two input switches (A, B) drive four output lines, of
 * which exactly one is on at any moment — the one whose AND gate is
 * watching for the current (A, B) combination. The active row's AND body
 * is highlighted blue; the others are dimmed.
 *
 * Why a 2-to-4 decoder rather than 4-to-16 or 8-to-256: the curriculum
 * roadmap calls for the principle, not the wiring. With only four rows
 * the per-input-combination annotation ("~A·~B", "~A·B", …) is readable;
 * scaling beyond that produces clutter without insight. The lesson prose
 * carries the "now imagine 256 of these" extrapolation.
 */

const STORAGE_KEY = 'hciw:the-decoder:state';

interface PersistedState {
  a: Bit;
  b: Bit;
}

function defaultState(): PersistedState {
  return { a: 0, b: 0 };
}

function loadState(): PersistedState {
  if (typeof window === 'undefined') return defaultState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      a: parsed.a === 1 ? 1 : 0,
      b: parsed.b === 1 ? 1 : 0,
    };
  } catch {
    return defaultState();
  }
}

// Each row corresponds to one of the 4 ANDs inside the decoder.
// `match.a` and `match.b` are the bits each AND is "watching for".
// Row index also IS the binary value of the inputs that activates it
// (matchA*2 + matchB).
const ROWS: { index: number; matchA: Bit; matchB: Bit; label: string }[] = [
  { index: 0, matchA: 0, matchB: 0, label: '¬A · ¬B' },
  { index: 1, matchA: 0, matchB: 1, label: '¬A · B' },
  { index: 2, matchA: 1, matchB: 0, label: 'A · ¬B' },
  { index: 3, matchA: 1, matchB: 1, label: 'A · B' },
];

export default function TheDecoder() {
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

  function setBit(which: 'a' | 'b', v: Bit) {
    setState((prev) => ({ ...prev, [which]: v }));
  }

  const { a, b } = state;
  const activeRow = a * 2 + b;

  return (
    <div className="not-prose mx-auto my-12 w-full max-w-[680px] text-apple-text">
      {/* Inputs */}
      <div className="flex justify-center gap-12">
        <div className="flex flex-col items-center gap-1.5">
          <span className="font-mono text-xs text-apple-text-secondary">A</span>
          <InputSwitch
            value={a}
            onChange={(v) => setBit('a', v)}
            label="Input A"
          />
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <span className="font-mono text-xs text-apple-text-secondary">B</span>
          <InputSwitch
            value={b}
            onChange={(v) => setBit('b', v)}
            label="Input B"
          />
        </div>
      </div>

      {/* Live address readout */}
      <p className="mt-4 text-center text-sm text-apple-text-secondary" aria-live="polite">
        Address{' '}
        <output
          aria-label="address as binary"
          className="font-mono text-base font-semibold tracking-widest text-apple-text"
        >
          {a}
          {b}
        </output>{' '}
        — decimal{' '}
        <output
          aria-label="address as number"
          className="font-medium text-apple-text"
        >
          {activeRow}
        </output>
      </p>

      {/* Decoder rows */}
      <div className="mt-6 space-y-2">
        {ROWS.map((row) => {
          const isActive = row.index === activeRow;
          return (
            <div
              key={row.index}
              role="status"
              aria-label={`Output ${row.index}: ${isActive ? 'on' : 'off'}`}
              className={`flex items-center gap-4 rounded-lg border px-4 py-3 transition-all duration-200 motion-reduce:transition-none ${
                isActive
                  ? 'border-apple-blue bg-apple-blue/10 shadow-sm'
                  : 'border-apple-border bg-apple-surface opacity-70'
              }`}
            >
              {/* Combination label (the AND watches for this exact pattern) */}
              <span
                className={`font-mono text-sm tracking-wider ${
                  isActive ? 'text-apple-blue' : 'text-apple-text-secondary'
                }`}
                style={{ minWidth: '70px' }}
              >
                {row.label}
              </span>

              {/* Tiny AND-shape pill, highlighted when active */}
              <div
                className={`flex h-8 w-12 items-center justify-center rounded-r-full border font-mono text-xs font-semibold transition-all duration-200 motion-reduce:transition-none ${
                  isActive
                    ? 'border-apple-blue bg-apple-blue text-white'
                    : 'border-apple-border bg-apple-surface text-apple-text-secondary'
                }`}
              >
                AND
              </div>

              <span
                aria-hidden="true"
                className={`font-mono text-xs ${
                  isActive ? 'text-apple-blue' : 'text-apple-text-secondary'
                }`}
              >
                →
              </span>

              {/* Output label */}
              <span
                className={`font-mono text-sm ${
                  isActive ? 'text-apple-text' : 'text-apple-text-secondary'
                }`}
              >
                output {row.index}
              </span>

              {/* Bulb */}
              <div
                aria-hidden="true"
                className={`ml-auto flex h-7 w-7 items-center justify-center rounded-full border-2 transition-all duration-200 motion-reduce:transition-none ${
                  isActive
                    ? 'border-amber-400 bg-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.55)]'
                    : 'border-apple-border bg-apple-surface'
                }`}
              />

              <span
                className={`font-mono text-sm font-semibold ${
                  isActive ? 'text-apple-text' : 'text-apple-text-secondary'
                }`}
                style={{ minWidth: '14px', textAlign: 'right' }}
              >
                {isActive ? 1 : 0}
              </span>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-center text-xs text-apple-text-secondary">
        Toggle A and B. Exactly one row lights up — the row whose AND is watching for the current input combination.
      </p>
    </div>
  );
}
