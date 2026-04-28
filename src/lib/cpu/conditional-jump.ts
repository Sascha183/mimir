import type { Action, Recipe } from './recipes';
import type { FlagRegister } from './types';

/**
 * Conditional jump (JCAEZ) and clear-flags (CLF) instructions for lesson 25.
 *
 * JCAEZ format (2 bytes):
 *   bits 7-4: 0101 (conditional jump opcode)
 *   bits 3-0: CAEZ — condition mask. Bit 3 = Carry, bit 2 = A larger,
 *             bit 1 = Equal, bit 0 = Zero. The instruction jumps if ANY
 *             of the masked-on flags are currently 1; otherwise it skips
 *             past the address byte and continues with the next instruction.
 *   followed by an address byte (the destination).
 *
 * CLF format (1 byte):
 *   0110_0000. No operand. Zeros the flag register.
 */

export type FlagBit = 'C' | 'A' | 'E' | 'Z';

export const FLAG_BITS: readonly FlagBit[] = ['C', 'A', 'E', 'Z'] as const;

export function encodeJcaez(c: boolean, a: boolean, e: boolean, z: boolean): number {
  return (
    0b01010000 |
    ((c ? 1 : 0) << 3) |
    ((a ? 1 : 0) << 2) |
    ((e ? 1 : 0) << 1) |
    (z ? 1 : 0)
  );
}

export interface DecodedJcaez {
  c: boolean;
  a: boolean;
  e: boolean;
  z: boolean;
  /** Single-character mnemonic suffix (e.g. "JA" or "JCAEZ"). */
  mnemonic: string;
}

export function decodeJcaez(byte: number): DecodedJcaez | null {
  const b = byte & 0xff;
  if ((b & 0b11110000) !== 0b01010000) return null;
  const c = (b & 0b1000) !== 0;
  const a = (b & 0b0100) !== 0;
  const e = (b & 0b0010) !== 0;
  const z = (b & 0b0001) !== 0;
  const flagsOn: FlagBit[] = [];
  if (c) flagsOn.push('C');
  if (a) flagsOn.push('A');
  if (e) flagsOn.push('E');
  if (z) flagsOn.push('Z');
  // No-flag JCAEZ (mask = 0000) never jumps. Render it as "JCAEZ" with no
  // suffix; leave the user to puzzle over what it means.
  const mnemonic = flagsOn.length === 0 ? 'JCAEZ' : `J${flagsOn.join('')}`;
  return { c, a, e, z, mnemonic };
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

/**
 * Build the JCAEZ recipe given the condition mask and the *current* flag
 * register contents. The recipe's step 5 picks one of two action lists
 * depending on whether the masked condition is met.
 */
export function buildJcaezRecipe(
  decoded: DecodedJcaez,
  flags: FlagRegister,
): Recipe {
  const conditionMet =
    (decoded.c && flags.carry === 1) ||
    (decoded.a && flags.aLarger === 1) ||
    (decoded.e && flags.equal === 1) ||
    (decoded.z && flags.zero === 1);

  return {
    key: `jcaez-${decoded.mnemonic}-${conditionMet ? 'jump' : 'skip'}`,
    name: `${decoded.mnemonic} (${conditionMet ? 'jump' : 'skip'})`,
    blurb: conditionMet
      ? `condition met (${decoded.mnemonic}) — jump to the address in the next RAM byte`
      : `condition not met — skip past the address byte and continue`,
    steps: [
      ...FETCH_STEPS,
      // Step 4: prepare both possible IAR sources.
      // MAR = IAR (so RAM is pointing at the address byte).
      // ACC = IAR + 1 (so we have the "skip past data byte" value ready).
      [
        { kind: 'enable', label: 'IAR' },
        { kind: 'set', label: 'MAR' },
        { kind: 'alu', label: 'ADD +1' },
        { kind: 'set', label: 'ACC' },
      ],
      // Step 5: pick a source for IAR.
      conditionMet
        ? [
            { kind: 'enable', label: 'RAM' },
            { kind: 'set', label: 'IAR' },
          ]
        : [
            { kind: 'enable', label: 'ACC' },
            { kind: 'set', label: 'IAR' },
          ],
      // Step 6: empty.
      [],
      RESET_STEP,
    ],
  };
}

export const CLF_BYTE = 0b01100000;

export function encodeClf(): number {
  return CLF_BYTE;
}

export function decodeClf(byte: number): true | null {
  return ((byte >> 4) & 0b1111) === 0b0110 ? true : null;
}

export function buildClfRecipe(): Recipe {
  return {
    key: 'clf',
    name: 'CLF',
    blurb: 'zero the flag register',
    steps: [
      ...FETCH_STEPS,
      // Step 4: clear the flag register. No bus activity needed.
      [{ kind: 'misc', label: 'clear FLAGS' }],
      [],
      [],
      RESET_STEP,
    ],
  };
}
