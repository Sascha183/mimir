import { describe, it, expect } from 'vitest';
import {
  buildClfRecipe,
  buildJcaezRecipe,
  decodeClf,
  decodeJcaez,
  encodeClf,
  encodeJcaez,
} from './conditional-jump';
import { executeStep, emptyState } from './simulator';
import { buildRecipeForIR, disassemble } from './decoder';
import { encodeAluInstruction } from './alu-instructions';
import { findConditionalProgram } from './conditional-programs';
import type { CpuState, FlagRegister } from './types';

const ZERO_FLAGS: FlagRegister = { carry: 0, aLarger: 0, equal: 0, zero: 0 };

function runFullCycle(
  initial: CpuState,
  recipe: ReturnType<typeof buildJcaezRecipe>,
): CpuState {
  let state = initial;
  for (let i = 0; i < 7; i++) {
    state = executeStep(state, recipe.steps[state.stepIdx]);
  }
  return state;
}

describe('conditional-jump encoding', () => {
  it('JCAEZ byte format: bits 7-4 = 0101', () => {
    expect(encodeJcaez(false, false, false, false) >> 4).toBe(0b0101);
    expect(encodeJcaez(true, true, true, true) >> 4).toBe(0b0101);
  });

  it('JCAEZ encode places C/A/E/Z bits in slots 3/2/1/0', () => {
    expect(encodeJcaez(true, false, false, false) & 0b1111).toBe(0b1000);
    expect(encodeJcaez(false, true, false, false) & 0b1111).toBe(0b0100);
    expect(encodeJcaez(false, false, true, false) & 0b1111).toBe(0b0010);
    expect(encodeJcaez(false, false, false, true) & 0b1111).toBe(0b0001);
  });

  it('JCAEZ decode produces correct mnemonics', () => {
    expect(decodeJcaez(encodeJcaez(false, true, false, false))?.mnemonic).toBe('JA');
    expect(decodeJcaez(encodeJcaez(false, false, true, false))?.mnemonic).toBe('JE');
    expect(decodeJcaez(encodeJcaez(true, false, false, true))?.mnemonic).toBe('JCZ');
    expect(decodeJcaez(encodeJcaez(true, true, true, true))?.mnemonic).toBe('JCAEZ');
  });

  it('JCAEZ decoder rejects non-JCAEZ opcodes', () => {
    expect(decodeJcaez(0b00000000)).toBeNull();
    expect(decodeJcaez(0b10000000)).toBeNull();
    expect(decodeJcaez(0b01000000)).toBeNull(); // JMP
  });

  it('CLF byte is 0b01100000', () => {
    expect(encodeClf()).toBe(0b01100000);
  });

  it('CLF decoder accepts any byte with high nibble 0110', () => {
    expect(decodeClf(0b01100000)).toBe(true);
    expect(decodeClf(0b01101111)).toBe(true);
    expect(decodeClf(0b01110000)).toBeNull();
  });
});

describe('conditional-jump recipes', () => {
  it('JA recipe with aLarger=1: step 5 enables RAM (jump)', () => {
    const flags: FlagRegister = { ...ZERO_FLAGS, aLarger: 1 };
    const decoded = decodeJcaez(encodeJcaez(false, true, false, false))!;
    const recipe = buildJcaezRecipe(decoded, flags);
    expect(recipe.steps[4]).toEqual([
      { kind: 'enable', label: 'RAM' },
      { kind: 'set', label: 'IAR' },
    ]);
  });

  it('JA recipe with aLarger=0: step 5 enables ACC (skip)', () => {
    const decoded = decodeJcaez(encodeJcaez(false, true, false, false))!;
    const recipe = buildJcaezRecipe(decoded, ZERO_FLAGS);
    expect(recipe.steps[4]).toEqual([
      { kind: 'enable', label: 'ACC' },
      { kind: 'set', label: 'IAR' },
    ]);
  });

  it('JE recipe ignores aLarger; only checks equal flag', () => {
    const decoded = decodeJcaez(encodeJcaez(false, false, true, false))!;
    // aLarger=1 but equal=0 — should NOT jump.
    const recipe = buildJcaezRecipe(decoded, { ...ZERO_FLAGS, aLarger: 1 });
    expect(recipe.steps[4][0]).toEqual({ kind: 'enable', label: 'ACC' });
  });

  it('JA cycle: with RAM[1]=12 and aLarger=1, IAR ends at 12', () => {
    let s = emptyState();
    s.flags = { ...ZERO_FLAGS, aLarger: 1 };
    const ram = s.ram.slice();
    ram[0] = encodeJcaez(false, true, false, false);
    ram[1] = 12;
    s = { ...s, ram };

    const decoded = decodeJcaez(encodeJcaez(false, true, false, false))!;
    const after = runFullCycle(s, buildJcaezRecipe(decoded, s.flags));
    expect(after.registers.IAR).toBe(12);
  });

  it('JA cycle: with aLarger=0, IAR advances by 2 (skips data byte)', () => {
    let s = emptyState();
    const ram = s.ram.slice();
    ram[0] = encodeJcaez(false, true, false, false);
    ram[1] = 12;
    s = { ...s, ram };

    const decoded = decodeJcaez(encodeJcaez(false, true, false, false))!;
    const after = runFullCycle(s, buildJcaezRecipe(decoded, ZERO_FLAGS));
    expect(after.registers.IAR).toBe(2);
  });

  it('CLF cycle clears all four flags', () => {
    let s = emptyState();
    s.flags = { carry: 1, aLarger: 1, equal: 1, zero: 1 };
    const ram = s.ram.slice();
    ram[0] = encodeClf();
    s = { ...s, ram };

    const after = runFullCycle(s, buildClfRecipe());
    expect(after.flags).toEqual(ZERO_FLAGS);
  });
});

describe('simulator: ALU flag computation', () => {
  it('ADD with overflow sets carry flag in ALU snapshot', () => {
    let s = emptyState();
    s.registers.R0 = 200;
    s.registers.TMP = 100;
    s = executeStep(s, [
      { kind: 'enable', label: 'R0' },
      { kind: 'alu', label: 'ADD' },
      { kind: 'set', label: 'ACC' },
      { kind: 'set', label: 'FLAGS' },
    ]);
    expect(s.flags.carry).toBe(1);
    expect(s.flags.zero).toBe(0); // 200+100 mod 256 = 44, non-zero
  });

  it('ADD without overflow leaves carry flag at 0', () => {
    let s = emptyState();
    s.registers.R0 = 5;
    s.registers.TMP = 3;
    s = executeStep(s, [
      { kind: 'enable', label: 'R0' },
      { kind: 'alu', label: 'ADD' },
      { kind: 'set', label: 'ACC' },
      { kind: 'set', label: 'FLAGS' },
    ]);
    expect(s.flags.carry).toBe(0);
  });

  it('CMP with bus > TMP sets aLarger; clears equal', () => {
    let s = emptyState();
    s.registers.R0 = 10;
    s.registers.TMP = 3;
    s = executeStep(s, [
      { kind: 'enable', label: 'R0' },
      { kind: 'alu', label: 'CMP' },
      { kind: 'set', label: 'ACC' },
      { kind: 'set', label: 'FLAGS' },
    ]);
    expect(s.flags.aLarger).toBe(1);
    expect(s.flags.equal).toBe(0);
  });

  it('CMP with bus === TMP sets equal; clears aLarger', () => {
    let s = emptyState();
    s.registers.R0 = 7;
    s.registers.TMP = 7;
    s = executeStep(s, [
      { kind: 'enable', label: 'R0' },
      { kind: 'alu', label: 'CMP' },
      { kind: 'set', label: 'ACC' },
      { kind: 'set', label: 'FLAGS' },
    ]);
    expect(s.flags.equal).toBe(1);
    expect(s.flags.aLarger).toBe(0);
  });

  it('CMP with bus < TMP leaves both aLarger and equal at 0', () => {
    let s = emptyState();
    s.registers.R0 = 2;
    s.registers.TMP = 9;
    s = executeStep(s, [
      { kind: 'enable', label: 'R0' },
      { kind: 'alu', label: 'CMP' },
      { kind: 'set', label: 'ACC' },
      { kind: 'set', label: 'FLAGS' },
    ]);
    expect(s.flags.aLarger).toBe(0);
    expect(s.flags.equal).toBe(0);
  });

  it('flags persist across non-ALU steps', () => {
    let s = emptyState();
    s.registers.R0 = 10;
    s.registers.TMP = 3;
    s = executeStep(s, [
      { kind: 'enable', label: 'R0' },
      { kind: 'alu', label: 'CMP' },
      { kind: 'set', label: 'ACC' },
      { kind: 'set', label: 'FLAGS' },
    ]);
    expect(s.flags.aLarger).toBe(1);

    // A non-ALU step shouldn't change flags.
    s = executeStep(s, [{ kind: 'enable', label: 'R0' }, { kind: 'set', label: 'R1' }]);
    expect(s.flags.aLarger).toBe(1);
  });
});

describe('decoder: JCAEZ and CLF dispatch', () => {
  it('buildRecipeForIR routes JCAEZ bytes to JCAEZ recipe', () => {
    const r = buildRecipeForIR(encodeJcaez(false, true, false, false), ZERO_FLAGS);
    expect(r.name.startsWith('JA')).toBe(true);
  });

  it('buildRecipeForIR routes CLF bytes to CLF recipe', () => {
    const r = buildRecipeForIR(encodeClf());
    expect(r.name).toBe('CLF');
  });

  it('disassemble recognizes JA as a 2-byte instruction with destination', () => {
    const ram = Array(16).fill(0);
    ram[0] = encodeJcaez(false, true, false, false);
    ram[1] = 12;
    const lines = disassemble(ram, 0, 2);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ byteCount: 2, mnemonic: 'JA 12' });
  });

  it('disassemble recognizes CLF as a 1-byte instruction', () => {
    const ram = Array(16).fill(0);
    ram[0] = encodeClf();
    const lines = disassemble(ram, 0, 1);
    expect(lines[0]).toMatchObject({ byteCount: 1, mnemonic: 'CLF' });
  });
});

describe('conditional-programs end-to-end', () => {
  function runProgramTo(state: CpuState, length: number): CpuState {
    let s = state;
    let safety = 200;
    // Run until we're at step 0 of a new cycle AND IAR is past the program.
    // (Stopping at "IAR >= length" mid-cycle would skip the last instruction's
    // execute steps.)
    while (safety > 0) {
      if (s.stepIdx === 0 && s.registers.IAR >= length) break;
      const recipe = buildRecipeForIR(s.registers.IR, s.flags);
      s = executeStep(s, recipe.steps[s.stepIdx]);
      safety -= 1;
    }
    return s;
  }

  it('R0 > R1 (7 vs 4): R3 ends at 7 via the fall-through path', () => {
    const program = findConditionalProgram('r0-larger');
    const after = runProgramTo(program.build(), program.programLength);
    expect(after.registers.R3).toBe(7);
  });

  it('R1 > R0 (4 vs 7): R3 ends at 7 via the JA-jump path', () => {
    const program = findConditionalProgram('r1-larger');
    const after = runProgramTo(program.build(), program.programLength);
    expect(after.registers.R3).toBe(7);
  });

  it('R0 == R1 (5 vs 5): JA does not branch; R3 ends at 5', () => {
    const program = findConditionalProgram('equal');
    const after = runProgramTo(program.build(), program.programLength);
    expect(after.registers.R3).toBe(5);
  });

  it('after CMP fires in R1 > R0 program, the A larger flag is set', () => {
    const program = findConditionalProgram('r1-larger');
    let s = program.build();
    // Run through the 4 instructions before JA: 3 DATA's + CMP = 4 cycles.
    for (let i = 0; i < 4 * 7; i++) {
      const recipe = buildRecipeForIR(s.registers.IR, s.flags);
      s = executeStep(s, recipe.steps[s.stepIdx]);
    }
    expect(s.flags.aLarger).toBe(1);
  });

  it('after CMP fires in R0 > R1 program, the A larger flag is NOT set (per the A-larger-means-bus-larger convention)', () => {
    const program = findConditionalProgram('r0-larger');
    let s = program.build();
    for (let i = 0; i < 4 * 7; i++) {
      const recipe = buildRecipeForIR(s.registers.IR, s.flags);
      s = executeStep(s, recipe.steps[s.stepIdx]);
    }
    expect(s.flags.aLarger).toBe(0);
  });

  it('after a CMP-to-self produces equal flag (not aLarger)', () => {
    const program = findConditionalProgram('equal');
    let s = program.build();
    for (let i = 0; i < 4 * 7; i++) {
      const recipe = buildRecipeForIR(s.registers.IR, s.flags);
      s = executeStep(s, recipe.steps[s.stepIdx]);
    }
    expect(s.flags.equal).toBe(1);
    expect(s.flags.aLarger).toBe(0);
  });
});

describe('ALU instruction recipes now include set FLAGS', () => {
  it('ADD recipe step 5 includes set FLAGS', () => {
    const r = buildRecipeForIR(encodeAluInstruction('ADD', 'R0', 'R1'));
    const step5 = r.steps[4];
    const hasSetFlags = step5.some(
      (a) => a.kind === 'set' && a.label === 'FLAGS',
    );
    expect(hasSetFlags).toBe(true);
  });
});
