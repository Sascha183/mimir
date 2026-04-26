import type { Bit, Circuit } from './types';
import { simulateCircuit } from './simulator';

export interface TruthTable {
  inputs: string[];
  outputs: string[];
  rows: { inputValues: Bit[]; outputValues: Bit[] }[];
}

/**
 * Generate a full truth table for a circuit by enumerating all 2^n input combinations.
 *
 * Row order is canonical: the first input is treated as the most significant bit,
 * so rows go (0,0,…,0), (0,0,…,1), …, (1,1,…,1).
 */
export function generateTruthTable(circuit: Circuit): TruthTable {
  const inputs = circuit.inputs.map((i) => i.id);
  const outputs = circuit.outputs.map((o) => o.id);
  const n = inputs.length;
  const rows: TruthTable['rows'] = [];

  const total = 1 << n; // 2^n
  for (let i = 0; i < total; i++) {
    const inputValues: Bit[] = [];
    const inputMap: Record<string, Bit> = {};
    for (let j = 0; j < n; j++) {
      const bit: Bit = ((i >> (n - 1 - j)) & 1) === 1 ? 1 : 0;
      inputValues.push(bit);
      inputMap[inputs[j]] = bit;
    }
    const out = simulateCircuit(circuit, inputMap);
    rows.push({
      inputValues,
      outputValues: outputs.map((id) => out[id] ?? 0),
    });
  }

  return { inputs, outputs, rows };
}
