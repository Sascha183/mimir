import { describe, it, expect } from 'vitest';
import { ALU_REGS } from './alu-instructions';
import {
  buildDataRecipe,
  decodeDataInstruction,
  encodeDataInstruction,
} from './data-instruction';
import { executeStep, emptyState } from './simulator';
import { buildDemoProgramState, PROGRAM_DEMO_RESULT_ADDRESS } from './program';
import { buildRecipeForIR, disassemble } from './decoder';
import type { CpuState } from './types';

function runFullCycle(initial: CpuState, recipe: ReturnType<typeof buildDataRecipe>): CpuState {
  let state = initial;
  for (let i = 0; i < 7; i++) {
    state = executeStep(state, recipe.steps[state.stepIdx]);
  }
  return state;
}

describe('data-instruction', () => {
  it('encode/decode round-trip for every register', () => {
    for (const reg of ALU_REGS) {
      const byte = encodeDataInstruction(reg);
      const decoded = decodeDataInstruction(byte);
      expect(decoded).toEqual({ regB: reg });
    }
  });

  it('encoded byte has bits 7-4 = 0010', () => {
    for (const reg of ALU_REGS) {
      const byte = encodeDataInstruction(reg);
      expect((byte >> 4) & 0b1111).toBe(0b0010);
    }
  });

  it('decoder rejects bytes outside the DATA opcode range', () => {
    expect(decodeDataInstruction(0b00000000)).toBeNull();
    expect(decodeDataInstruction(0b10000000)).toBeNull();
    expect(decodeDataInstruction(0b00010000)).toBeNull(); // STORE
  });

  it('a full DATA cycle loads the byte at IAR+1 into the destination and advances IAR by 2', () => {
    let s = emptyState();
    const ram = s.ram.slice();
    ram[0] = encodeDataInstruction('R2');
    ram[1] = 42;
    s = { ...s, ram };

    const recipe = buildDataRecipe('R2');
    const after = runFullCycle(s, recipe);
    expect(after.registers.R2).toBe(42);
    expect(after.registers.IAR).toBe(2); // skipped past the data byte
  });
});

describe('decoder', () => {
  it('buildRecipeForIR: unknown bytes get a 7-step no-op recipe', () => {
    const recipe = buildRecipeForIR(0xff); // all-ones byte — undefined in our set
    // We accept ANY byte that doesn't match a known opcode; ensure the recipe is well-formed.
    expect(recipe.steps).toHaveLength(7);
    // For "unknown" recipes execute steps are empty.
    if (recipe.name.startsWith('unknown') || recipe.name === '(no instruction)') {
      expect(recipe.steps[3]).toEqual([]);
      expect(recipe.steps[4]).toEqual([]);
      expect(recipe.steps[5]).toEqual([]);
    }
  });

  it('buildRecipeForIR routes ALU bytes to ALU recipes', () => {
    // ADD R0, R0 = 0b1000_0000 = 128.
    const recipe = buildRecipeForIR(0b10000000);
    expect(recipe.name).toContain('ADD');
  });

  it('buildRecipeForIR routes LOAD bytes to LOAD recipes', () => {
    // LOAD R0, R0 = 0b0000_0000 = 0... but 0 is the noop case.
    // Use LOAD R1, R2 = 0b0000_0110 = 6.
    const recipe = buildRecipeForIR(0b00000110);
    expect(recipe.name).toContain('LOAD');
  });

  it('buildRecipeForIR routes DATA bytes to DATA recipes', () => {
    const recipe = buildRecipeForIR(encodeDataInstruction('R3'));
    expect(recipe.name).toContain('DATA');
  });

  it('disassemble walks the demo program correctly', () => {
    const s = buildDemoProgramState();
    const lines = disassemble(s.ram, 0, 8);
    expect(lines).toHaveLength(5);
    expect(lines[0]).toMatchObject({ address: 0, byteCount: 2, mnemonic: 'DATA R0, 5' });
    expect(lines[1]).toMatchObject({ address: 2, byteCount: 2, mnemonic: 'DATA R1, 3' });
    expect(lines[2]).toMatchObject({ address: 4, byteCount: 1, mnemonic: 'ADD R0, R1' });
    expect(lines[3]).toMatchObject({ address: 5, byteCount: 2, mnemonic: 'DATA R0, 14' });
    expect(lines[4]).toMatchObject({ address: 7, byteCount: 1, mnemonic: 'STORE R0, R1' });
  });
});

describe('demo program execution', () => {
  it('running the full 5-instruction program puts 8 in RAM[14]', () => {
    let state = buildDemoProgramState();
    // Run exactly 5 instruction cycles (5 × 7 = 35 steps).
    for (let i = 0; i < 5 * 7; i++) {
      const recipe = buildRecipeForIR(state.registers.IR);
      state = executeStep(state, recipe.steps[state.stepIdx]);
    }
    expect(state.ram[PROGRAM_DEMO_RESULT_ADDRESS]).toBe(8);
    expect(state.registers.R1).toBe(8);
    expect(state.registers.R0).toBe(14);
  });
});
