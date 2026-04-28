import { describe, it, expect } from 'vitest';
import { ALU_REGS } from './alu-instructions';
import {
  buildJmpRecipe,
  buildJmprRecipe,
  decodeJmp,
  decodeJmpr,
  encodeJmp,
  encodeJmpr,
} from './jump-instructions';
import { executeStep, emptyState } from './simulator';
import { buildRecipeForIR, disassemble } from './decoder';
import { findJumpProgram } from './jump-programs';
import type { CpuState } from './types';

function runFullCycle(initial: CpuState, recipe: ReturnType<typeof buildJmpRecipe>): CpuState {
  let state = initial;
  for (let i = 0; i < 7; i++) {
    state = executeStep(state, recipe.steps[state.stepIdx]);
  }
  return state;
}

describe('jump-instructions', () => {
  it('JMP byte is 0b01000000 (= 64)', () => {
    expect(encodeJmp()).toBe(0b01000000);
  });

  it('JMP decoder accepts any byte with high nibble 0100', () => {
    expect(decodeJmp(0b01000000)).toBe(true);
    expect(decodeJmp(0b01001111)).toBe(true);
    expect(decodeJmp(0b00000000)).toBeNull();
    expect(decodeJmp(0b10000000)).toBeNull();
  });

  it('JMPR encode/decode round-trip', () => {
    for (const reg of ALU_REGS) {
      const byte = encodeJmpr(reg);
      const decoded = decodeJmpr(byte);
      expect(decoded).toEqual({ reg });
    }
  });

  it('JMPR encoded bytes have high nibble 0011', () => {
    for (const reg of ALU_REGS) {
      const byte = encodeJmpr(reg);
      expect((byte >> 4) & 0b1111).toBe(0b0011);
    }
  });

  it('JMP recipe: with RAM[0]=JMP byte and RAM[1]=42, IAR ends at 42', () => {
    let s = emptyState();
    const ram = s.ram.slice();
    ram[0] = encodeJmp();
    ram[1] = 12; // jump destination — within 16-byte visible window
    s = { ...s, ram };

    const after = runFullCycle(s, buildJmpRecipe());
    expect(after.registers.IAR).toBe(12);
  });

  it('JMPR recipe: with R0=9, IAR ends at 9', () => {
    let s = emptyState();
    s.registers.R0 = 9;
    const ram = s.ram.slice();
    ram[0] = encodeJmpr('R0');
    s = { ...s, ram };

    const after = runFullCycle(s, buildJmprRecipe('R0'));
    expect(after.registers.IAR).toBe(9);
  });

  it('decoder dispatch: JMP byte routes to JMP recipe', () => {
    const r = buildRecipeForIR(encodeJmp());
    expect(r.name).toBe('JMP');
  });

  it('decoder dispatch: JMPR byte routes to JMPR recipe', () => {
    const r = buildRecipeForIR(encodeJmpr('R2'));
    expect(r.name).toBe('JMPR R2');
  });

  it('disassemble recognizes JMP as a 2-byte instruction', () => {
    const ram = Array(16).fill(0);
    ram[0] = encodeJmp();
    ram[1] = 4;
    // Range matches exactly the JMP's 2 bytes — disassemble stops there.
    // (Walking past would re-decode the zero bytes as LOAD R0, R0, which
    // is technically a valid encoding.)
    const lines = disassemble(ram, 0, 2);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ address: 0, byteCount: 2, mnemonic: 'JMP 4' });
  });

  it('disassemble recognizes JMPR as a 1-byte instruction', () => {
    const ram = Array(16).fill(0);
    ram[0] = encodeJmpr('R0');
    const lines = disassemble(ram, 0, 1);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ address: 0, byteCount: 1, mnemonic: 'JMPR R0' });
  });
});

describe('jump-programs', () => {
  it('JMP loop program: 5 iterations leave R1 = 5', () => {
    const program = findJumpProgram('jmp-loop');
    let state = program.build();

    // Initial 2 instructions are setup (DATA R1, 0; DATA R2, 1). Each
    // takes 7 stepper steps. Then ADD + JMP each take 7 steps. Total per
    // iteration: 2 * 7 = 14 steps.
    // Setup: 2 instructions × 7 = 14 steps.
    // Then for 5 iterations: 5 × 14 = 70 steps.
    const totalSteps = 14 + 70;
    for (let i = 0; i < totalSteps; i++) {
      const recipe = buildRecipeForIR(state.registers.IR);
      state = executeStep(state, recipe.steps[state.stepIdx]);
    }
    expect(state.registers.R1).toBe(5);
  });

  it('JMPR loop program: 5 iterations leave R1 = 5', () => {
    const program = findJumpProgram('jmpr-loop');
    let state = program.build();

    // Setup: 3 instructions × 7 = 21 steps.
    // Per loop iteration: ADD + JMPR = 2 instructions × 7 = 14 steps.
    const totalSteps = 21 + 5 * 14;
    for (let i = 0; i < totalSteps; i++) {
      const recipe = buildRecipeForIR(state.registers.IR);
      state = executeStep(state, recipe.steps[state.stepIdx]);
    }
    expect(state.registers.R1).toBe(5);
  });

  it('JMP loop disassembles to 4 instructions', () => {
    const program = findJumpProgram('jmp-loop');
    const state = program.build();
    const lines = disassemble(state.ram, 0, program.programLength);
    expect(lines).toHaveLength(4);
    expect(lines[3]).toMatchObject({ mnemonic: 'JMP 4' });
  });

  it('JMPR loop disassembles to 5 instructions ending in JMPR R0', () => {
    const program = findJumpProgram('jmpr-loop');
    const state = program.build();
    const lines = disassemble(state.ram, 0, program.programLength);
    expect(lines).toHaveLength(5);
    expect(lines[4]).toMatchObject({ mnemonic: 'JMPR R0' });
  });
});
