import { describe, it, expect } from 'vitest';
import {
  ALU_OPS,
  ALU_REGS,
  buildAluPreset,
  buildAluRecipe,
  decodeAluInstruction,
  encodeAluInstruction,
} from './alu-instructions';
import { executeStep } from './simulator';
import type { CpuState } from './types';

function runFullCycle(initial: CpuState, recipe: ReturnType<typeof buildAluRecipe>): CpuState {
  let state = initial;
  for (let i = 0; i < 7; i++) {
    state = executeStep(state, recipe.steps[state.stepIdx]);
  }
  return state;
}

describe('alu-instructions', () => {
  it('encode/decode round-trip for every op × regA × regB', () => {
    for (const op of ALU_OPS) {
      for (const a of ALU_REGS) {
        for (const b of ALU_REGS) {
          const byte = encodeAluInstruction(op, a, b);
          const decoded = decodeAluInstruction(byte);
          expect(decoded).toEqual({ op, regA: a, regB: b });
        }
      }
    }
  });

  it('encode sets bit 7 (ALU flag) high for every variant', () => {
    for (const op of ALU_OPS) {
      const byte = encodeAluInstruction(op, 'R0', 'R0');
      expect(byte & 0b10000000).toBe(0b10000000);
    }
  });

  it('decodes a non-ALU byte (bit 7 = 0) as null', () => {
    expect(decodeAluInstruction(0b00000000)).toBeNull();
    expect(decodeAluInstruction(0b01111111)).toBeNull();
  });

  it('every recipe has 7 steps', () => {
    for (const op of ALU_OPS) {
      const r = buildAluRecipe(op, 'R0', 'R1');
      expect(r.steps).toHaveLength(7);
    }
  });

  it('non-CMP recipes have a non-empty step 6 (writeback)', () => {
    for (const op of ALU_OPS) {
      if (op === 'CMP') continue;
      const r = buildAluRecipe(op, 'R0', 'R1');
      expect(r.steps[5].length).toBeGreaterThan(0);
    }
  });

  it('CMP recipe has an empty step 6 (no writeback)', () => {
    const r = buildAluRecipe('CMP', 'R0', 'R1');
    expect(r.steps[5]).toEqual([]);
  });

  it('ADD R2, R3 with the standard preset (R2=9, R3=3) yields R3=12', () => {
    const recipe = buildAluRecipe('ADD', 'R2', 'R3');
    const preset = buildAluPreset('ADD', 'R2', 'R3');
    const after = runFullCycle(preset.initialState, recipe);
    // R2=9, R3=3, ADD → R3 = 12
    expect(after.registers.R3).toBe(12);
  });

  it('AND R0, R1 with preset (R0=12, R1=5) yields R1 = 12 & 5 = 4', () => {
    const recipe = buildAluRecipe('AND', 'R0', 'R1');
    const preset = buildAluPreset('AND', 'R0', 'R1');
    const after = runFullCycle(preset.initialState, recipe);
    expect(after.registers.R1).toBe(12 & 5); // 4
  });

  it('XOR R0, R1 with preset (R0=12, R1=5) yields R1 = 12 ^ 5 = 9', () => {
    const recipe = buildAluRecipe('XOR', 'R0', 'R1');
    const preset = buildAluPreset('XOR', 'R0', 'R1');
    const after = runFullCycle(preset.initialState, recipe);
    expect(after.registers.R1).toBe(12 ^ 5); // 9
  });

  it('CMP R0, R1 leaves R1 unchanged', () => {
    const recipe = buildAluRecipe('CMP', 'R0', 'R1');
    const preset = buildAluPreset('CMP', 'R0', 'R1');
    const r1Before = preset.initialState.registers.R1;
    const after = runFullCycle(preset.initialState, recipe);
    expect(after.registers.R1).toBe(r1Before);
  });

  it('SHR R0, R0 with preset (R0=12) yields R0 = 6', () => {
    const recipe = buildAluRecipe('SHR', 'R0', 'R0');
    const preset = buildAluPreset('SHR', 'R0', 'R0');
    const after = runFullCycle(preset.initialState, recipe);
    expect(after.registers.R0).toBe(6);
  });

  it('the encoded instruction byte appears at RAM[0] in the preset', () => {
    const preset = buildAluPreset('OR', 'R2', 'R3');
    const expected = encodeAluInstruction('OR', 'R2', 'R3');
    expect(preset.initialState.ram[0]).toBe(expected);
  });
});
