import { useEffect, useRef, useState } from 'react';
import type { Bit } from '../lib/gates/types';
import InputSwitch from './gates/InputSwitch';

/**
 * TheBus — lesson-11 scene.
 *
 * Three registers (R0, R1, R2) all wired to a single shared 8-bit bus, plus
 * eight input switches that act as a permanent "input source" feeding the bus
 * whenever no register is enabled. Each register has:
 *   - Set: a momentary button. When pressed, the register captures whatever
 *     is currently on the bus into its stored byte.
 *   - Enable: a toggle. When on, the register drives its stored byte onto
 *     the bus.
 *
 * The whole point of the lesson is the bus protocol:
 *   - 0 enabled registers → bus carries the input switches (the always-on source).
 *   - 1 enabled register  → bus carries that register's stored byte.
 *   - 2+ enabled registers → CONFLICT. Bus is undefined; Set is blocked.
 *
 * The widget shows the bus as a single thick line (representing the bundle of
 * eight wires), and animates a quick highlight on the destination register
 * when Set is pressed so the data-flow direction is visceral.
 */

const STORAGE_KEY = 'hciw:the-bus:state';
const PULSE_MS = 380;
const REGISTER_COUNT = 3;
const ZERO_BYTE: Bit[] = [0, 0, 0, 0, 0, 0, 0, 0];

interface RegisterState {
  stored: Bit[];
  enabled: boolean;
}

interface PersistedState {
  inputs: Bit[];
  registers: RegisterState[];
}

function defaultRegister(): RegisterState {
  return { stored: [...ZERO_BYTE], enabled: false };
}

function defaultState(): PersistedState {
  return {
    inputs: [...ZERO_BYTE],
    registers: Array.from({ length: REGISTER_COUNT }, defaultRegister),
  };
}

function validateByte(arr: unknown): Bit[] | null {
  if (!Array.isArray(arr) || arr.length !== 8) return null;
  if (!arr.every((b) => b === 0 || b === 1)) return null;
  return arr as Bit[];
}

function loadState(): PersistedState {
  if (typeof window === 'undefined') return defaultState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    const inputs = validateByte(parsed.inputs) ?? [...ZERO_BYTE];
    const regs: RegisterState[] = Array.isArray(parsed.registers)
      ? parsed.registers.slice(0, REGISTER_COUNT).map((r) => {
          const stored = validateByte((r as RegisterState | undefined)?.stored);
          return {
            stored: stored ?? [...ZERO_BYTE],
            enabled: (r as RegisterState | undefined)?.enabled === true,
          };
        })
      : [];
    while (regs.length < REGISTER_COUNT) regs.push(defaultRegister());
    return { inputs, registers: regs };
  } catch {
    return defaultState();
  }
}

function bitsToNumber(bits: Bit[]): number {
  let n = 0;
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] === 1) n += 1 << i;
  }
  return n;
}

function bitsAsBinary(bits: Bit[]): string {
  const msbFirst = [...bits].reverse().join('');
  return `${msbFirst.slice(0, 4)} ${msbFirst.slice(4)}`;
}

type BusState =
  | { kind: 'value'; bits: Bit[]; sourceLabel: string }
  | { kind: 'conflict'; sources: string[] };

function computeBus(state: PersistedState): BusState {
  const enabled = state.registers
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.enabled);
  if (enabled.length >= 2) {
    return { kind: 'conflict', sources: enabled.map(({ i }) => `R${i}`) };
  }
  if (enabled.length === 1) {
    const { r, i } = enabled[0];
    return { kind: 'value', bits: r.stored, sourceLabel: `R${i}` };
  }
  return { kind: 'value', bits: state.inputs, sourceLabel: 'Inputs' };
}

const ROW_WIDTH = 596;
const REG_COL_WIDTH = ROW_WIDTH / REGISTER_COUNT; // ≈ 198.67
const REG_CENTER = (i: number) => REG_COL_WIDTH / 2 + i * REG_COL_WIDTH;
const INPUTS_DROP_X = ROW_WIDTH / 2;
const POSITIONS = [7, 6, 5, 4, 3, 2, 1, 0] as const;

const wireOff = 'rgb(var(--apple-text-secondary))';
const wireOn = 'rgb(var(--apple-blue))';
const wireConflict = '#dc2626';

export default function TheBus() {
  const [state, setState] = useState<PersistedState>(defaultState);
  const [hydrated, setHydrated] = useState(false);
  const [setPulseIdx, setSetPulseIdx] = useState<number | null>(null);
  const pulseTimer = useRef<number | null>(null);

  useEffect(() => {
    setState(loadState());
    setHydrated(true);
    return () => {
      if (pulseTimer.current !== null) window.clearTimeout(pulseTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // localStorage may be disabled — keep going.
    }
  }, [hydrated, state]);

  const bus = computeBus(state);
  const conflict = bus.kind === 'conflict';

  function setInputBit(i: number, v: Bit) {
    setState((prev) => ({
      ...prev,
      inputs: prev.inputs.map((b, j) => (j === i ? v : b)),
    }));
  }

  function toggleEnable(idx: number) {
    setState((prev) => ({
      ...prev,
      registers: prev.registers.map((r, j) =>
        j === idx ? { ...r, enabled: !r.enabled } : r,
      ),
    }));
  }

  function pulseSet(idx: number) {
    // Capture whatever's currently on the bus. Reads `state` via a functional
    // updater so it sees the freshest enable flags even if Enable was just
    // toggled in the same event batch.
    setState((prev) => {
      const nowBus = computeBus(prev);
      if (nowBus.kind !== 'value') return prev; // Set is blocked during conflict.
      return {
        ...prev,
        registers: prev.registers.map((r, j) =>
          j === idx ? { ...r, stored: [...nowBus.bits] } : r,
        ),
      };
    });

    if (pulseTimer.current !== null) window.clearTimeout(pulseTimer.current);
    setSetPulseIdx(idx);
    pulseTimer.current = window.setTimeout(() => {
      setSetPulseIdx(null);
      pulseTimer.current = null;
    }, PULSE_MS);
  }

  function reset() {
    if (pulseTimer.current !== null) {
      window.clearTimeout(pulseTimer.current);
      pulseTimer.current = null;
    }
    setSetPulseIdx(null);
    setState(defaultState());
  }

  const busBits = bus.kind === 'value' ? bus.bits : null;
  const busDecimal = busBits ? bitsToNumber(busBits) : null;
  const busBinary = busBits ? bitsAsBinary(busBits) : '— — — — — — — —';
  const busColor = conflict ? wireConflict : wireOn;

  return (
    <div className="not-prose mx-auto my-12 w-full max-w-[680px] text-apple-text">
      <div className="overflow-x-auto pb-1">
        <div className="mx-auto" style={{ width: ROW_WIDTH }}>
          {/* Inputs row. */}
          <div className="text-center text-xs font-semibold uppercase tracking-widest text-apple-text-secondary">
            Inputs (always feed the bus when no register is enabled)
          </div>
          <div
            className="mt-2 grid place-items-center"
            style={{
              gridTemplateColumns: `repeat(8, 64px)`,
              columnGap: `12px`,
            }}
          >
            {POSITIONS.map((pos) => (
              <div key={`in-${pos}`} className="flex flex-col items-center gap-1.5">
                <span className="font-mono text-[11px] text-apple-text-secondary">
                  bit {pos}
                </span>
                <InputSwitch
                  value={state.inputs[pos]}
                  onChange={(v) => setInputBit(pos, v)}
                  label={`Input bit ${pos}`}
                />
              </div>
            ))}
          </div>

          {/* Wire from inputs down to the bus. */}
          <svg
            viewBox={`0 0 ${ROW_WIDTH} 32`}
            width={ROW_WIDTH}
            height={32}
            className="mt-3 block"
            aria-hidden="true"
          >
            <line
              x1={INPUTS_DROP_X}
              y1={0}
              x2={INPUTS_DROP_X}
              y2={32}
              stroke={
                conflict
                  ? wireConflict
                  : bus.kind === 'value' && bus.sourceLabel === 'Inputs'
                    ? wireOn
                    : wireOff
              }
              strokeWidth={3}
              className="transition-colors duration-200 motion-reduce:transition-none"
            />
            <text
              x={INPUTS_DROP_X + 8}
              y={20}
              fontSize={11}
              style={{ fill: "rgb(var(--apple-text-secondary))" }}
              stroke="none"
            >
              inputs → bus
            </text>
          </svg>

          {/* The bus itself + per-register drops down to each register. */}
          <svg
            viewBox={`0 0 ${ROW_WIDTH} 70`}
            width={ROW_WIDTH}
            height={70}
            className="block"
            aria-hidden="true"
          >
            {/* Bus line — thick to suggest the bundle of 8 wires it represents. */}
            <line
              x1={REG_CENTER(0) - 30}
              y1={10}
              x2={REG_CENTER(REGISTER_COUNT - 1) + 30}
              y2={10}
              stroke={busColor}
              strokeWidth={5}
              strokeLinecap="round"
              className="transition-colors duration-200 motion-reduce:transition-none"
            />
            <text
              x={REG_CENTER(REGISTER_COUNT - 1) + 40}
              y={14}
              fontSize={12}
              fontWeight={600}
              style={{ fill: "rgb(var(--apple-text-secondary))" }}
              stroke="none"
            >
              bus
            </text>

            {state.registers.map((r, idx) => {
              const cx = REG_CENTER(idx);
              const isDriving = !conflict && bus.kind === 'value' && bus.sourceLabel === `R${idx}`;
              const isReceiving = setPulseIdx === idx;
              const stroke = conflict && r.enabled
                ? wireConflict
                : isDriving || isReceiving
                  ? wireOn
                  : wireOff;
              return (
                <g key={`drop-${idx}`}>
                  <line
                    x1={cx}
                    y1={10}
                    x2={cx}
                    y2={70}
                    stroke={stroke}
                    strokeWidth={3}
                    className="transition-colors duration-200 motion-reduce:transition-none"
                  />
                  {/* Junction dot where this register taps the bus. */}
                  <circle
                    cx={cx}
                    cy={10}
                    r={4}
                    fill={stroke}
                    className="transition-colors duration-200 motion-reduce:transition-none"
                  />
                </g>
              );
            })}
          </svg>

          {/* The three registers. */}
          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${REGISTER_COUNT}, 1fr)`,
            }}
          >
            {state.registers.map((r, idx) => (
              <RegisterBlock
                key={`reg-${idx}`}
                idx={idx}
                stored={r.stored}
                enabled={r.enabled}
                conflict={conflict}
                pulsing={setPulseIdx === idx}
                onSet={() => pulseSet(idx)}
                onToggleEnable={() => toggleEnable(idx)}
              />
            ))}
          </div>

          {/* Reset row. */}
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={reset}
              className="rounded-full border border-apple-border bg-apple-surface px-4 py-1.5 text-xs font-medium text-apple-text-secondary transition-colors duration-200 hover:text-apple-text focus:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue focus-visible:ring-offset-2 motion-reduce:transition-none"
            >
              Reset all
            </button>
          </div>
        </div>
      </div>

      {/* Bus readout. */}
      <div className="mt-8 text-center" aria-live="polite">
        {conflict ? (
          <div
            role="alert"
            className="mx-auto inline-block rounded-xl border border-red-300 bg-red-50 px-5 py-3 text-red-700"
          >
            <p className="text-[11px] font-semibold uppercase tracking-widest">
              Bus conflict
            </p>
            <p className="mt-1 text-base">
              {(bus as Extract<BusState, { kind: 'conflict' }>).sources.join(' and ')} are
              both driving the bus. Disable one before reading or writing.
            </p>
          </div>
        ) : (
          <div className="mx-auto inline-block rounded-xl border border-apple-border bg-apple-surface px-5 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-apple-text-secondary">
              Bus
            </p>
            <p className="mt-1">
              <output
                aria-label="bus as binary"
                className="font-mono text-xl font-semibold tracking-widest text-apple-text"
              >
                {busBinary}
              </output>
            </p>
            <p className="mt-0.5 text-sm text-apple-text-secondary">
              decimal{' '}
              <output
                aria-label="bus as number"
                className="font-medium text-apple-text"
              >
                {busDecimal ?? '—'}
              </output>
              {' '}— driven by{' '}
              <span className="font-medium text-apple-text">
                {bus.kind === 'value' ? bus.sourceLabel : '—'}
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function RegisterBlock({
  idx,
  stored,
  enabled,
  conflict,
  pulsing,
  onSet,
  onToggleEnable,
}: {
  idx: number;
  stored: Bit[];
  enabled: boolean;
  conflict: boolean;
  pulsing: boolean;
  onSet: () => void;
  onToggleEnable: () => void;
}) {
  const decimal = bitsToNumber(stored);
  return (
    <div
      className={`mx-1 flex flex-col items-center rounded-xl border bg-apple-surface px-3 py-3 transition-all duration-200 motion-reduce:transition-none ${
        pulsing ? 'border-apple-blue ring-2 ring-apple-blue ring-offset-2' : 'border-apple-border'
      }`}
    >
      <div className="mb-2 font-mono text-sm font-semibold text-apple-text">
        R{idx}
      </div>
      <div className="flex gap-0.5" aria-label={`R${idx} stored bits`}>
        {[7, 6, 5, 4, 3, 2, 1, 0].map((pos) => (
          <span
            key={pos}
            aria-hidden="true"
            className={`flex h-6 w-5 items-center justify-center rounded font-mono text-[11px] font-semibold transition-colors duration-200 motion-reduce:transition-none ${
              stored[pos] === 1
                ? 'bg-apple-blue text-white'
                : 'bg-apple-border/30 text-apple-text-secondary'
            }`}
          >
            {stored[pos]}
          </span>
        ))}
      </div>
      <div className="mt-1 text-[11px] text-apple-text-secondary">
        decimal{' '}
        <output aria-label={`R${idx} as number`} className="font-medium text-apple-text">
          {decimal}
        </output>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={onSet}
          aria-label={`Set R${idx} from the bus`}
          disabled={conflict}
          className={`rounded-md border px-3 py-1 text-xs font-semibold transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue focus-visible:ring-offset-2 motion-reduce:transition-none ${
            pulsing
              ? 'border-apple-blue bg-apple-blue text-white'
              : 'border-apple-border bg-apple-surface text-apple-text hover:border-apple-blue/40'
          } ${conflict ? 'cursor-not-allowed opacity-40' : ''}`}
        >
          Set
        </button>
        <div className="flex flex-col items-center gap-0.5">
          <InputSwitch
            value={enabled ? 1 : 0}
            onChange={onToggleEnable}
            label={`R${idx} enable`}
          />
        </div>
      </div>
    </div>
  );
}
