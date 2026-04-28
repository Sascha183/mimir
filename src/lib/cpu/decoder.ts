import type { Action, Recipe } from './recipes';
import {
  buildAluRecipe,
  decodeAluInstruction,
} from './alu-instructions';
import {
  buildLoadStoreRecipe,
  decodeLoadStore,
} from './load-store-instructions';
import {
  buildDataRecipe,
  decodeDataInstruction,
} from './data-instruction';
import {
  buildJmpRecipe,
  buildJmprRecipe,
  decodeJmp,
  decodeJmpr,
} from './jump-instructions';
import {
  buildClfRecipe,
  buildJcaezRecipe,
  decodeClf,
  decodeJcaez,
} from './conditional-jump';
import type { FlagRegister } from './types';

/**
 * Dynamic instruction decoding for lesson 23+.
 *
 * Single-instruction lessons (L20–22) build their recipe up front from the
 * picker and feed it to the simulator. A multi-instruction program runner
 * can't do that — IR changes between cycles, and the recipe must change with
 * it. This decoder takes the current IR byte and returns the right Recipe
 * to drive the next 7 steps.
 *
 * Unrecognised bytes (or IR=0 before any instruction has been fetched) get
 * a no-op recipe: standard fetch + empty execute + reset. The CPU still
 * advances; it just doesn't do anything during execute.
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

function buildNoopRecipe(byte: number): Recipe {
  return {
    key: `noop-${byte}`,
    name: byte === 0 ? '(no instruction)' : `unknown ${byte}`,
    blurb:
      byte === 0
        ? 'before any cycle has fetched, IR holds 0 — no execute action'
        : `byte ${byte} does not decode to a known instruction`,
    steps: [...FETCH_STEPS, [], [], [], RESET_STEP],
  };
}

export function buildRecipeForIR(ir: number, flags?: FlagRegister): Recipe {
  const aluD = decodeAluInstruction(ir);
  if (aluD) return buildAluRecipe(aluD.op, aluD.regA, aluD.regB);

  const lsD = decodeLoadStore(ir);
  if (lsD) return buildLoadStoreRecipe(lsD.op, lsD.regA, lsD.regB);

  const dataD = decodeDataInstruction(ir);
  if (dataD) return buildDataRecipe(dataD.regB);

  if (decodeJmp(ir)) return buildJmpRecipe();

  const jmprD = decodeJmpr(ir);
  if (jmprD) return buildJmprRecipe(jmprD.reg);

  const jcaezD = decodeJcaez(ir);
  if (jcaezD) {
    const flagsToUse: FlagRegister =
      flags ?? { carry: 0, aLarger: 0, equal: 0, zero: 0 };
    return buildJcaezRecipe(jcaezD, flagsToUse);
  }

  if (decodeClf(ir)) return buildClfRecipe();

  return buildNoopRecipe(ir);
}

interface DisassembledLine {
  /** Address in RAM where this instruction's first byte lives. */
  address: number;
  /** Number of bytes this instruction occupies (1 for most, 2 for DATA). */
  byteCount: number;
  /** Human-readable mnemonic, e.g. "DATA R0, 5" or "ADD R2, R3". */
  mnemonic: string;
}

/**
 * Walk RAM starting from `startAddress`, decoding bytes into instructions
 * until `endAddress` is reached. DATA instructions consume two bytes; all
 * others consume one. Unrecognised bytes are reported as `unknown N`.
 */
export function disassemble(
  ram: readonly number[],
  startAddress: number,
  endAddress: number,
): DisassembledLine[] {
  const out: DisassembledLine[] = [];
  let i = startAddress;
  while (i < endAddress && i < ram.length) {
    const byte = ram[i];
    const aluD = decodeAluInstruction(byte);
    if (aluD) {
      out.push({
        address: i,
        byteCount: 1,
        mnemonic: `${aluD.op} ${aluD.regA}, ${aluD.regB}`,
      });
      i += 1;
      continue;
    }
    const lsD = decodeLoadStore(byte);
    if (lsD) {
      out.push({
        address: i,
        byteCount: 1,
        mnemonic: `${lsD.op} ${lsD.regA}, ${lsD.regB}`,
      });
      i += 1;
      continue;
    }
    const dataD = decodeDataInstruction(byte);
    if (dataD) {
      const literal = ram[i + 1] ?? 0;
      out.push({
        address: i,
        byteCount: 2,
        mnemonic: `DATA ${dataD.regB}, ${literal}`,
      });
      i += 2;
      continue;
    }
    if (decodeJmp(byte)) {
      const dest = ram[i + 1] ?? 0;
      out.push({
        address: i,
        byteCount: 2,
        mnemonic: `JMP ${dest}`,
      });
      i += 2;
      continue;
    }
    const jmprD = decodeJmpr(byte);
    if (jmprD) {
      out.push({
        address: i,
        byteCount: 1,
        mnemonic: `JMPR ${jmprD.reg}`,
      });
      i += 1;
      continue;
    }
    const jcaezD = decodeJcaez(byte);
    if (jcaezD) {
      const dest = ram[i + 1] ?? 0;
      out.push({
        address: i,
        byteCount: 2,
        mnemonic: `${jcaezD.mnemonic} ${dest}`,
      });
      i += 2;
      continue;
    }
    if (decodeClf(byte)) {
      out.push({ address: i, byteCount: 1, mnemonic: 'CLF' });
      i += 1;
      continue;
    }
    if (byte === 0) {
      // Stop disassembling at the first 0 byte after the program — that's
      // unused RAM, not part of the program.
      break;
    }
    out.push({ address: i, byteCount: 1, mnemonic: `unknown ${byte}` });
    i += 1;
  }
  return out;
}
