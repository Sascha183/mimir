import type { Action, Recipe } from './recipes';
import { emptyState } from './simulator';
import type { CpuState, RegisterName } from './types';
import type { InstructionPreset } from './instructions';

/**
 * ALU-instruction builders for lesson 21.
 *
 * Every ALU instruction has the same shape. Bit 7 is 1 (signals ALU
 * instruction); bits 6-4 select the op; bits 3-2 select register A; bits
 * 1-0 select register B. The execute phase is always:
 *   step 4: route regA into TMP
 *   step 5: route regB into the ALU's bus-side input, run op, capture in ACC
 *   step 6: copy ACC back into regB (skipped for CMP — flags only)
 *
 * The fetch phase and step 7 reset are shared with all other instructions
 * via the FETCH constant in recipes.ts.
 */

export type AluOp = 'ADD' | 'SHR' | 'SHL' | 'NOT' | 'AND' | 'OR' | 'XOR' | 'CMP';
export type AluReg = 'R0' | 'R1' | 'R2' | 'R3';

export const ALU_OPS: readonly AluOp[] = [
  'ADD',
  'SHR',
  'SHL',
  'NOT',
  'AND',
  'OR',
  'XOR',
  'CMP',
] as const;

export const ALU_REGS: readonly AluReg[] = ['R0', 'R1', 'R2', 'R3'] as const;

export const OP_BLURBS: Record<AluOp, string> = {
  ADD: 'add A and B',
  SHR: 'shift A right by 1',
  SHL: 'shift A left by 1',
  NOT: 'flip every bit of A',
  AND: 'bit-wise A and B',
  OR: 'bit-wise A or B',
  XOR: 'bit-wise A xor B',
  CMP: 'compare A and B (flags only — no writeback)',
};

function opIndex(op: AluOp): number {
  return ALU_OPS.indexOf(op);
}

function regIndex(reg: AluReg): number {
  return Number(reg.slice(1));
}

/**
 * Encode an ALU instruction as one byte.
 *   bit 7      : 1 (ALU flag)
 *   bits 6-4   : op-select (000..111)
 *   bits 3-2   : regA index (00..11)
 *   bits 1-0   : regB index (00..11)
 */
export function encodeAluInstruction(op: AluOp, regA: AluReg, regB: AluReg): number {
  return (
    0b10000000 |
    (opIndex(op) << 4) |
    (regIndex(regA) << 2) |
    regIndex(regB)
  );
}

export interface DecodedAluInstruction {
  op: AluOp;
  regA: AluReg;
  regB: AluReg;
}

export function decodeAluInstruction(byte: number): DecodedAluInstruction | null {
  const b = byte & 0xff;
  if ((b & 0b10000000) === 0) return null;
  const opI = (b >> 4) & 0b111;
  const aI = (b >> 2) & 0b11;
  const bI = b & 0b11;
  return {
    op: ALU_OPS[opI],
    regA: ALU_REGS[aI],
    regB: ALU_REGS[bI],
  };
}

const FETCH_STEPS: Action[][] = [
  [
    { kind: 'enable', label: 'IAR' },
    { kind: 'set', label: 'MAR' },
    { kind: 'alu', label: 'ADD +1' },
    { kind: 'set', label: 'ACC' },
  ],
  [
    { kind: 'enable', label: 'RAM' },
    { kind: 'set', label: 'IR' },
  ],
  [
    { kind: 'enable', label: 'ACC' },
    { kind: 'set', label: 'IAR' },
  ],
];

const RESET_STEP: Action[] = [{ kind: 'misc', label: 'reset stepper' }];

export function buildAluRecipe(op: AluOp, regA: AluReg, regB: AluReg): Recipe {
  const isCmp = op === 'CMP';
  return {
    key: `alu-${op}-${regA}-${regB}`,
    name: `${op} ${regA}, ${regB}`,
    blurb: OP_BLURBS[op],
    steps: [
      ...FETCH_STEPS,
      // Step 4
      [
        { kind: 'enable', label: regA },
        { kind: 'set', label: 'TMP' },
      ],
      // Step 5: ALU op runs; ACC captures the byte; the flag register
      // captures the ALU's flag outputs (carry/aLarger/equal/zero).
      [
        { kind: 'enable', label: regB },
        { kind: 'alu', label: op },
        { kind: 'set', label: 'ACC' },
        { kind: 'set', label: 'FLAGS' },
      ],
      // Step 6 (skipped for CMP — no writeback to regB; flags only)
      isCmp
        ? []
        : [
            { kind: 'enable', label: 'ACC' },
            { kind: 'set', label: regB },
          ],
      RESET_STEP,
    ],
  };
}

/**
 * Initial state for a demo run of an ALU instruction. Pre-loads regA and regB
 * with non-trivial values, drops the encoded instruction byte at RAM[0], and
 * clears IAR so fetch starts at the right place.
 */
export function buildAluPreset(op: AluOp, regA: AluReg, regB: AluReg): InstructionPreset {
  const byte = encodeAluInstruction(op, regA, regB);
  const initialState: CpuState = (() => {
    const s = emptyState();
    const ram = s.ram.slice();
    ram[0] = byte;
    const registers = { ...s.registers } as Record<RegisterName, number>;
    // Pre-load with values that make every op produce something visible.
    // Using two operands that are distinct, both non-zero, both small.
    registers.R0 = 12;
    registers.R1 = 5;
    registers.R2 = 9;
    registers.R3 = 3;
    // Override regA / regB if they collide; keep fixed presets above otherwise.
    return { ...s, ram, registers };
  })();
  return {
    key: `alu-${op}-${regA}-${regB}`,
    initialState,
    setup: `R0=12, R1=5, R2=9, R3=3. The instruction byte at RAM[0] encodes ${op} ${regA}, ${regB}.`,
    expected:
      op === 'CMP'
        ? `CMP doesn't write back to ${regB}. After the cycle, ${regB}'s value is unchanged; in a real CPU this instruction would set flag bits we'll meet in the conditional-jump lesson.`
        : `After one full cycle, ${regB} holds the result of ${op}.`,
  };
}
