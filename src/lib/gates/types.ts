/**
 * Core types for the gate-circuit library.
 *
 * The shape is deliberately data-only: a Circuit is a plain object you can
 * serialize, diff, persist, and (eventually) edit visually. The simulator
 * and the rendering layer both consume Circuits without ever mutating them.
 */

export type Bit = 0 | 1;

export type GateKind = 'NAND' | 'NOT' | 'AND' | 'OR' | 'XOR';

export type GatePort = 'in1' | 'in2' | 'out';

export interface GateInstance {
  id: string;
  kind: GateKind;
  position: { x: number; y: number };
}

/**
 * A reference to a port that a wire can connect to or from.
 *
 *  - `{ gateId, port }`        — a port on a specific gate ("in1", "in2", "out").
 *  - `{ source: 'input',  inputId }`  — a circuit-level input pin (signals enter here).
 *  - `{ source: 'output', outputId }` — a circuit-level output pin (signals exit here).
 *
 * The simulator treats `'input'` refs and `gate out` refs as *sources* (a wire's `from`),
 * and `'output'` refs and `gate in1/in2` refs as *destinations* (a wire's `to`).
 */
export type PortRef =
  | { gateId: string; port: GatePort }
  | { source: 'input'; inputId: string }
  | { source: 'output'; outputId: string };

export interface Wire {
  id: string;
  from: PortRef;
  to: PortRef;
}

export interface CircuitInput {
  id: string;
  label: string;
  /** Default initial value. Runtime input values are passed separately to the simulator. */
  value: Bit;
}

export interface CircuitOutput {
  id: string;
  label: string;
}

export interface Circuit {
  gates: GateInstance[];
  wires: Wire[];
  inputs: CircuitInput[];
  outputs: CircuitOutput[];
}

/**
 * Tabular result of running a circuit through every input combination.
 *
 * `inputs` and `outputs` list column ids in the order they appear in each
 * row's `inputValues` / `outputValues`. Row order is canonical (LSB-major)
 * when produced by `generateTruthTable`, but `compareTruthTables` is
 * order-insensitive so authored target tables don't have to follow the same
 * convention.
 */
export interface TruthTable {
  inputs: string[];
  outputs: string[];
  rows: { inputValues: Bit[]; outputValues: Bit[] }[];
}
