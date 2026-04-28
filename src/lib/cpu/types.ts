/**
 * CPU state types — the data layer for lesson 20+ visualizations.
 *
 * `CpuState` is a snapshot of the entire visible CPU at one moment: every
 * register, the visible window of RAM, the stepper position, and a
 * bus/ALU snapshot for visualization.
 *
 * Register values are stored as plain numbers (0..255) rather than bit
 * arrays — keeps the simulator readable. The visual components convert
 * to binary when they need to.
 */

export type RegisterName =
  | 'IAR'
  | 'MAR'
  | 'IR'
  | 'TMP'
  | 'ACC'
  | 'R0'
  | 'R1'
  | 'R2'
  | 'R3';

export const REGISTER_NAMES: readonly RegisterName[] = [
  'IAR',
  'MAR',
  'IR',
  'TMP',
  'ACC',
  'R0',
  'R1',
  'R2',
  'R3',
] as const;

export const RAM_SIZE = 16; // visible window — full CPU has 256 but we only display 16

import type { Bit } from '../gates/types';

export interface CpuState {
  /** Register values, keyed by name. All 0..255. */
  registers: Record<RegisterName, number>;
  /** RAM window — RAM_SIZE bytes. */
  ram: number[];
  /** Stepper position, 0..6. */
  stepIdx: number;
  /** Snapshot of the bus during the most recent step. */
  bus: BusSnapshot;
  /** Snapshot of the ALU during the most recent step. */
  alu: AluSnapshot;
  /** The flag register — 4 bits set by ALU instructions, read by JCAEZ. */
  flags: FlagRegister;
}

export interface FlagRegister {
  carry: Bit;
  aLarger: Bit;
  equal: Bit;
  zero: Bit;
}

export interface BusSnapshot {
  /** What's currently being driven onto the bus, or null if no driver. */
  value: number | null;
  /** Which register/source is driving the bus. */
  source: string | null;
}

export interface AluSnapshot {
  /** The ALU's currently-selected op (e.g., "ADD", "ADD +1"), or null. */
  op: string | null;
  /** The ALU's output value (computed from bus + TMP). */
  output: number;
  /** What the ALU is currently computing on its flag-output pins. The flag
   *  register only captures these when a `setFlags` action fires. */
  flagsOutput: FlagRegister;
}
