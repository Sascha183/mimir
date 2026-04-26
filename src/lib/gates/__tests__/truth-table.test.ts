import { describe, it, expect } from 'vitest';
import { generateTruthTable, compareTruthTables } from '../truth-table';
import type { Circuit, TruthTable } from '../types';

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

describe('compareTruthTables', () => {
  const andTable: TruthTable = {
    inputs: ['A', 'B'],
    outputs: ['Y'],
    rows: [
      { inputValues: [0, 0], outputValues: [0] },
      { inputValues: [0, 1], outputValues: [0] },
      { inputValues: [1, 0], outputValues: [0] },
      { inputValues: [1, 1], outputValues: [1] },
    ],
  };

  it('returns true for two identical tables', () => {
    expect(compareTruthTables(andTable, andTable)).toBe(true);
  });

  it('returns false when an output value differs', () => {
    const altered: TruthTable = {
      ...andTable,
      rows: andTable.rows.map((r, i) =>
        i === 0 ? { ...r, outputValues: [1] } : r,
      ),
    };
    expect(compareTruthTables(andTable, altered)).toBe(false);
  });

  it('returns true when row order differs', () => {
    const reordered: TruthTable = {
      ...andTable,
      rows: [
        { inputValues: [1, 1], outputValues: [1] },
        { inputValues: [0, 0], outputValues: [0] },
        { inputValues: [1, 0], outputValues: [0] },
        { inputValues: [0, 1], outputValues: [0] },
      ],
    };
    expect(compareTruthTables(andTable, reordered)).toBe(true);
  });

  it('returns true when input column order differs (logical equivalence)', () => {
    const swapped: TruthTable = {
      inputs: ['B', 'A'],
      outputs: ['Y'],
      rows: [
        { inputValues: [0, 0], outputValues: [0] }, // B=0, A=0
        { inputValues: [1, 0], outputValues: [0] }, // B=1, A=0
        { inputValues: [0, 1], outputValues: [0] }, // B=0, A=1
        { inputValues: [1, 1], outputValues: [1] }, // B=1, A=1
      ],
    };
    expect(compareTruthTables(andTable, swapped)).toBe(true);
  });

  it('returns false when input ids differ', () => {
    const renamed: TruthTable = { ...andTable, inputs: ['X', 'B'] };
    expect(compareTruthTables(andTable, renamed)).toBe(false);
  });

  it('returns false when output ids differ', () => {
    const renamed: TruthTable = { ...andTable, outputs: ['Z'] };
    expect(compareTruthTables(andTable, renamed)).toBe(false);
  });

  it('returns false when input/output counts differ', () => {
    const oneInput: TruthTable = {
      inputs: ['A'],
      outputs: ['Y'],
      rows: [
        { inputValues: [0], outputValues: [0] },
        { inputValues: [1], outputValues: [1] },
      ],
    };
    expect(compareTruthTables(andTable, oneInput)).toBe(false);
  });
});
