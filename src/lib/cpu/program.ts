import { encodeAluInstruction } from './alu-instructions';
import { encodeLoadStore } from './load-store-instructions';
import { encodeDataInstruction } from './data-instruction';
import { emptyState } from './simulator';
import type { CpuState } from './types';

/**
 * The lesson-23 demo program.
 *
 * Source (in mnemonic form):
 *   DATA  R0, 5
 *   DATA  R1, 3
 *   ADD   R0, R1     ; R1 = R1 + R0 = 8
 *   DATA  R0, 14
 *   STORE R0, R1     ; RAM[14] = 8
 *
 * Eight bytes total: three 2-byte DATA instructions, one 1-byte ADD, one
 * 1-byte STORE. After running, RAM[14] holds 8 — the proof that we have
 * a real, multi-instruction program executing on a real CPU.
 *
 * Result address is 14 (not 100 as in some textbook examples) because our
 * visible RAM is 16 bytes wide. The choice of address doesn't change the
 * pedagogy — what matters is that we wrote a value to a chosen location.
 */

export const PROGRAM_DEMO_RESULT_ADDRESS = 14;

export function buildDemoProgramState(): CpuState {
  const s = emptyState();
  const ram = s.ram.slice();

  // RAM[0..1]: DATA R0, 5
  ram[0] = encodeDataInstruction('R0');
  ram[1] = 5;
  // RAM[2..3]: DATA R1, 3
  ram[2] = encodeDataInstruction('R1');
  ram[3] = 3;
  // RAM[4]: ADD R0, R1 (R1 = R0 + R1)
  ram[4] = encodeAluInstruction('ADD', 'R0', 'R1');
  // RAM[5..6]: DATA R0, 14 (the destination address for STORE)
  ram[5] = encodeDataInstruction('R0');
  ram[6] = PROGRAM_DEMO_RESULT_ADDRESS;
  // RAM[7]: STORE R0, R1 (RAM[R0] = R1)
  ram[7] = encodeLoadStore('STORE', 'R0', 'R1');

  return { ...s, ram };
}

/** Total bytes consumed by the demo program. */
export const PROGRAM_DEMO_LENGTH = 8;
