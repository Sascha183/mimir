import type { Bit, Circuit, TruthTable } from './types';
import { simulateCircuit } from './simulator';

export type { TruthTable } from './types';

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

/**
 * Compare two truth tables for logical equivalence.
 *
 * Two tables are equal iff:
 *   - They have the same set of input column ids (order doesn't matter).
 *   - They have the same set of output column ids (order doesn't matter).
 *   - For every input combination, the output values match.
 *
 * Row order is irrelevant. Column order is irrelevant — rows are matched by
 * (input id → bit value) maps so a target table authored with inputs ['B', 'A']
 * compares correctly against a learner's circuit with inputs ['A', 'B'].
 */
export function compareTruthTables(a: TruthTable, b: TruthTable): boolean {
  if (a.inputs.length !== b.inputs.length) return false;
  if (a.outputs.length !== b.outputs.length) return false;
  if (a.rows.length !== b.rows.length) return false;

  const aInputSet = new Set(a.inputs);
  for (const id of b.inputs) if (!aInputSet.has(id)) return false;

  const aOutputSet = new Set(a.outputs);
  for (const id of b.outputs) if (!aOutputSet.has(id)) return false;

  // Build map: canonical input-pattern key → output map keyed by output id.
  const sortedInputs = [...a.inputs].sort();

  function buildMap(table: TruthTable): Map<string, Record<string, Bit>> {
    const map = new Map<string, Record<string, Bit>>();
    for (const row of table.rows) {
      const inputObj: Record<string, Bit> = {};
      table.inputs.forEach((id, idx) => {
        inputObj[id] = row.inputValues[idx];
      });
      const key = sortedInputs.map((id) => `${id}=${inputObj[id]}`).join(',');
      const outputObj: Record<string, Bit> = {};
      table.outputs.forEach((id, idx) => {
        outputObj[id] = row.outputValues[idx];
      });
      map.set(key, outputObj);
    }
    return map;
  }

  const aMap = buildMap(a);
  const bMap = buildMap(b);

  if (aMap.size !== bMap.size) return false;

  for (const [key, aOut] of aMap) {
    const bOut = bMap.get(key);
    if (!bOut) return false;
    for (const id of a.outputs) {
      if (aOut[id] !== bOut[id]) return false;
    }
  }

  return true;
}
