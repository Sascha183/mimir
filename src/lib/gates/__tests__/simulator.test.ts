import { describe, it, expect } from 'vitest';
import { simulateCircuit, simulateAll, wouldCreateCycle } from '../simulator';
import type { Circuit, Wire } from '../types';

function nandCircuit(): Circuit {
  return {
    gates: [{ id: 'g1', kind: 'NAND', position: { x: 0, y: 0 } }],
    wires: [
      { id: 'w1', from: { source: 'input', inputId: 'A' }, to: { gateId: 'g1', port: 'in1' } },
      { id: 'w2', from: { source: 'input', inputId: 'B' }, to: { gateId: 'g1', port: 'in2' } },
      { id: 'w3', from: { gateId: 'g1', port: 'out' }, to: { source: 'output', outputId: 'Y' } },
    ],
    inputs: [
      { id: 'A', label: 'A', value: 0 },
      { id: 'B', label: 'B', value: 0 },
    ],
    outputs: [{ id: 'Y', label: 'Y' }],
  };
}

function notFromNandCircuit(): Circuit {
  return {
    gates: [{ id: 'g1', kind: 'NAND', position: { x: 0, y: 0 } }],
    wires: [
      // Fan-out: A drives both NAND inputs.
      { id: 'w1', from: { source: 'input', inputId: 'A' }, to: { gateId: 'g1', port: 'in1' } },
      { id: 'w2', from: { source: 'input', inputId: 'A' }, to: { gateId: 'g1', port: 'in2' } },
      { id: 'w3', from: { gateId: 'g1', port: 'out' }, to: { source: 'output', outputId: 'Y' } },
    ],
    inputs: [{ id: 'A', label: 'A', value: 0 }],
    outputs: [{ id: 'Y', label: 'Y' }],
  };
}

describe('simulateCircuit', () => {
  it('evaluates a single NAND gate over all four input combinations', () => {
    const c = nandCircuit();
    expect(simulateCircuit(c, { A: 0, B: 0 })).toEqual({ Y: 1 });
    expect(simulateCircuit(c, { A: 0, B: 1 })).toEqual({ Y: 1 });
    expect(simulateCircuit(c, { A: 1, B: 0 })).toEqual({ Y: 1 });
    expect(simulateCircuit(c, { A: 1, B: 1 })).toEqual({ Y: 0 });
  });

  it('handles fan-out: a single input feeding two gate inputs (NAND-as-NOT)', () => {
    const c = notFromNandCircuit();
    expect(simulateCircuit(c, { A: 0 })).toEqual({ Y: 1 });
    expect(simulateCircuit(c, { A: 1 })).toEqual({ Y: 0 });
  });

  it('chains NAND → NOT to produce AND', () => {
    const c: Circuit = {
      gates: [
        { id: 'nand1', kind: 'NAND', position: { x: 0, y: 0 } },
        { id: 'not1', kind: 'NOT', position: { x: 100, y: 0 } },
      ],
      wires: [
        { id: 'w1', from: { source: 'input', inputId: 'A' }, to: { gateId: 'nand1', port: 'in1' } },
        { id: 'w2', from: { source: 'input', inputId: 'B' }, to: { gateId: 'nand1', port: 'in2' } },
        { id: 'w3', from: { gateId: 'nand1', port: 'out' }, to: { gateId: 'not1', port: 'in1' } },
        { id: 'w4', from: { gateId: 'not1', port: 'out' }, to: { source: 'output', outputId: 'Y' } },
      ],
      inputs: [
        { id: 'A', label: 'A', value: 0 },
        { id: 'B', label: 'B', value: 0 },
      ],
      outputs: [{ id: 'Y', label: 'Y' }],
    };
    expect(simulateCircuit(c, { A: 0, B: 0 })).toEqual({ Y: 0 });
    expect(simulateCircuit(c, { A: 0, B: 1 })).toEqual({ Y: 0 });
    expect(simulateCircuit(c, { A: 1, B: 0 })).toEqual({ Y: 0 });
    expect(simulateCircuit(c, { A: 1, B: 1 })).toEqual({ Y: 1 });
  });

  it('treats unconnected inputs as 0 (does not throw)', () => {
    const c: Circuit = {
      gates: [{ id: 'g1', kind: 'NAND', position: { x: 0, y: 0 } }],
      wires: [
        { id: 'w1', from: { source: 'input', inputId: 'A' }, to: { gateId: 'g1', port: 'in1' } },
        // in2 is intentionally unconnected
        { id: 'w3', from: { gateId: 'g1', port: 'out' }, to: { source: 'output', outputId: 'Y' } },
      ],
      inputs: [{ id: 'A', label: 'A', value: 0 }],
      outputs: [{ id: 'Y', label: 'Y' }],
    };
    // NAND(A=1, B=0) = 1
    expect(simulateCircuit(c, { A: 1 })).toEqual({ Y: 1 });
  });

  it('throws on circular wiring', () => {
    const c: Circuit = {
      gates: [{ id: 'g1', kind: 'NAND', position: { x: 0, y: 0 } }],
      wires: [
        // Feed g1.out back into g1.in1 — a cycle.
        { id: 'w1', from: { gateId: 'g1', port: 'out' }, to: { gateId: 'g1', port: 'in1' } },
        { id: 'w2', from: { source: 'input', inputId: 'A' }, to: { gateId: 'g1', port: 'in2' } },
        { id: 'w3', from: { gateId: 'g1', port: 'out' }, to: { source: 'output', outputId: 'Y' } },
      ],
      inputs: [{ id: 'A', label: 'A', value: 0 }],
      outputs: [{ id: 'Y', label: 'Y' }],
    };
    expect(() => simulateCircuit(c, { A: 0 })).toThrow(/circular/i);
  });
});

describe('simulateAll', () => {
  it('returns every gate output alongside the circuit outputs', () => {
    const c: Circuit = {
      gates: [
        { id: 'nand1', kind: 'NAND', position: { x: 0, y: 0 } },
        { id: 'not1', kind: 'NOT', position: { x: 100, y: 0 } },
      ],
      wires: [
        { id: 'w1', from: { source: 'input', inputId: 'A' }, to: { gateId: 'nand1', port: 'in1' } },
        { id: 'w2', from: { source: 'input', inputId: 'B' }, to: { gateId: 'nand1', port: 'in2' } },
        { id: 'w3', from: { gateId: 'nand1', port: 'out' }, to: { gateId: 'not1', port: 'in1' } },
        { id: 'w4', from: { gateId: 'not1', port: 'out' }, to: { source: 'output', outputId: 'Y' } },
      ],
      inputs: [
        { id: 'A', label: 'A', value: 0 },
        { id: 'B', label: 'B', value: 0 },
      ],
      outputs: [{ id: 'Y', label: 'Y' }],
    };
    const r = simulateAll(c, { A: 1, B: 1 });
    expect(r.gateOutputs).toEqual({ nand1: 0, not1: 1 });
    expect(r.outputs).toEqual({ Y: 1 });
  });
});

describe('wouldCreateCycle', () => {
  it('returns false for a wire that does not introduce a cycle', () => {
    const circuit: Circuit = {
      gates: [
        { id: 'g1', kind: 'NAND', position: { x: 0, y: 0 } },
        { id: 'g2', kind: 'NOT', position: { x: 100, y: 0 } },
      ],
      wires: [
        { id: 'w1', from: { source: 'input', inputId: 'A' }, to: { gateId: 'g1', port: 'in1' } },
        { id: 'w2', from: { source: 'input', inputId: 'B' }, to: { gateId: 'g1', port: 'in2' } },
      ],
      inputs: [
        { id: 'A', label: 'A', value: 0 },
        { id: 'B', label: 'B', value: 0 },
      ],
      outputs: [{ id: 'Y', label: 'Y' }],
    };
    const wire: Wire = {
      id: 'wNew',
      from: { gateId: 'g1', port: 'out' },
      to: { gateId: 'g2', port: 'in1' },
    };
    expect(wouldCreateCycle(circuit, wire)).toBe(false);
  });

  it('returns true for a self-loop (gate output back to its own input)', () => {
    const circuit: Circuit = {
      gates: [{ id: 'g1', kind: 'NAND', position: { x: 0, y: 0 } }],
      wires: [
        { id: 'w1', from: { source: 'input', inputId: 'A' }, to: { gateId: 'g1', port: 'in1' } },
      ],
      inputs: [{ id: 'A', label: 'A', value: 0 }],
      outputs: [{ id: 'Y', label: 'Y' }],
    };
    const wire: Wire = {
      id: 'wLoop',
      from: { gateId: 'g1', port: 'out' },
      to: { gateId: 'g1', port: 'in2' },
    };
    expect(wouldCreateCycle(circuit, wire)).toBe(true);
  });

  it('returns true for a multi-gate feedback cycle', () => {
    const circuit: Circuit = {
      gates: [
        { id: 'g1', kind: 'NAND', position: { x: 0, y: 0 } },
        { id: 'g2', kind: 'NAND', position: { x: 100, y: 0 } },
      ],
      wires: [
        // g1.out → g2.in1 already exists. The new wire closes the loop g2 → g1.
        { id: 'w1', from: { gateId: 'g1', port: 'out' }, to: { gateId: 'g2', port: 'in1' } },
      ],
      inputs: [{ id: 'A', label: 'A', value: 0 }],
      outputs: [{ id: 'Y', label: 'Y' }],
    };
    const wire: Wire = {
      id: 'wBack',
      from: { gateId: 'g2', port: 'out' },
      to: { gateId: 'g1', port: 'in1' },
    };
    expect(wouldCreateCycle(circuit, wire)).toBe(true);
  });
});
