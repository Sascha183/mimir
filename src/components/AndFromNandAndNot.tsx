import { useEffect, useState } from 'react';
import type { Circuit, TruthTable } from '../lib/gates/types';
import CircuitEditor from './gates/CircuitEditor';

/**
 * AndFromNandAndNot — lesson-4 scene.
 *
 * Thin wrapper around CircuitEditor:
 *   - Empty starting canvas: just inputs A, B and output Y.
 *   - Palette restricted to NAND + NOT (so the learner can't cheat by
 *     dragging an AND directly).
 *   - Target truth table is AND.
 *   - When the editor's truth table matches AND, a success block fades in.
 *
 * Local UI state (hint, solved) is intentionally not persisted — refreshing
 * the page resets it. The editor's circuit state IS persisted via its own
 * storage key.
 */

const INITIAL_CIRCUIT: Circuit = {
  gates: [],
  wires: [],
  inputs: [
    { id: 'A', label: 'A', value: 0 },
    { id: 'B', label: 'B', value: 0 },
  ],
  outputs: [{ id: 'Y', label: 'Y' }],
};

const TARGET_AND: TruthTable = {
  inputs: ['A', 'B'],
  outputs: ['Y'],
  rows: [
    { inputValues: [0, 0], outputValues: [0] },
    { inputValues: [0, 1], outputValues: [0] },
    { inputValues: [1, 0], outputValues: [0] },
    { inputValues: [1, 1], outputValues: [1] },
  ],
};

export default function AndFromNandAndNot() {
  const [solved, setSolved] = useState(false);
  const [hintShown, setHintShown] = useState(false);

  return (
    <div className="not-prose mx-auto my-12 w-full max-w-[900px] text-apple-text">
      <section className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-apple-text-secondary">
          Your task
        </p>
        <p className="mt-2 text-base leading-relaxed text-apple-text">
          Build a circuit that turns the two inputs into an AND gate. The output
          Y should be on only when both A and B are on. You have NAND and NOT
          available.
        </p>
      </section>

      {/*
        Wrapper allows the editor to overflow horizontally when its natural
        ~900px width is wider than the article column (lesson pages reserve
        space for the side nav and outline rail). On wide screens the editor
        fits in the parent and no scrolling is needed.
      */}
      <div className="overflow-x-auto pb-1">
        <CircuitEditor
          initialCircuit={INITIAL_CIRCUIT}
          availableGates={['NAND', 'NOT']}
          targetTruthTable={TARGET_AND}
          onSolved={() => setSolved(true)}
          storageKey="hciw:and-from-nand-and-not"
        />
      </div>

      <div className="mt-2">
        {hintShown ? (
          <p className="rounded-md border border-apple-border/60 bg-white/40 p-4 text-sm leading-relaxed text-apple-text-secondary">
            Think back to the last lesson. A NAND already gives you &ldquo;not
            AND&rdquo;. So if you flip a NAND&rsquo;s output one more time
            &hellip;
          </p>
        ) : (
          <button
            type="button"
            onClick={() => setHintShown(true)}
            className="text-sm text-apple-blue transition-colors duration-200 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue focus-visible:ring-offset-2 motion-reduce:transition-none"
          >
            Stuck? Show a hint
          </button>
        )}
      </div>

      {solved && <SuccessBlock />}
    </div>
  );
}

function SuccessBlock() {
  // Mount at opacity 0, flip to 1 on the next frame so the CSS transition has
  // a starting point to animate from. motion-reduce zeroes the duration.
  const [opacity, setOpacity] = useState(0);
  useEffect(() => {
    const id = window.requestAnimationFrame(() => setOpacity(1));
    return () => window.cancelAnimationFrame(id);
  }, []);

  return (
    <div
      className="mt-8 rounded-xl bg-green-50/60 p-6 transition-opacity duration-500 motion-reduce:duration-0"
      style={{ opacity }}
      role="status"
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
            You built an AND gate.
          </h4>
          <p className="mt-2 max-w-prose leading-relaxed text-apple-text">
            The trick was simple: a NAND gate is literally &ldquo;not
            AND&rdquo; — that&rsquo;s what the N stands for. So if you flip a
            NAND&rsquo;s output one more time with a NOT, you get the original
            AND back. You&rsquo;ve now built two new gates (NOT and AND) using
            only NANDs and the NOT you made yourself in the last lesson.
          </p>
        </div>
      </div>
    </div>
  );
}
