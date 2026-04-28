import { emptyState } from './simulator';
import type { CpuState } from './types';

/**
 * Initial CPU state for each demo instruction in lesson 20.
 *
 * Each preset:
 *   - Pre-loads registers with values that make the instruction *do something
 *     visible* (ADD with 5 + 3 = 8, LOAD pulling a value out of RAM, etc).
 *   - Puts the instruction byte at RAM[0] so the fetch sequence retrieves
 *     something real. The exact byte encoding is per Scott's book; for the
 *     lesson, the byte's value isn't pedagogically important — what matters
 *     is that fetch reads SOMETHING from RAM into IR.
 *   - Sets IAR to 0 (the address of the first byte to fetch).
 */

export interface InstructionPreset {
  /** Matches the recipe key in recipes.ts. */
  key: string;
  /** Initial CPU state for this demo. */
  initialState: CpuState;
  /** A line of explanatory text describing the setup. */
  setup: string;
  /** What the cycle should produce — for the lesson's "see the result" moment. */
  expected: string;
}

function withRegisters(
  base: CpuState,
  changes: Partial<CpuState['registers']>,
): CpuState {
  return {
    ...base,
    registers: { ...base.registers, ...changes },
  };
}

function withRam(base: CpuState, ramChanges: Record<number, number>): CpuState {
  const ram = base.ram.slice();
  for (const [addr, value] of Object.entries(ramChanges)) {
    ram[Number(addr)] = value & 0xff;
  }
  return { ...base, ram };
}

function buildAddPreset(): InstructionPreset {
  let s = emptyState();
  // Sentinel byte at IAR so fetch reads something. Exact encoding doesn't matter
  // for the visualization; we use 0x83 as a stand-in for "ADD R2, R3".
  s = withRam(s, { 0: 0x83 });
  // Some interesting register values.
  s = withRegisters(s, { R2: 5, R3: 3 });
  return {
    key: 'add',
    initialState: s,
    setup: 'R2 holds 5, R3 holds 3. The instruction at RAM[0] is ADD R2, R3.',
    expected: 'After one full cycle, R3 should hold 8 (= 5 + 3) and IAR should be 1.',
  };
}

function buildLoadPreset(): InstructionPreset {
  let s = emptyState();
  s = withRam(s, { 0: 0x01, 7: 99 }); // LOAD opcode at 0; data at address 7
  s = withRegisters(s, { R0: 7, R1: 0 });
  return {
    key: 'load',
    initialState: s,
    setup:
      'R0 holds the address 7. RAM[7] holds the value 99. The instruction at RAM[0] is LOAD R0, R1.',
    expected: 'After one full cycle, R1 should hold 99 and IAR should be 1.',
  };
}

function buildJmprPreset(): InstructionPreset {
  let s = emptyState();
  s = withRam(s, { 0: 0x40 }); // JMPR opcode at 0
  s = withRegisters(s, { R0: 12 });
  return {
    key: 'jmpr',
    initialState: s,
    setup: 'R0 holds the address 12. The instruction at RAM[0] is JMPR R0.',
    expected:
      'After one full cycle, IAR should be 12 — the CPU has redirected itself to jump to address 12 next.',
  };
}

export const PRESETS: readonly InstructionPreset[] = [
  buildAddPreset(),
  buildLoadPreset(),
  buildJmprPreset(),
] as const;

export function findPreset(key: string): InstructionPreset {
  const p = PRESETS.find((x) => x.key === key);
  if (!p) throw new Error(`No preset for key: ${key}`);
  return p;
}
