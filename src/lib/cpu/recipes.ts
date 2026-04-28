/**
 * cpu/recipes — per-instruction step-action recipes.
 *
 * Built for lesson 19 (the control section) and reused by lessons 20+ (the
 * instruction cycle and the individual instruction families). Each recipe
 * is a 7-element array: one action list per stepper step. Actions are small
 * labelled chips; their `kind` controls styling.
 *
 * Steps 1-3 are the FETCH phase, identical across every instruction:
 *   1: enable IAR; set MAR; ALU=ADD+1; set ACC   (read IAR into MAR; IAR+1 into ACC)
 *   2: enable RAM; set IR                        (load instruction byte from RAM)
 *   3: enable ACC; set IAR                       (advance IAR for next time)
 *
 * Steps 4-6 are the EXECUTE phase, varying per instruction.
 * Step 7 is RESET — clears the stepper, ready for the next instruction.
 */

export type ActionKind = 'enable' | 'set' | 'alu' | 'misc';

export interface Action {
  kind: ActionKind;
  /** Short label rendered on the chip, e.g. "IAR" or "ADD +1". */
  label: string;
}

export interface Recipe {
  /** Stable key. */
  key: string;
  /** Human-readable name shown on the selector chip. */
  name: string;
  /** One-line description of what the instruction does. */
  blurb: string;
  /** Action list per step. Always length 7 (steps 1..7, indexed 0..6). */
  steps: Action[][];
}

const FETCH: Action[][] = [
  // Step 1
  [
    { kind: 'enable', label: 'IAR' },
    { kind: 'set', label: 'MAR' },
    { kind: 'alu', label: 'ADD +1' },
    { kind: 'set', label: 'ACC' },
  ],
  // Step 2
  [
    { kind: 'enable', label: 'RAM' },
    { kind: 'set', label: 'IR' },
  ],
  // Step 3
  [
    { kind: 'enable', label: 'ACC' },
    { kind: 'set', label: 'IAR' },
  ],
];

const RESET: Action[] = [{ kind: 'misc', label: 'reset stepper' }];

export const RECIPES: readonly Recipe[] = [
  {
    key: 'add',
    name: 'ADD R2, R3',
    blurb: 'Add R2 and R3, store the sum in R3.',
    steps: [
      ...FETCH,
      // Step 4: route R2 into TMP (the ALU's "B" input).
      [
        { kind: 'enable', label: 'R2' },
        { kind: 'set', label: 'TMP' },
      ],
      // Step 5: route R3 into the ALU's "A" input, ALU=ADD, capture sum in ACC.
      [
        { kind: 'enable', label: 'R3' },
        { kind: 'alu', label: 'ADD' },
        { kind: 'set', label: 'ACC' },
      ],
      // Step 6: copy ACC back into R3.
      [
        { kind: 'enable', label: 'ACC' },
        { kind: 'set', label: 'R3' },
      ],
      RESET,
    ],
  },
  {
    key: 'load',
    name: 'LOAD R0, R1',
    blurb: 'Read the byte at RAM address R0 into register R1.',
    steps: [
      ...FETCH,
      // Step 4: R0 holds the address — route it to MAR.
      [
        { kind: 'enable', label: 'R0' },
        { kind: 'set', label: 'MAR' },
      ],
      // Step 5: read RAM[MAR] into R1.
      [
        { kind: 'enable', label: 'RAM' },
        { kind: 'set', label: 'R1' },
      ],
      // Step 6: nothing — LOAD is done in two execute steps.
      [],
      RESET,
    ],
  },
  {
    key: 'jmpr',
    name: 'JMPR R0',
    blurb: 'Jump to the address held in R0.',
    steps: [
      ...FETCH,
      // Step 4: write R0 directly into IAR.
      [
        { kind: 'enable', label: 'R0' },
        { kind: 'set', label: 'IAR' },
      ],
      // Steps 5-6: nothing.
      [],
      [],
      RESET,
    ],
  },
] as const;

export const STEP_PHASES: readonly string[] = [
  'fetch',
  'fetch',
  'fetch',
  'execute',
  'execute',
  'execute',
  'reset',
] as const;

export function findRecipe(key: string): Recipe {
  const r = RECIPES.find((x) => x.key === key);
  if (!r) throw new Error(`No recipe for key: ${key}`);
  return r;
}
