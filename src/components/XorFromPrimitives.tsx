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

const TARGET_XOR: TruthTable = {
  inputs: ['A', 'B'],
  outputs: ['Y'],
  rows: [
    { inputValues: [0, 0], outputValues: [0] },
    { inputValues: [0, 1], outputValues: [1] },
    { inputValues: [1, 0], outputValues: [1] },
    { inputValues: [1, 1], outputValues: [0] },
  ],
};

// Reference solution: (A OR B) AND NOT(A AND B). Five gates total.
const SOLUTION_XOR: Circuit = {
  gates: [
    { id: 'sol-or', kind: 'OR', position: { x: 220, y: 130 } },
    { id: 'sol-and1', kind: 'AND', position: { x: 220, y: 230 } },
    { id: 'sol-not', kind: 'NOT', position: { x: 320, y: 230 } },
    { id: 'sol-and2', kind: 'AND', position: { x: 420, y: 180 } },
  ],
  wires: [
    {
      id: 'sol-w1',
      from: { source: 'input', inputId: 'A' },
      to: { gateId: 'sol-or', port: 'in1' },
    },
    {
      id: 'sol-w2',
      from: { source: 'input', inputId: 'B' },
      to: { gateId: 'sol-or', port: 'in2' },
    },
    {
      id: 'sol-w3',
      from: { source: 'input', inputId: 'A' },
      to: { gateId: 'sol-and1', port: 'in1' },
    },
    {
      id: 'sol-w4',
      from: { source: 'input', inputId: 'B' },
      to: { gateId: 'sol-and1', port: 'in2' },
    },
    {
      id: 'sol-w5',
      from: { gateId: 'sol-and1', port: 'out' },
      to: { gateId: 'sol-not', port: 'in1' },
    },
    {
      id: 'sol-w6',
      from: { gateId: 'sol-or', port: 'out' },
      to: { gateId: 'sol-and2', port: 'in1' },
    },
    {
      id: 'sol-w7',
      from: { gateId: 'sol-not', port: 'out' },
      to: { gateId: 'sol-and2', port: 'in2' },
    },
    {
      id: 'sol-w8',
      from: { gateId: 'sol-and2', port: 'out' },
      to: { source: 'output', outputId: 'Y' },
    },
  ],
  inputs: [
    { id: 'A', label: 'A', value: 0 },
    { id: 'B', label: 'B', value: 0 },
  ],
  outputs: [{ id: 'Y', label: 'Y' }],
};

export default function XorFromPrimitives() {
  const [solved, setSolved] = useState(false);
  const [hintShown, setHintShown] = useState(false);

  return (
    <div className="not-prose mx-auto my-12 w-full max-w-[900px] text-apple-text">
      <section className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-apple-text-secondary">
          Your task
        </p>
        <p className="mt-2 text-base leading-relaxed text-apple-text">
          Build a circuit where Y is on only when <em>exactly one</em> of A or
          B is on — off when both are off, off when both are on. You have AND,
          OR, and NOT in the palette. (No NAND this time. From here on, you
          compose with the gates you have already built.)
        </p>
      </section>

      <CircuitEditor
        initialCircuit={INITIAL_CIRCUIT}
        availableGates={['AND', 'OR', 'NOT']}
        targetTruthTable={TARGET_XOR}
        solutionCircuit={SOLUTION_XOR}
        onSolved={() => setSolved(true)}
        storageKey="hciw:xor-from-primitives"
      />

      <div className="mt-2">
        {hintShown ? (
          <p className="rounded-md border border-apple-border/60 bg-apple-surface/40 p-4 text-sm leading-relaxed text-apple-text-secondary">
            Think of two conditions that both need to be true:
            (1)&nbsp;&ldquo;at least one input is on&rdquo;, and
            (2)&nbsp;&ldquo;they are not both on&rdquo;. Each condition is a
            gate you already have. Then combine the two with one more gate.
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
            You built an XOR gate.
          </h4>
          <p className="mt-2 max-w-prose leading-relaxed text-apple-text">
            XOR — exclusive OR. True when exactly one input is true. False when
            both are off, false when both are on. This is the gate that powers
            binary addition, equality checking, and one-time-pad encryption.
          </p>
          <p className="mt-3 max-w-prose leading-relaxed text-apple-text">
            It also marks a turning point. Up to now, every circuit you built
            was made from raw NANDs. From here on, complex circuits are
            assembled from gates you have already built — bottom-up, layer by
            layer. That is how all real chips are designed.
          </p>
        </div>
      </div>
    </div>
  );
}
