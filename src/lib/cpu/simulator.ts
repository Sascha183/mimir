import type { Action } from './recipes';
import type { CpuState, FlagRegister, RegisterName } from './types';
import { REGISTER_NAMES, RAM_SIZE } from './types';
import type { Bit } from '../gates/types';

/**
 * CPU step simulator.
 *
 * `executeStep(state, actions)` advances the CPU through one stepper step.
 * The actions come from `recipes.ts`; the simulator's job is to interpret
 * them and produce the next state.
 *
 * Order of operations within one step (matches the hardware):
 *   1. Determine bus value: whichever action has kind='enable' supplies it.
 *      'enable RAM' reads RAM[MAR]. With no enable action, the bus has no
 *      driver — represented as bus.value = null.
 *   2. Compute ALU output: if any 'alu' action is present, run the op on
 *      (bus, TMP). Otherwise the ALU's snapshot output stays as ACC's
 *      pre-step value (it's combinational and always computing, but we
 *      only update the snapshot when it matters).
 *   3. Apply 'set' actions: each captures a value into its register.
 *      Special case: 'set ACC' captures ALU output if there was an ALU
 *      action; otherwise captures bus. 'set RAM' writes the bus into
 *      RAM[MAR].
 *   4. Advance the stepper modulo 7.
 *
 * Reads to RAM[MAR] use the post-step MAR if MAR is being set this step.
 * In practice this matches Scott's design: in fetch step 1, MAR is set
 * from the bus; the RAM read happens in step 2, after MAR has settled.
 */

export function executeStep(state: CpuState, actions: readonly Action[]): CpuState {
  // Phase 1: bus.
  let busValue: number | null = null;
  let busSource: string | null = null;
  const enableActions = actions.filter((a) => a.kind === 'enable');
  if (enableActions.length === 1) {
    const target = enableActions[0].label;
    busSource = target;
    if (target === 'RAM') {
      const addr = state.registers.MAR;
      busValue = state.ram[addr % RAM_SIZE] ?? 0;
    } else if (isRegisterName(target)) {
      busValue = state.registers[target];
    } else {
      busValue = 0;
    }
  } else if (enableActions.length > 1) {
    // Conflict — bus would be garbage. Recipes never produce this; assert in tests.
    busValue = 0xff;
    busSource = 'CONFLICT';
  }

  // Phase 2: ALU.
  const aluAction = actions.find((a) => a.kind === 'alu');
  let aluOutput = state.alu.output;
  let aluOp: string | null = null;
  let aluFlagsOutput: FlagRegister = state.alu.flagsOutput;
  if (aluAction) {
    aluOp = aluAction.label;
    aluOutput = computeAlu(busValue ?? 0, state.registers.TMP, aluAction.label);
    aluFlagsOutput = computeAluFlags(
      busValue ?? 0,
      state.registers.TMP,
      aluAction.label,
      aluOutput,
    );
  }

  // Phase 3: apply set actions and flag updates.
  const newRegisters: Record<RegisterName, number> = { ...state.registers };
  let newRam = state.ram;
  let newFlags: FlagRegister = state.flags;
  for (const a of actions) {
    // Special action: misc "clear FLAGS" zeros the flag register.
    if (a.kind === 'misc' && a.label === 'clear FLAGS') {
      newFlags = { carry: 0, aLarger: 0, equal: 0, zero: 0 };
      continue;
    }
    if (a.kind !== 'set') continue;
    const target = a.label;
    // Special target: FLAGS captures the ALU's flag outputs.
    if (target === 'FLAGS') {
      newFlags = aluFlagsOutput;
      continue;
    }
    if (target === 'RAM') {
      const addr = newRegisters.MAR;
      if (busValue === null) continue; // shouldn't happen for set RAM
      newRam = newRam.slice();
      newRam[addr % RAM_SIZE] = busValue & 0xff;
    } else if (isRegisterName(target)) {
      let captured: number;
      if (target === 'ACC' && aluAction) {
        captured = aluOutput & 0xff;
      } else if (busValue !== null) {
        captured = busValue & 0xff;
      } else {
        // No bus driver and not capturing ALU — leave register alone.
        continue;
      }
      newRegisters[target] = captured;
    }
  }

  // Phase 4: advance stepper.
  const stepIdx = (state.stepIdx + 1) % 7;

  return {
    registers: newRegisters,
    ram: newRam,
    stepIdx,
    bus: { value: busValue, source: busSource },
    alu: { op: aluOp, output: aluOutput, flagsOutput: aluFlagsOutput },
    flags: newFlags,
  };
}

function computeAluFlags(
  a: number,
  b: number,
  op: string,
  output: number,
): FlagRegister {
  const A = a & 0xff;
  const B = b & 0xff;
  let carry: Bit = 0;
  let aLarger: Bit = 0;
  let equal: Bit = 0;
  if (op === 'ADD' || op === 'ADD +1') {
    const sum = op === 'ADD +1' ? A + 1 : A + B;
    carry = sum > 255 ? 1 : 0;
  }
  if (op === 'CMP') {
    aLarger = A > B ? 1 : 0;
    equal = A === B ? 1 : 0;
  }
  const zero: Bit = (output & 0xff) === 0 ? 1 : 0;
  return { carry, aLarger, equal, zero };
}

function isRegisterName(s: string): s is RegisterName {
  return (REGISTER_NAMES as readonly string[]).includes(s);
}

function computeAlu(a: number, b: number, op: string): number {
  // Restrict inputs to bytes.
  const A = a & 0xff;
  const B = b & 0xff;
  switch (op) {
    case 'ADD':
      return (A + B) & 0xff;
    case 'ADD +1':
      // Used in fetch step 1: increment whatever's on the bus.
      return (A + 1) & 0xff;
    case 'SHR':
      return A >> 1;
    case 'SHL':
      return (A << 1) & 0xff;
    case 'NOT':
      return ~A & 0xff;
    case 'AND':
      return A & B;
    case 'OR':
      return A | B;
    case 'XOR':
      return A ^ B;
    case 'CMP':
      // CMP doesn't produce a meaningful byte (flags only); return 0.
      return 0;
    default:
      return 0;
  }
}

/**
 * Build an empty CPU state. Used as a starting point; specific instruction
 * demos override registers/RAM in `instructions.ts`.
 */
export function emptyState(): CpuState {
  const registers = {} as Record<RegisterName, number>;
  for (const name of REGISTER_NAMES) registers[name] = 0;
  const zeroFlags: FlagRegister = { carry: 0, aLarger: 0, equal: 0, zero: 0 };
  return {
    registers,
    ram: Array(RAM_SIZE).fill(0),
    stepIdx: 0,
    bus: { value: null, source: null },
    alu: { op: null, output: 0, flagsOutput: zeroFlags },
    flags: zeroFlags,
  };
}
