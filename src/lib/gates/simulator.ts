import type { Bit, Circuit, GateInstance, PortRef, Wire } from './types';
import { evaluateGate, getGateArity } from './gates';

/**
 * Result of a full simulation pass: every gate's output value plus every
 * circuit output's value. The CircuitCanvas uses `gateOutputs` to color
 * wires by the value flowing through them.
 */
export interface NodeValues {
  gateOutputs: Record<string, Bit>;
  outputs: Record<string, Bit>;
}

/**
 * Public, minimal API: returns just the circuit outputs.
 */
export function simulateCircuit(
  circuit: Circuit,
  inputValues: Record<string, Bit>,
): Record<string, Bit> {
  return simulateAll(circuit, inputValues).outputs;
}

/**
 * Richer API: returns every gate's output value alongside the circuit outputs.
 * Used by the rendering layer.
 */
export function simulateAll(
  circuit: Circuit,
  inputValues: Record<string, Bit>,
): NodeValues {
  // Index every wire by its destination so we can ask "what feeds this port?"
  const wiresByDest = new Map<string, Wire>();
  for (const w of circuit.wires) {
    wiresByDest.set(destKey(w.to), w);
  }

  const gatesById = new Map<string, GateInstance>();
  for (const g of circuit.gates) {
    gatesById.set(g.id, g);
  }

  const memo = new Map<string, Bit>();
  const visiting = new Set<string>();

  function resolveSource(ref: PortRef): Bit {
    if ('source' in ref) {
      if (ref.source === 'input') {
        return inputValues[ref.inputId] ?? 0;
      }
      throw new Error('a circuit output cannot be the source of a wire');
    }
    if (ref.port !== 'out') {
      throw new Error(
        `gate input port "${ref.port}" cannot be the source of a wire (gate ${ref.gateId})`,
      );
    }
    return resolveGateOutput(ref.gateId);
  }

  function resolveGateOutput(gateId: string): Bit {
    const key = `gate:${gateId}:out`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;

    if (visiting.has(key)) {
      throw new Error(`circular wiring detected at gate "${gateId}"`);
    }
    visiting.add(key);

    const gate = gatesById.get(gateId);
    if (!gate) throw new Error(`unknown gate id: ${gateId}`);
    const arity = getGateArity(gate.kind);

    const in1Wire = wiresByDest.get(destKey({ gateId, port: 'in1' }));
    let in1: Bit;
    if (in1Wire) {
      in1 = resolveSource(in1Wire.from);
    } else {
      warnUnconnected(`${gateId}.in1`);
      in1 = 0;
    }

    let in2: Bit = 0;
    if (arity === 2) {
      const in2Wire = wiresByDest.get(destKey({ gateId, port: 'in2' }));
      if (in2Wire) {
        in2 = resolveSource(in2Wire.from);
      } else {
        warnUnconnected(`${gateId}.in2`);
        in2 = 0;
      }
    }

    const value = evaluateGate(gate.kind, in1, in2);
    visiting.delete(key);
    memo.set(key, value);
    return value;
  }

  // Resolve every circuit output.
  const outputs: Record<string, Bit> = {};
  for (const out of circuit.outputs) {
    const wire = wiresByDest.get(destKey({ source: 'output', outputId: out.id }));
    outputs[out.id] = wire ? resolveSource(wire.from) : 0;
  }

  // Force-compute any gate outputs not already memoized (gates not on a path
  // to a circuit output still get evaluated — useful for the canvas).
  const gateOutputs: Record<string, Bit> = {};
  for (const g of circuit.gates) {
    gateOutputs[g.id] = resolveGateOutput(g.id);
  }

  return { gateOutputs, outputs };
}

/**
 * Returns true if adding `newWire` to `circuit` would introduce a feedback loop.
 *
 * Implemented by re-running the simulator on the augmented circuit with all
 * inputs at 0 and catching the "circular wiring" error. Input values don't
 * affect cycle topology, so any consistent assignment works.
 */
export function wouldCreateCycle(circuit: Circuit, newWire: Wire): boolean {
  const augmented: Circuit = {
    gates: circuit.gates,
    inputs: circuit.inputs,
    outputs: circuit.outputs,
    wires: [...circuit.wires, newWire],
  };
  const inputValues: Record<string, Bit> = {};
  for (const input of augmented.inputs) {
    inputValues[input.id] = 0;
  }
  try {
    simulateAll(augmented, inputValues);
    return false;
  } catch (err) {
    if (err instanceof Error && /circular/i.test(err.message)) return true;
    throw err;
  }
}

function destKey(ref: PortRef): string {
  if ('source' in ref) {
    return ref.source === 'input'
      ? `input:${ref.inputId}`
      : `output:${ref.outputId}`;
  }
  return `gate:${ref.gateId}:${ref.port}`;
}

function warnUnconnected(name: string): void {
  // Only warn outside production. Vite/Astro replace `process.env.NODE_ENV`
  // at build time, so this becomes a dead branch in production bundles.
  // Accessed via globalThis so we don't need @types/node in this project.
  try {
    const proc = (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process;
    if (proc && proc.env && proc.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn(`Gate simulator: unconnected port "${name}", treating as 0`);
    }
  } catch {
    // Some environments don't expose `process` at all — skip silently.
  }
}
