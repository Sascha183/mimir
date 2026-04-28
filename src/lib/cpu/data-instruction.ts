import type { Action, Recipe } from './recipes';
import { ALU_REGS, type AluReg } from './alu-instructions';

/**
 * DATA instruction (lesson 23).
 *
 * DATA is the *only* two-byte instruction in this CPU. The first byte is
 * the opcode (which destination register?). The second byte — sitting at
 * RAM[IAR] right after the opcode — is the literal value to load.
 *
 * Encoding (8 bits, MSB-first):
 *   bits 7-4: 0010 (DATA opcode)
 *   bits 3-2: unused (always 0)
 *   bits 1-0: regB (destination register)
 *
 * The execute phase mirrors fetch: it does another IAR-pointed RAM read,
 * advancing IAR past the data byte so the next instruction cycle starts
 * cleanly.
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

export function encodeDataInstruction(regB: AluReg): number {
  return 0b00100000 | regIndex(regB);
}

export function decodeDataInstruction(byte: number): { regB: AluReg } | null {
  const b = byte & 0xff;
  if ((b & 0b11110000) !== 0b00100000) return null;
  const regB = ALU_REGS[b & 0b11];
  return { regB };
}

export function buildDataRecipe(regB: AluReg): Recipe {
  return {
    key: `data-${regB}`,
    name: `DATA ${regB}`,
    blurb: `load the byte at IAR+1 into ${regB}; bump IAR past the data byte`,
    steps: [
      ...FETCH_STEPS,
      // Step 4: do another IAR → MAR, IAR+1 → ACC. Same as fetch step 1.
      [
        { kind: 'enable', label: 'IAR' },
        { kind: 'set', label: 'MAR' },
        { kind: 'alu', label: 'ADD +1' },
        { kind: 'set', label: 'ACC' },
      ],
      // Step 5: read the data byte from RAM into regB.
      [
        { kind: 'enable', label: 'RAM' },
        { kind: 'set', label: regB },
      ],
      // Step 6: bump IAR again so the next cycle skips past the data byte.
      [
        { kind: 'enable', label: 'ACC' },
        { kind: 'set', label: 'IAR' },
      ],
      RESET_STEP,
    ],
  };
}
