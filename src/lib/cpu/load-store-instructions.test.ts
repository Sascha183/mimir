import { describe, it, expect } from 'vitest';
import { ALU_REGS, type AluReg } from './alu-instructions';
import {
  LOAD_STORE_OPS,
  buildLoadStorePreset,
  buildLoadStoreRecipe,
  decodeLoadStore,
  encodeLoadStore,
  type LoadStoreOp,
} from './load-store-instructions';
import { executeStep } from './simulator';
import type { CpuState } from './types';

function runFullCycle(initial: CpuState, recipe: ReturnType<typeof buildLoadStoreRecipe>): CpuState {
  let state = initial;
  for (let i = 0; i < 7; i++) {
    state = executeStep(state, recipe.steps[state.stepIdx]);
  }
  return state;
}

describe('load-store-instructions', () => {
  it('encode/decode round-trip for every op × regA × regB', () => {
    for (const op of LOAD_STORE_OPS) {
      for (const a of ALU_REGS) {
        for (const b of ALU_REGS) {
          const byte = encodeLoadStore(op, a, b);
          const decoded = decodeLoadStore(byte);
          expect(decoded).toEqual({ op, regA: a, regB: b });
        }
      }
    }
  });

  it('LOAD bytes have bit 4 = 0; STORE bytes have bit 4 = 1', () => {
    expect(encodeLoadStore('LOAD', 'R0', 'R0') & 0b00010000).toBe(0);
    expect(encodeLoadStore('STORE', 'R0', 'R0') & 0b00010000).toBe(0b00010000);
  });

  it('non-LOAD/STORE opcodes decode to null', () => {
    // Bit 7 = 1 → ALU territory, not a LOAD/STORE.
    expect(decodeLoadStore(0b10000000)).toBeNull();
    // Bits 7-4 = 0010 → DATA territory.
    expect(decodeLoadStore(0b00100000)).toBeNull();
  });

  it('every recipe has 7 steps with empty step 6', () => {
    for (const op of LOAD_STORE_OPS) {
      for (const a of ALU_REGS) {
        for (const b of ALU_REGS) {
          const r = buildLoadStoreRecipe(op, a, b);
          expect(r.steps).toHaveLength(7);
          expect(r.steps[5]).toEqual([]);
        }
      }
    }
  });

  it('LOAD R0, R1 with default preset: R1 ends at 99 (= RAM[7])', () => {
    const recipe = buildLoadStoreRecipe('LOAD', 'R0', 'R1');
    const preset = buildLoadStorePreset('LOAD', 'R0', 'R1');
    const after = runFullCycle(preset.initialState, recipe);
    expect(after.registers.R1).toBe(99);
    // RAM unchanged.
    expect(after.ram[7]).toBe(99);
  });

  it('STORE R0, R2 with default preset: RAM[5] ends at 42 (= R2)', () => {
    const recipe = buildLoadStoreRecipe('STORE', 'R0', 'R2');
    const preset = buildLoadStorePreset('STORE', 'R0', 'R2');
    const after = runFullCycle(preset.initialState, recipe);
    expect(after.ram[5]).toBe(42);
    // R2 still holds 42.
    expect(after.registers.R2).toBe(42);
  });

  it('STORE R0, R0 (regA == regB) writes the address itself into RAM[address]', () => {
    const recipe = buildLoadStoreRecipe('STORE', 'R0', 'R0');
    const preset = buildLoadStorePreset('STORE', 'R0', 'R0');
    // Preset sets R0 = 5 (the address); STORE writes R0 (= 5) to RAM[5].
    const after = runFullCycle(preset.initialState, recipe);
    expect(after.ram[5]).toBe(5);
  });

  it('LOAD R0, R0 (regA == regB) overwrites the address holder with the loaded value', () => {
    const recipe = buildLoadStoreRecipe('LOAD', 'R0', 'R0');
    const preset = buildLoadStorePreset('LOAD', 'R0', 'R0');
    // Preset sets R0 = 7 (address) and RAM[7] = 99.
    // After cycle: R0 = 99 (= RAM[7]), since R0 is also regB.
    const after = runFullCycle(preset.initialState, recipe);
    expect(after.registers.R0).toBe(99);
  });

  it('LOAD recipe step 5 enables RAM and sets regB; STORE recipe step 5 enables regB and sets RAM', () => {
    const loadR = buildLoadStoreRecipe('LOAD', 'R2', 'R3');
    expect(loadR.steps[4]).toEqual([
      { kind: 'enable', label: 'RAM' },
      { kind: 'set', label: 'R3' },
    ]);
    const storeR = buildLoadStoreRecipe('STORE', 'R2', 'R3');
    expect(storeR.steps[4]).toEqual([
      { kind: 'enable', label: 'R3' },
      { kind: 'set', label: 'RAM' },
    ]);
  });

  it('the encoded byte appears at RAM[0] in the preset', () => {
    const preset = buildLoadStorePreset('STORE', 'R3', 'R2');
    const expected = encodeLoadStore('STORE', 'R3', 'R2');
    expect(preset.initialState.ram[0]).toBe(expected);
  });
});
