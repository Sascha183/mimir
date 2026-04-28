import { encodeAluInstruction } from './alu-instructions';
import { encodeDataInstruction } from './data-instruction';
import { encodeJmp } from './jump-instructions';
import { encodeJcaez } from './conditional-jump';
import { emptyState } from './simulator';
import type { CpuState } from './types';

/**
 * Conditional-jump demo programs for lesson 25.
 *
 * All three programs run the same code: find the larger of R0 and R1,
 * leave it in R3. The only difference is the initial values of R0 and
 * R1 baked into the DATA instructions, so the user can see the JA branch
 * take both paths (and the equal-case where neither path's "if larger"
 * fires, which exercises the "fall through" branch).
 *
 * Important convention: this CPU's "A larger" flag means "the value on the
 * main bus is larger than the value in TMP." For CMP RA, RB the recipe puts
 * RA into TMP (step 4) and RB on the bus (step 5), so `A larger` is set
 * when RB > RA. JA after CMP R0, R1 therefore branches when R1 > R0.
 *
 * Pseudocode:
 *   R3 = 0
 *   R0 = <a>
 *   R1 = <b>
 *   CMP R0, R1     ; sets aLarger flag iff R1 > R0
 *   JA  >>resR1    ; if R1 > R0, jump to "result is R1"
 *   ADD R0, R3     ; fall-through (R0 >= R1): R3 = R0
 *   JMP >>end
 * resR1:
 *   ADD R1, R3     ; R3 = R1
 * end:
 */

export interface ConditionalProgram {
  key: string;
  name: string;
  description: string;
  programLength: number;
  /** Expected value of R3 after the program completes. */
  expectedR3: number;
  build: () => CpuState;
}

function buildLargerProgram(a: number, b: number): CpuState {
  const s = emptyState();
  const ram = s.ram.slice();
  // 0..1 : DATA R3, 0
  ram[0] = encodeDataInstruction('R3');
  ram[1] = 0;
  // 2..3 : DATA R0, <a>
  ram[2] = encodeDataInstruction('R0');
  ram[3] = a;
  // 4..5 : DATA R1, <b>
  ram[4] = encodeDataInstruction('R1');
  ram[5] = b;
  // 6    : CMP R0, R1
  ram[6] = encodeAluInstruction('CMP', 'R0', 'R1');
  // 7..8 : JA 12 (if R1 > R0, jump to "result is R1" branch at addr 12)
  ram[7] = encodeJcaez(false, true, false, false);
  ram[8] = 12;
  // 9    : ADD R0, R3 (fall-through: R0 was larger or equal; R3 = R0)
  ram[9] = encodeAluInstruction('ADD', 'R0', 'R3');
  // 10..11: JMP 13 (skip past the R1 branch)
  ram[10] = encodeJmp();
  ram[11] = 13;
  // 12   : ADD R1, R3 (then branch: R3 = R1)
  ram[12] = encodeAluInstruction('ADD', 'R1', 'R3');
  // 13   : end
  return { ...s, ram };
}

export const CONDITIONAL_PROGRAMS: readonly ConditionalProgram[] = [
  {
    key: 'r0-larger',
    name: 'R0 > R1 (7 vs 4)',
    description:
      'R0 holds 7, R1 holds 4. CMP R0,R1 leaves the A larger flag at 0 (because A larger means "bus > TMP" = "R1 > R0"); JA does NOT branch; the program falls through to the "result is R0" path.',
    programLength: 13,
    expectedR3: 7,
    build: () => buildLargerProgram(7, 4),
  },
  {
    key: 'r1-larger',
    name: 'R1 > R0 (4 vs 7)',
    description:
      'R0 holds 4, R1 holds 7. CMP R0,R1 sets the A larger flag (R1 > R0); JA branches to the "result is R1" path.',
    programLength: 13,
    expectedR3: 7,
    build: () => buildLargerProgram(4, 7),
  },
  {
    key: 'equal',
    name: 'R0 = R1 (5 vs 5)',
    description:
      'R0 and R1 both hold 5. CMP sets the Equal flag, NOT the A larger flag; JA does not branch; either value works as the "larger" so the fall-through (R3 = R0) is fine.',
    programLength: 13,
    expectedR3: 5,
    build: () => buildLargerProgram(5, 5),
  },
] as const;

export function findConditionalProgram(key: string): ConditionalProgram {
  const p = CONDITIONAL_PROGRAMS.find((x) => x.key === key);
  if (!p) throw new Error(`No conditional program: ${key}`);
  return p;
}
