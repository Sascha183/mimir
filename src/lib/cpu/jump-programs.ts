import { encodeAluInstruction } from './alu-instructions';
import { encodeDataInstruction } from './data-instruction';
import { encodeJmp, encodeJmpr } from './jump-instructions';
import { emptyState } from './simulator';
import type { CpuState } from './types';

/**
 * Demo programs for lesson 24 (JUMP).
 *
 * Each is an infinite loop that increments R1 by 1 every iteration. The
 * difference is the encoding: one uses JMP (with the destination address
 * baked into RAM next to the opcode), the other uses JMPR (with the
 * destination address held in R0).
 */

export interface JumpProgram {
  key: string;
  name: string;
  description: string;
  /** Address of the loop's first body instruction — what jumps target. */
  loopHeadAddress: number;
  /** Number of bytes the program occupies. */
  programLength: number;
  /** Initial CPU state with the program loaded into RAM. */
  build: () => CpuState;
}

function buildJmpLoopProgram(): CpuState {
  // 0..1: DATA R1, 0   ; R1 = 0 (the counter we'll increment)
  // 2..3: DATA R2, 1   ; R2 = 1 (the increment)
  // 4:    ADD R2, R1   ; R1 += 1 — loop body starts here
  // 5..6: JMP 4        ; jump back to address 4
  const s = emptyState();
  const ram = s.ram.slice();
  ram[0] = encodeDataInstruction('R1');
  ram[1] = 0;
  ram[2] = encodeDataInstruction('R2');
  ram[3] = 1;
  ram[4] = encodeAluInstruction('ADD', 'R2', 'R1');
  ram[5] = encodeJmp();
  ram[6] = 4; // jump destination — back to ADD
  return { ...s, ram };
}

function buildJmprLoopProgram(): CpuState {
  // 0..1: DATA R1, 0   ; R1 = 0
  // 2..3: DATA R2, 1   ; R2 = 1
  // 4..5: DATA R0, 6   ; R0 = 6 (the loop entry point)
  // 6:    ADD R2, R1   ; R1 += 1 — loop body
  // 7:    JMPR R0      ; jump to address held in R0 (= 6)
  const s = emptyState();
  const ram = s.ram.slice();
  ram[0] = encodeDataInstruction('R1');
  ram[1] = 0;
  ram[2] = encodeDataInstruction('R2');
  ram[3] = 1;
  ram[4] = encodeDataInstruction('R0');
  ram[5] = 6;
  ram[6] = encodeAluInstruction('ADD', 'R2', 'R1');
  ram[7] = encodeJmpr('R0');
  return { ...s, ram };
}

export const JUMP_PROGRAMS: readonly JumpProgram[] = [
  {
    key: 'jmp-loop',
    name: 'Loop with JMP',
    description:
      'A 4-instruction loop that increments R1 by 1 forever. JMP at address 5 has its destination (4) sitting at address 6 — the byte right after the opcode.',
    loopHeadAddress: 4,
    programLength: 7,
    build: buildJmpLoopProgram,
  },
  {
    key: 'jmpr-loop',
    name: 'Loop with JMPR',
    description:
      'Same loop as the JMP version, but the destination address is kept in R0. JMPR R0 reads R0 and writes that value into IAR — the destination is in a register rather than in RAM.',
    loopHeadAddress: 6,
    programLength: 8,
    build: buildJmprLoopProgram,
  },
] as const;

export function findJumpProgram(key: string): JumpProgram {
  const p = JUMP_PROGRAMS.find((x) => x.key === key);
  if (!p) throw new Error(`No jump program: ${key}`);
  return p;
}
