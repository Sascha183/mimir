import { describe, it, expect } from 'vitest';
import { evaluateGate, getGateArity } from '../gates';
import type { Bit, GateKind } from '../types';

const ALL_BITS: Bit[] = [0, 1];
const ALL_PAIRS: Array<[Bit, Bit]> = [
  [0, 0],
  [0, 1],
  [1, 0],
  [1, 1],
];

describe('evaluateGate', () => {
  it('NAND truth table', () => {
    expect(evaluateGate('NAND', 0, 0)).toBe(1);
    expect(evaluateGate('NAND', 0, 1)).toBe(1);
    expect(evaluateGate('NAND', 1, 0)).toBe(1);
    expect(evaluateGate('NAND', 1, 1)).toBe(0);
  });

  it('NOT truth table (in2 ignored)', () => {
    for (const ignored of ALL_BITS) {
      expect(evaluateGate('NOT', 0, ignored)).toBe(1);
      expect(evaluateGate('NOT', 1, ignored)).toBe(0);
    }
  });

  it('AND truth table', () => {
    expect(evaluateGate('AND', 0, 0)).toBe(0);
    expect(evaluateGate('AND', 0, 1)).toBe(0);
    expect(evaluateGate('AND', 1, 0)).toBe(0);
    expect(evaluateGate('AND', 1, 1)).toBe(1);
  });

  it('OR truth table', () => {
    expect(evaluateGate('OR', 0, 0)).toBe(0);
    expect(evaluateGate('OR', 0, 1)).toBe(1);
    expect(evaluateGate('OR', 1, 0)).toBe(1);
    expect(evaluateGate('OR', 1, 1)).toBe(1);
  });

  it('XOR truth table', () => {
    expect(evaluateGate('XOR', 0, 0)).toBe(0);
    expect(evaluateGate('XOR', 0, 1)).toBe(1);
    expect(evaluateGate('XOR', 1, 0)).toBe(1);
    expect(evaluateGate('XOR', 1, 1)).toBe(0);
  });

  it('returns a Bit (0 or 1) for every kind on every input pair', () => {
    const kinds: GateKind[] = ['NAND', 'NOT', 'AND', 'OR', 'XOR'];
    for (const kind of kinds) {
      for (const [a, b] of ALL_PAIRS) {
        const v = evaluateGate(kind, a, b);
        expect(v === 0 || v === 1).toBe(true);
      }
    }
  });
});

describe('getGateArity', () => {
  it('NOT is 1-input', () => {
    expect(getGateArity('NOT')).toBe(1);
  });
  it('NAND, AND, OR, XOR are 2-input', () => {
    expect(getGateArity('NAND')).toBe(2);
    expect(getGateArity('AND')).toBe(2);
    expect(getGateArity('OR')).toBe(2);
    expect(getGateArity('XOR')).toBe(2);
  });
});
