import type { Bit, GateKind } from './types';

/**
 * Truth function for each gate kind.
 *
 * For single-input gates (NOT), `in2` is ignored. We accept it in the signature
 * so callers can route both inputs through the simulator without branching.
 */
export function evaluateGate(kind: GateKind, in1: Bit, in2: Bit): Bit {
  switch (kind) {
    case 'NAND':
      return in1 === 1 && in2 === 1 ? 0 : 1;
    case 'NOT':
      return in1 === 1 ? 0 : 1;
    case 'AND':
      return in1 === 1 && in2 === 1 ? 1 : 0;
    case 'OR':
      return in1 === 1 || in2 === 1 ? 1 : 0;
    case 'XOR':
      return in1 !== in2 ? 1 : 0;
  }
}

/**
 * Number of inputs each gate kind takes. Used by the simulator to decide
 * whether to look up a wire on `in2`, and by the UI to position input ports.
 */
export function getGateArity(kind: GateKind): 1 | 2 {
  return kind === 'NOT' ? 1 : 2;
}
