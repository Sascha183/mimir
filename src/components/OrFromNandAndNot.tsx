import { useEffect, useState } from 'react';
import type { Circuit, TruthTable } from '../lib/gates/types';
import CircuitEditor from './gates/CircuitEditor';

const INITIAL_CIRCUIT: Circuit = {
  gates: [],
  wires: [],
  inputs: [
    { id: 'A', label: 'A', value: 0 },
    { id: 'B', label: 'B', value: 0 },
  ],
  outputs: [{ id: 'Y', label: 'Y' }],
};

const TARGET_OR: TruthTable = {
  inputs: ['A', 'B'],
  outputs: ['Y'],
  rows: [
    { inputValues: [0, 0], outputValues: [0] },
    { inputValues: [0, 1], outputValues: [1] },
    { inputValues: [1, 0], outputValues: [1] },
    { inputValues: [1, 1], outputValues: [1] },
  ],
};

// Reference solution: NOT each input, feed both into a NAND. By De Morgan,
// NAND(NOT A, NOT B) == OR(A, B).
const SOLUTION_OR: Circuit = {
  gates: [
    { id: 'sol-not-a', kind: 'NOT', position: { x: 200, y: 130 } },
    { id: 'sol-not-b', kind: 'NOT', position: { x: 200, y: 230 } },
    { id: 'sol-nand', kind: 'NAND', position: { x: 360, y: 180 } },
  ],
  wires: [
    {
      id: 'sol-w1',
      from: { source: 'input', inputId: 'A' },
      to: { gateId: 'sol-not-a', port: 'in1' },
    },
    {
      id: 'sol-w2',
      from: { source: 'input', inputId: 'B' },
      to: { gateId: 'sol-not-b', port: 'in1' },
    },
    {
      id: 'sol-w3',
      from: { gateId: 'sol-not-a', port: 'out' },
      to: { gateId: 'sol-nand', port: 'in1' },
    },
    {
      id: 'sol-w4',
      from: { gateId: 'sol-not-b', port: 'out' },
      to: { gateId: 'sol-nand', port: 'in2' },
    },
    {
      id: 'sol-w5',
      from: { gateId: 'sol-nand', port: 'out' },
      to: { source: 'output', outputId: 'Y' },
    },
  ],
  inputs: [
    { id: 'A', label: 'A', value: 0 },
    { id: 'B', label: 'B', value: 0 },
  ],
  outputs: [{ id: 'Y', label: 'Y' }],
};

export default function OrFromNandAndNot() {
  const [solved, setSolved] = useState(false);
  const [hintShown, setHintShown] = useState(false);

  return (
    <div className="not-prose mx-auto my-12 w-full max-w-[900px] text-apple-text">
      <section className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-apple-text-secondary">
          Your task
        </p>
        <p className="mt-2 text-base leading-relaxed text-apple-text">
          Build a circuit that turns the two inputs into an OR gate. The output
          Y should be on whenever A or B (or both) is on. You have NAND and NOT
          available.
        </p>
      </section>

      <CircuitEditor
        initialCircuit={INITIAL_CIRCUIT}
        availableGates={['NAND', 'NOT']}
        targetTruthTable={TARGET_OR}
        solutionCircuit={SOLUTION_OR}
        onSolved={() => setSolved(true)}
        storageKey="hciw:or-from-nand-and-not"
      />

      <div className="mt-2">
        {hintShown ? (
          <p className="rounded-md border border-apple-border/60 bg-apple-surface/40 p-4 text-sm leading-relaxed text-apple-text-secondary">
            Think about the symmetry. A NAND is &ldquo;not (A and B)&rdquo;. So
            what would happen if you fed it &ldquo;not A&rdquo; and &ldquo;not
            B&rdquo; instead? Try a NOT on each input before the NAND.
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
            You built an OR gate.
          </h4>
          <p className="mt-2 max-w-prose leading-relaxed text-apple-text">
            The trick was symmetry. A NAND is &ldquo;not (A and B)&rdquo; — and
            an OR turns out to be &ldquo;not A NAND not B&rdquo;. The two
            operations are mirror images of each other. This deep relationship
            between AND and OR (with inversion sprinkled in) shows up
            everywhere in computing — from logic to programming to math.
            You&rsquo;ll see it again.
          </p>
        </div>
      </div>
    </div>
  );
}
