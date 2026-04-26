import { useEffect, useMemo, useState } from 'react';
import type { Bit, Circuit } from '../lib/gates/types';
import { simulateCircuit } from '../lib/gates/simulator';
import CircuitCanvas from './gates/CircuitCanvas';

/**
 * NotFromNand — the lesson-3 walk-through.
 *
 * Three states the learner moves through:
 *   1. "separate"   — two distinct switches drive the NAND's two inputs.
 *   2. "tied"       — collapse to one switch driving both NAND inputs (fan-out).
 *   3. (derived)    — once the learner has seen the bulb in both states while
 *                     in tied mode, reveal the success block: this is a NOT gate.
 *
 * State persists in localStorage. A Reset button returns to mode "separate"
 * and clears the seen-flags so the scene can be replayed.
 */

const STORAGE_KEY = 'hciw:not-from-nand:state';

type Mode = 'separate' | 'tied';

interface PersistedState {
  mode: Mode;
  separate: { a: Bit; b: Bit };
  tied: Bit;
  seenOnInTied: boolean;
  seenOffInTied: boolean;
}

const DEFAULT_STATE: PersistedState = {
  mode: 'separate',
  separate: { a: 0, b: 0 },
  tied: 0,
  seenOnInTied: false,
  seenOffInTied: false,
};

function loadState(): PersistedState {
  if (typeof window === 'undefined') return DEFAULT_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    const mode = parsed.mode === 'tied' ? 'tied' : 'separate';
    const a: Bit = parsed.separate?.a === 1 ? 1 : 0;
    const b: Bit = parsed.separate?.b === 1 ? 1 : 0;
    const tied: Bit = parsed.tied === 1 ? 1 : 0;
    return {
      mode,
      separate: { a, b },
      tied,
      seenOnInTied: !!parsed.seenOnInTied,
      seenOffInTied: !!parsed.seenOffInTied,
    };
  } catch {
    // fall through
  }
  return DEFAULT_STATE;
}

// Two precomputed circuits, swapped in/out by mode. Both use the same NAND
// position so the gate visually stays put across the transition.
const NAND_POSITION = { x: 270, y: 120 };
const CANVAS_WIDTH = 540;
const CANVAS_HEIGHT = 240;

const SEPARATE_CIRCUIT: Circuit = {
  gates: [{ id: 'nand1', kind: 'NAND', position: NAND_POSITION }],
  wires: [
    { id: 'wA', from: { source: 'input', inputId: 'A' }, to: { gateId: 'nand1', port: 'in1' } },
    { id: 'wB', from: { source: 'input', inputId: 'B' }, to: { gateId: 'nand1', port: 'in2' } },
    { id: 'wY', from: { gateId: 'nand1', port: 'out' }, to: { source: 'output', outputId: 'Y' } },
  ],
  inputs: [
    { id: 'A', label: 'A', value: 0 },
    { id: 'B', label: 'B', value: 0 },
  ],
  outputs: [{ id: 'Y', label: 'out' }],
};

const TIED_CIRCUIT: Circuit = {
  gates: [{ id: 'nand1', kind: 'NAND', position: NAND_POSITION }],
  wires: [
    // Fan-out: a single input drives both NAND inputs.
    { id: 'wX1', from: { source: 'input', inputId: 'X' }, to: { gateId: 'nand1', port: 'in1' } },
    { id: 'wX2', from: { source: 'input', inputId: 'X' }, to: { gateId: 'nand1', port: 'in2' } },
    { id: 'wY', from: { gateId: 'nand1', port: 'out' }, to: { source: 'output', outputId: 'Y' } },
  ],
  inputs: [{ id: 'X', label: 'in', value: 0 }],
  outputs: [{ id: 'Y', label: 'out' }],
};

export default function NotFromNand() {
  const [state, setState] = useState<PersistedState>(DEFAULT_STATE);
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
      // localStorage may be disabled — continue silently.
    }
  }, [hydrated, state]);

  const circuit = state.mode === 'separate' ? SEPARATE_CIRCUIT : TIED_CIRCUIT;
  const inputValues: Record<string, Bit> =
    state.mode === 'separate'
      ? { A: state.separate.a, B: state.separate.b }
      : { X: state.tied };

  const outputValues = useMemo(
    () => simulateCircuit(circuit, inputValues),
    [circuit, inputValues],
  );

  // Track what the learner has observed in tied mode. The bulb starts on (NAND
  // of two zeros is 1), so the moment we enter tied mode seenOnInTied flips true.
  // Flipping the input once produces seenOffInTied. The reveal fires when both
  // are true.
  useEffect(() => {
    if (state.mode !== 'tied') return;
    const bulb = outputValues.Y ?? 0;
    if (bulb === 1 && !state.seenOnInTied) {
      setState((prev) => ({ ...prev, seenOnInTied: true }));
    } else if (bulb === 0 && !state.seenOffInTied) {
      setState((prev) => ({ ...prev, seenOffInTied: true }));
    }
  }, [state.mode, outputValues.Y, state.seenOnInTied, state.seenOffInTied]);

  const onInputChange = (id: string, v: Bit) => {
    setState((prev) => {
      if (prev.mode === 'separate') {
        if (id === 'A') return { ...prev, separate: { ...prev.separate, a: v } };
        if (id === 'B') return { ...prev, separate: { ...prev.separate, b: v } };
        return prev;
      }
      if (id === 'X') return { ...prev, tied: v };
      return prev;
    });
  };

  const tieInputs = () => {
    setState((prev) => ({
      ...prev,
      mode: 'tied',
      tied: 0,
      seenOnInTied: false,
      seenOffInTied: false,
    }));
  };

  const reset = () => {
    setState(DEFAULT_STATE);
  };

  const showSuccess =
    state.mode === 'tied' && state.seenOnInTied && state.seenOffInTied;

  const instruction =
    state.mode === 'separate'
      ? 'Toggle the switches. This is the NAND gate from the last lesson.'
      : 'Now there’s only one input. The two NAND inputs always get the same value.';

  return (
    <div className="not-prose mx-auto my-12 w-full max-w-[600px] text-apple-text">
      <CircuitCanvas
        circuit={circuit}
        inputValues={inputValues}
        outputValues={outputValues}
        onInputChange={onInputChange}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
      />

      <p className="mt-4 text-center text-sm italic text-apple-text-secondary">
        {instruction}
      </p>

      <div className="mt-6 flex justify-center">
        {state.mode === 'separate' ? (
          <button
            type="button"
            onClick={tieInputs}
            className="inline-flex items-center gap-2 rounded-full bg-apple-blue px-5 py-2.5 text-sm font-medium text-white transition-colors duration-200 hover:bg-[#0064c8] focus:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue focus-visible:ring-offset-2 motion-reduce:transition-none"
          >
            Tie the inputs together
            <span aria-hidden="true">→</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-full border border-apple-border bg-white px-5 py-2.5 text-sm font-medium text-apple-text transition-colors duration-200 hover:bg-apple-bg/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue focus-visible:ring-offset-2 motion-reduce:transition-none"
          >
            Reset
          </button>
        )}
      </div>

      {showSuccess && <SuccessBlock />}
    </div>
  );
}

function SuccessBlock() {
  // Mount at opacity 0, flip to 1 on the next frame so the CSS transition has
  // a starting point. motion-reduce zeroes the duration.
  const [opacity, setOpacity] = useState(0);
  useEffect(() => {
    const id = window.requestAnimationFrame(() => setOpacity(1));
    return () => window.cancelAnimationFrame(id);
  }, []);

  return (
    <div
      className="mt-8 rounded-xl bg-green-50/60 p-6 transition-opacity duration-500 motion-reduce:duration-0"
      style={{ opacity }}
    >
      <div className="flex items-start gap-4">
        <svg
          className="mt-1 h-6 w-6 flex-shrink-0"
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
        <div>
          <h4 className="text-xl font-semibold text-apple-text">
            You just built a NOT gate.
          </h4>
          <p className="mt-2 max-w-prose leading-relaxed text-apple-text">
            When the input is on, the output is off. When the input is off, the output is
            on. The output is always the opposite — the NOT — of the input. You haven&rsquo;t
            added any new kind of part. You took the NAND gate from the last lesson, tied
            its two inputs together, and out came an entirely different gate. This is how
            every other gate in a computer is built: by wiring NAND gates in clever ways.
          </p>
        </div>
      </div>
    </div>
  );
}
