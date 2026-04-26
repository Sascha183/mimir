import { describe, it, expect } from 'vitest';
import { generateTruthTable } from '../truth-table';
import type { Circuit } from '../types';

describe('generateTruthTable', () => {
  it('produces the NAND truth table for a single NAND gate', () => {
    const circuit: Circuit = {
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
    const tt = generateTruthTable(circuit);
    expect(tt.inputs).toEqual(['A', 'B']);
    expect(tt.outputs).toEqual(['Y']);
    expect(tt.rows).toHaveLength(4);
    expect(tt.rows[0]).toEqual({ inputValues: [0, 0], outputValues: [1] });
    expect(tt.rows[1]).toEqual({ inputValues: [0, 1], outputValues: [1] });
    expect(tt.rows[2]).toEqual({ inputValues: [1, 0], outputValues: [1] });
    expect(tt.rows[3]).toEqual({ inputValues: [1, 1], outputValues: [0] });
  });

  it('produces the NOT truth table when a NAND has both inputs tied together', () => {
    const circuit: Circuit = {
      gates: [{ id: 'g1', kind: 'NAND', position: { x: 0, y: 0 } }],
      wires: [
        { id: 'w1', from: { source: 'input', inputId: 'A' }, to: { gateId: 'g1', port: 'in1' } },
        { id: 'w2', from: { source: 'input', inputId: 'A' }, to: { gateId: 'g1', port: 'in2' } },
        { id: 'w3', from: { gateId: 'g1', port: 'out' }, to: { source: 'output', outputId: 'Y' } },
      ],
      inputs: [{ id: 'A', label: 'A', value: 0 }],
      outputs: [{ id: 'Y', label: 'Y' }],
    };
    const tt = generateTruthTable(circuit);
    expect(tt.rows).toEqual([
      { inputValues: [0], outputValues: [1] },
      { inputValues: [1], outputValues: [0] },
    ]);
  });
});
