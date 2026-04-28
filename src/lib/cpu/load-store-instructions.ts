import type { Action, Recipe } from './recipes';
import { emptyState } from './simulator';
import type { CpuState, RegisterName } from './types';
import type { InstructionPreset } from './instructions';
import type { AluReg } from './alu-instructions';
import { ALU_REGS } from './alu-instructions';

/**
 * LOAD / STORE instruction builders for lesson 22.
 *
 * Both instructions move a single byte between RAM and a CPU register. The
 * difference is direction:
 *   LOAD  regA, regB:  regB ← RAM[regA]
 *   STORE regA, regB:  RAM[regA] ← regB
 *
 * Encoding (8 bits, MSB-first):
 *   bits 7-4: opcode (0000 = LOAD, 0001 = STORE)
 *   bits 3-2: regA (the address holder)
 *   bits 1-0: regB (the data source/destination)
 *
 * Both share the standard FETCH (steps 1-3) and step 7 reset. The execute
 * phase is just two steps:
 *   step 4: route regA into MAR (RAM now knows where to look)
 *   step 5: either read RAM into regB (LOAD) or write regB into RAM (STORE)
 *   step 6: empty
 */

export type LoadStoreOp = 'LOAD' | 'STORE';

export const LOAD_STORE_OPS: readonly LoadStoreOp[] = ['LOAD', 'STORE'] as const;

const OP_BLURBS: Record<LoadStoreOp, string> = {
  LOAD: 'read the byte at RAM[regA] into regB',
  STORE: 'write regB into RAM[regA]',
};

function regIndex(reg: AluReg): number {
  return Number(reg.slice(1));
}

export function encodeLoadStore(op: LoadStoreOp, regA: AluReg, regB: AluReg): number {
  const opcode = op === 'LOAD' ? 0b0000 : 0b0001;
  return ((opcode & 0b1111) << 4) | (regIndex(regA) << 2) | regIndex(regB);
}

export function decodeLoadStore(byte: number):
  | { op: LoadStoreOp; regA: AluReg; regB: AluReg }
  | null {
  const b = byte & 0xff;
  const opcodeNibble = (b >> 4) & 0b1111;
  if (opcodeNibble !== 0b0000 && opcodeNibble !== 0b0001) return null;
  const op: LoadStoreOp = opcodeNibble === 0b0000 ? 'LOAD' : 'STORE';
  const regA = ALU_REGS[(b >> 2) & 0b11];
  const regB = ALU_REGS[b & 0b11];
  return { op, regA, regB };
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

export function buildLoadStoreRecipe(
  op: LoadStoreOp,
  regA: AluReg,
  regB: AluReg,
): Recipe {
  const step4: Action[] = [
    { kind: 'enable', label: regA },
    { kind: 'set', label: 'MAR' },
  ];
  const step5: Action[] =
    op === 'LOAD'
      ? [
          { kind: 'enable', label: 'RAM' },
          { kind: 'set', label: regB },
        ]
      : [
          { kind: 'enable', label: regB },
          { kind: 'set', label: 'RAM' },
        ];
  return {
    key: `${op.toLowerCase()}-${regA}-${regB}`,
    name: `${op} ${regA}, ${regB}`,
    blurb: OP_BLURBS[op],
    steps: [...FETCH_STEPS, step4, step5, [], RESET_STEP],
  };
}

const LOAD_DEMO_ADDR = 7;
const LOAD_DEMO_VALUE = 99;
const STORE_DEMO_ADDR = 5;
const STORE_DEMO_VALUE = 42;

export function buildLoadStorePreset(
  op: LoadStoreOp,
  regA: AluReg,
  regB: AluReg,
): InstructionPreset {
  const byte = encodeLoadStore(op, regA, regB);
  const initialState: CpuState = (() => {
    const s = emptyState();
    const ram = s.ram.slice();
    ram[0] = byte;
    const registers = { ...s.registers } as Record<RegisterName, number>;

    if (op === 'LOAD') {
      ram[LOAD_DEMO_ADDR] = LOAD_DEMO_VALUE;
      registers[regA] = LOAD_DEMO_ADDR;
      // regB starts at 0 — we'll see it overwritten with LOAD_DEMO_VALUE.
      // If regA === regB, the address-set above wins on initial load; the
      // cycle's set will overwrite anyway.
      if (regB !== regA) registers[regB] = 0;
    } else {
      // STORE
      registers[regA] = STORE_DEMO_ADDR;
      if (regB !== regA) registers[regB] = STORE_DEMO_VALUE;
      // If regA === regB, the same register holds both the address and the data.
      // Storing R0 to RAM[R0] writes R0's value to RAM[R0's value]. Self-store
      // is a real edge case in real CPUs; we let it run honestly.
    }

    return { ...s, ram, registers };
  })();

  const expected =
    op === 'LOAD'
      ? regA === regB
        ? `When regA === regB, the address holder is also the destination. After the cycle, ${regB} = RAM[${LOAD_DEMO_ADDR}] = ${LOAD_DEMO_VALUE}.`
        : `After the cycle, ${regB} = ${LOAD_DEMO_VALUE} (read from RAM[${LOAD_DEMO_ADDR}]).`
      : regA === regB
        ? `When regA === regB, the same register holds both the address and the data. After the cycle, RAM[${STORE_DEMO_ADDR}] = ${STORE_DEMO_ADDR} (regA's own value).`
        : `After the cycle, RAM[${STORE_DEMO_ADDR}] = ${STORE_DEMO_VALUE} (regB's contents written into RAM).`;

  const setup =
    op === 'LOAD'
      ? `${regA} holds the address ${LOAD_DEMO_ADDR}. RAM[${LOAD_DEMO_ADDR}] holds ${LOAD_DEMO_VALUE}. The instruction byte at RAM[0] encodes ${op} ${regA}, ${regB}.`
      : `${regA} holds the address ${STORE_DEMO_ADDR}. ${regB === regA ? '' : `${regB} holds the data ${STORE_DEMO_VALUE}. `}The instruction byte at RAM[0] encodes ${op} ${regA}, ${regB}.`;

  return { key: `${op.toLowerCase()}-${regA}-${regB}`, initialState, setup, expected };
}
