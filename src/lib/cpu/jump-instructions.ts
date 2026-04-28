import type { Action, Recipe } from './recipes';
import { ALU_REGS, type AluReg } from './alu-instructions';

/**
 * JUMP instructions (lesson 24).
 *
 * Two forms:
 *   JMP <addr>:  0100_0000 followed by the destination address as a literal
 *                byte in RAM. Two bytes total. After execute, IAR holds the
 *                destination — the next fetch comes from there.
 *   JMPR regB:   0011_00_RB. One byte. After execute, IAR holds the value
 *                that was in regB.
 *
 * Both REPLACE IAR rather than incrementing it. That's what makes them jumps
 * — the linear progression of IAR is broken in favour of a value chosen by
 * the program.
 */

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

function regIndex(reg: AluReg): number {
  return Number(reg.slice(1));
}

export function encodeJmp(): number {
  // 0100_0000. The destination address is the *next* byte in RAM.
  return 0b01000000;
}

export function decodeJmp(byte: number): true | null {
  return ((byte >> 4) & 0b1111) === 0b0100 ? true : null;
}

export function encodeJmpr(reg: AluReg): number {
  return 0b00110000 | regIndex(reg);
}

export function decodeJmpr(byte: number): { reg: AluReg } | null {
  if (((byte >> 4) & 0b1111) !== 0b0011) return null;
  return { reg: ALU_REGS[byte & 0b11] };
}

export function buildJmpRecipe(): Recipe {
  return {
    key: 'jmp',
    name: 'JMP',
    blurb: 'jump to the address in the next RAM byte',
    steps: [
      ...FETCH_STEPS,
      // Step 4: After fetch, IAR points at the address byte (one past the
      // JMP opcode). Route IAR into MAR so RAM points at the address byte.
      [
        { kind: 'enable', label: 'IAR' },
        { kind: 'set', label: 'MAR' },
      ],
      // Step 5: read RAM[MAR] (the destination address) into IAR.
      [
        { kind: 'enable', label: 'RAM' },
        { kind: 'set', label: 'IAR' },
      ],
      // Step 6: empty. JMP completes in two execute steps.
      [],
      RESET_STEP,
    ],
  };
}

export function buildJmprRecipe(reg: AluReg): Recipe {
  return {
    key: `jmpr-${reg}`,
    name: `JMPR ${reg}`,
    blurb: `jump to the address held in ${reg}`,
    steps: [
      ...FETCH_STEPS,
      // Step 4: route reg directly into IAR.
      [
        { kind: 'enable', label: reg },
        { kind: 'set', label: 'IAR' },
      ],
      [],
      [],
      RESET_STEP,
    ],
  };
}
