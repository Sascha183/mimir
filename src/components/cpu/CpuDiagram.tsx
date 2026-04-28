import { useMemo } from 'react';
import {
  STEP_PHASES,
  type Action,
  type Recipe,
} from '../../lib/cpu/recipes';
import { REGISTER_NAMES } from '../../lib/cpu/types';
import type { CpuState, FlagRegister, RegisterName } from '../../lib/cpu/types';
import RegisterBox, { type RegisterBoxState } from './RegisterBox';
import Bus from './Bus';
import AluBox from './AluBox';
import RamPanel from './RamPanel';

/**
 * CpuDiagram — the visual half of every Module-3 lesson widget from L20 onward.
 *
 * Takes a `CpuState` (the simulator's source of truth) and a `Recipe` (so it
 * knows which actions are firing at the active step) and renders:
 *   - RAM, the bus
 *   - All 9 registers, color-coded by their action state
 *   - The ALU
 *   - A 7-cell stepper row
 *   - The active step's action chips
 *
 * Controls (Run/Step/Reset/picker) are intentionally NOT here — those are
 * owned by the parent lesson widget so each lesson can shape its own UX.
 */

interface Props {
  state: CpuState;
  recipe: Recipe;
}

const KIND_STYLES = {
  enable: 'border-emerald-500 bg-emerald-50 text-emerald-900',
  set: 'border-apple-blue bg-apple-blue/10 text-apple-blue',
  alu: 'border-purple-500 bg-purple-50 text-purple-900',
  misc: 'border-apple-border bg-apple-bg text-apple-text-secondary',
} as const;

const KIND_LEAD = {
  enable: 'enable',
  set: 'set',
  alu: 'ALU',
  misc: '',
} as const;

function isRegisterName(s: string): s is RegisterName {
  return (REGISTER_NAMES as readonly string[]).includes(s);
}

function deriveBoxStates(
  actions: readonly Action[],
): Record<RegisterName, RegisterBoxState> {
  const out = {} as Record<RegisterName, RegisterBoxState>;
  for (const name of REGISTER_NAMES) out[name] = 'idle';
  for (const a of actions) {
    if (a.kind === 'enable' && isRegisterName(a.label)) out[a.label] = 'enabled';
    if (a.kind === 'set' && isRegisterName(a.label)) out[a.label] = 'set';
  }
  return out;
}

export default function CpuDiagram({ state, recipe }: Props) {
  const currentActions = recipe.steps[state.stepIdx];
  const boxStates = useMemo(
    () => deriveBoxStates(currentActions),
    [currentActions],
  );

  return (
    <div className="space-y-4 rounded-xl border border-apple-border bg-white p-5">
      <RamPanel ram={state.ram} marAddress={state.registers.MAR} />

      <Bus bus={state.bus} />

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-apple-text-secondary">
            CPU control / data path
          </div>
          <div className="grid grid-cols-3 gap-2">
            <RegisterBox name="IAR" value={state.registers.IAR} state={boxStates.IAR} hint="next addr" />
            <RegisterBox name="MAR" value={state.registers.MAR} state={boxStates.MAR} hint="ram addr" />
            <RegisterBox name="IR" value={state.registers.IR} state={boxStates.IR} hint="instruction" />
            <RegisterBox name="TMP" value={state.registers.TMP} state={boxStates.TMP} hint="ALU input" />
            <RegisterBox name="ACC" value={state.registers.ACC} state={boxStates.ACC} hint="ALU output" />
          </div>
        </div>
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-apple-text-secondary">
            General-purpose registers
          </div>
          <div className="grid grid-cols-2 gap-2">
            <RegisterBox name="R0" value={state.registers.R0} state={boxStates.R0} />
            <RegisterBox name="R1" value={state.registers.R1} state={boxStates.R1} />
            <RegisterBox name="R2" value={state.registers.R2} state={boxStates.R2} />
            <RegisterBox name="R3" value={state.registers.R3} state={boxStates.R3} />
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[640px] gap-3 sm:grid-cols-[1fr_auto]">
        <AluBox alu={state.alu} tmpValue={state.registers.TMP} />
        <FlagBox flags={state.flags} />
      </div>

      <div>
        <div className="flex gap-1">
          {recipe.steps.map((_, i) => {
            const active = i === state.stepIdx;
            return (
              <div
                key={i}
                data-stepper-cell={i}
                data-active={active ? 'true' : 'false'}
                className={`flex-1 rounded-md border px-2 py-1 text-center font-mono text-xs ${
                  active
                    ? 'border-apple-blue bg-apple-blue text-white'
                    : 'border-apple-border bg-white text-apple-text-secondary'
                }`}
              >
                <div>{i + 1}</div>
                <div className="text-[9px] opacity-80">{STEP_PHASES[i]}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-md border border-apple-border bg-apple-bg/30 p-3" data-testid="active-actions">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-apple-text-secondary">
          Step {state.stepIdx + 1} actions
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {currentActions.length === 0 ? (
            <span className="text-xs italic text-apple-text-secondary">
              nothing — this step is unused by this instruction
            </span>
          ) : (
            currentActions.map((a, i) => (
              <span
                key={i}
                data-kind={a.kind}
                className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 font-mono text-xs ${KIND_STYLES[a.kind]}`}
              >
                {KIND_LEAD[a.kind] ? (
                  <span className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
                    {KIND_LEAD[a.kind]}
                  </span>
                ) : null}
                <span className="font-semibold">{a.label}</span>
              </span>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function FlagBox({ flags }: { flags: FlagRegister }) {
  return (
    <div
      data-testid="flag-register"
      className="rounded-lg border border-apple-border bg-white px-3 py-2"
    >
      <div className="text-[11px] font-semibold uppercase tracking-widest text-apple-text-secondary">
        FLAGS
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1">
        <FlagCell label="C" name="carry" on={flags.carry === 1} />
        <FlagCell label="A" name="aLarger" on={flags.aLarger === 1} />
        <FlagCell label="E" name="equal" on={flags.equal === 1} />
        <FlagCell label="Z" name="zero" on={flags.zero === 1} />
      </div>
    </div>
  );
}

function FlagCell({
  label,
  name,
  on,
}: {
  label: string;
  name: string;
  on: boolean;
}) {
  return (
    <div
      data-flag={name}
      data-on={on ? 'true' : 'false'}
      title={`${name}: ${on ? '1' : '0'}`}
      className={`flex h-8 w-10 flex-col items-center justify-center rounded-md border font-mono text-[10px] transition-colors duration-150 motion-reduce:transition-none ${
        on
          ? 'border-apple-blue bg-apple-blue text-white'
          : 'border-apple-border bg-white text-apple-text-secondary'
      }`}
    >
      <span className="text-[9px] opacity-70">{label}</span>
      <span className="text-xs font-semibold">{on ? '1' : '0'}</span>
    </div>
  );
}
