import { describe, it, expect } from 'vitest';
import { executeStep, emptyState } from './simulator';
import { findRecipe } from './recipes';
import { findPreset } from './instructions';
import type { CpuState } from './types';

function runFullCycle(initial: CpuState, recipeKey: string): CpuState {
  const recipe = findRecipe(recipeKey);
  let state = initial;
  for (let i = 0; i < 7; i++) {
    state = executeStep(state, recipe.steps[state.stepIdx]);
  }
  return state;
}

describe('cpu/simulator', () => {
  it('advances the stepper modulo 7', () => {
    let s = emptyState();
    for (let i = 0; i < 7; i++) {
      s = executeStep(s, []);
    }
    expect(s.stepIdx).toBe(0);
  });

  it('enable + set transfers a byte across the bus', () => {
    let s = emptyState();
    s.registers.R0 = 42;
    s = executeStep(s, [
      { kind: 'enable', label: 'R0' },
      { kind: 'set', label: 'R1' },
    ]);
    expect(s.registers.R1).toBe(42);
    expect(s.bus.value).toBe(42);
    expect(s.bus.source).toBe('R0');
  });

  it('enable RAM reads RAM[MAR] onto the bus', () => {
    let s = emptyState();
    s.ram[5] = 99;
    s.registers.MAR = 5;
    s = executeStep(s, [
      { kind: 'enable', label: 'RAM' },
      { kind: 'set', label: 'IR' },
    ]);
    expect(s.registers.IR).toBe(99);
  });

  it('set ACC captures ALU output when an ALU action fires', () => {
    let s = emptyState();
    s.registers.R3 = 5;
    s.registers.TMP = 3;
    s = executeStep(s, [
      { kind: 'enable', label: 'R3' },
      { kind: 'alu', label: 'ADD' },
      { kind: 'set', label: 'ACC' },
    ]);
    expect(s.registers.ACC).toBe(8);
    expect(s.alu.op).toBe('ADD');
    expect(s.alu.output).toBe(8);
  });

  it('ADD +1 increments the bus value', () => {
    let s = emptyState();
    s.registers.IAR = 41;
    s = executeStep(s, [
      { kind: 'enable', label: 'IAR' },
      { kind: 'set', label: 'MAR' },
      { kind: 'alu', label: 'ADD +1' },
      { kind: 'set', label: 'ACC' },
    ]);
    expect(s.registers.MAR).toBe(41);
    expect(s.registers.ACC).toBe(42);
  });

  it('ADD R2, R3 full cycle: 5 + 3 = 8 in R3', () => {
    const preset = findPreset('add');
    const after = runFullCycle(preset.initialState, 'add');
    expect(after.registers.R3).toBe(8);
    expect(after.registers.IAR).toBe(1); // advanced by fetch
  });

  it('LOAD R0, R1 full cycle reads RAM[R0] into R1', () => {
    const preset = findPreset('load');
    const after = runFullCycle(preset.initialState, 'load');
    expect(after.registers.R1).toBe(99);
    expect(after.registers.IAR).toBe(1);
  });

  it('JMPR R0 full cycle redirects IAR to R0', () => {
    const preset = findPreset('jmpr');
    const after = runFullCycle(preset.initialState, 'jmpr');
    expect(after.registers.IAR).toBe(12);
  });

  it('after a full cycle the stepper returns to step 0 (1-indexed: step 1)', () => {
    const preset = findPreset('add');
    const after = runFullCycle(preset.initialState, 'add');
    expect(after.stepIdx).toBe(0);
  });

  it('empty action list still advances the stepper', () => {
    let s = emptyState();
    expect(s.stepIdx).toBe(0);
    s = executeStep(s, []);
    expect(s.stepIdx).toBe(1);
    expect(s.bus.value).toBeNull();
  });

  it('set RAM writes the bus value into RAM[MAR]', () => {
    let s = emptyState();
    s.registers.MAR = 3;
    s.registers.R0 = 77;
    s = executeStep(s, [
      { kind: 'enable', label: 'R0' },
      { kind: 'set', label: 'RAM' },
    ]);
    expect(s.ram[3]).toBe(77);
  });
});
