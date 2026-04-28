import { useEffect, useMemo, useRef, useState } from 'react';
import { executeStep } from '../lib/cpu/simulator';
import {
  ALU_OPS,
  ALU_REGS,
  buildAluPreset,
  buildAluRecipe,
  encodeAluInstruction,
  type AluOp,
  type AluReg,
} from '../lib/cpu/alu-instructions';
import type { CpuState } from '../lib/cpu/types';
import CpuDiagram from './cpu/CpuDiagram';

/**
 * AluInstructionsCycle — lesson-21 scene.
 *
 * Lets the learner construct any of the 128 possible ALU instructions
 * (8 ops × 4 regA × 4 regB) by clicking three radio chip rows. The 8-bit
 * instruction byte and its format chunks are visualized below the picker.
 * Underneath is the same CPU diagram as L20, with a recipe and preset
 * generated on the fly from the picker's choices.
 */

const DEFAULT_RATE_MS = 1500;
const MIN_RATE_MS = 500;
const MAX_RATE_MS = 4000;
const STORAGE_KEY = 'hciw:alu-instructions:state';

interface PersistedState {
  rateMs: number;
  op: AluOp;
  regA: AluReg;
  regB: AluReg;
}

function defaultPersisted(): PersistedState {
  return { rateMs: DEFAULT_RATE_MS, op: 'ADD', regA: 'R2', regB: 'R3' };
}

function loadPersisted(): PersistedState {
  if (typeof window === 'undefined') return defaultPersisted();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPersisted();
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      rateMs:
        typeof parsed.rateMs === 'number' &&
        parsed.rateMs >= MIN_RATE_MS &&
        parsed.rateMs <= MAX_RATE_MS
          ? Math.round(parsed.rateMs)
          : DEFAULT_RATE_MS,
      op: ALU_OPS.includes(parsed.op as AluOp) ? (parsed.op as AluOp) : 'ADD',
      regA: ALU_REGS.includes(parsed.regA as AluReg) ? (parsed.regA as AluReg) : 'R2',
      regB: ALU_REGS.includes(parsed.regB as AluReg) ? (parsed.regB as AluReg) : 'R3',
    };
  } catch {
    return defaultPersisted();
  }
}

export default function AluInstructionsCycle() {
  const [op, setOp] = useState<AluOp>('ADD');
  const [regA, setRegA] = useState<AluReg>('R2');
  const [regB, setRegB] = useState<AluReg>('R3');
  const [rateMs, setRateMs] = useState(DEFAULT_RATE_MS);
  const [running, setRunning] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const intervalRef = useRef<number | null>(null);

  const recipe = useMemo(() => buildAluRecipe(op, regA, regB), [op, regA, regB]);
  const preset = useMemo(() => buildAluPreset(op, regA, regB), [op, regA, regB]);
  const byte = useMemo(() => encodeAluInstruction(op, regA, regB), [op, regA, regB]);

  const [cpuState, setCpuState] = useState<CpuState>(() => preset.initialState);

  // Hydrate from localStorage.
  useEffect(() => {
    const loaded = loadPersisted();
    setOp(loaded.op);
    setRegA(loaded.regA);
    setRegB(loaded.regB);
    setRateMs(loaded.rateMs);
    setHydrated(true);
  }, []);

  // When picker changes, reset the simulator to the new preset's initial state.
  useEffect(() => {
    setRunning(false);
    setCpuState(preset.initialState);
  }, [preset]);

  // Persist.
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ rateMs, op, regA, regB }),
      );
    } catch {
      // ignore
    }
  }, [hydrated, rateMs, op, regA, regB]);

  // Run interval.
  useEffect(() => {
    if (!running) {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    intervalRef.current = window.setInterval(() => {
      setCpuState((prev) => executeStep(prev, recipe.steps[prev.stepIdx]));
    }, rateMs);
    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [running, rateMs, recipe]);

  function step() {
    setCpuState((prev) => executeStep(prev, recipe.steps[prev.stepIdx]));
  }
  function toggleRun() {
    setRunning((r) => !r);
  }
  function reset() {
    setRunning(false);
    setCpuState(preset.initialState);
  }

  return (
    <div className="not-prose mx-auto my-12 w-full max-w-[860px] text-apple-text">
      {/* Picker */}
      <div className="rounded-xl border border-apple-border bg-white p-4">
        <div className="text-center text-xs font-semibold uppercase tracking-widest text-apple-text-secondary">
          Build an ALU instruction
        </div>

        <PickerRow
          label="op"
          options={ALU_OPS}
          value={op}
          onChange={(v) => setOp(v as AluOp)}
        />
        <PickerRow
          label="reg A"
          options={ALU_REGS}
          value={regA}
          onChange={(v) => setRegA(v as AluReg)}
        />
        <PickerRow
          label="reg B"
          options={ALU_REGS}
          value={regB}
          onChange={(v) => setRegB(v as AluReg)}
        />

        <ByteDisplay byte={byte} />

        <p className="mt-4 text-center text-sm">
          <span className="font-mono font-semibold text-apple-text">
            {op} {regA}, {regB}
          </span>{' '}
          —{' '}
          <span className="text-apple-text-secondary">{recipe.blurb}</span>
        </p>
        <p className="mt-1 text-center text-xs italic text-apple-text-secondary">
          {preset.expected}
        </p>
      </div>

      <div className="mt-5">
        <CpuDiagram state={cpuState} recipe={recipe} />
      </div>

      {/* Controls */}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={toggleRun}
          aria-pressed={running}
          className={`rounded-lg border px-5 py-2 text-sm font-semibold transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue focus-visible:ring-offset-2 motion-reduce:transition-none ${
            running
              ? 'border-apple-blue bg-apple-blue text-white shadow-md'
              : 'border-apple-border bg-white text-apple-text hover:border-apple-blue/40'
          }`}
        >
          {running ? 'Pause' : 'Run'}
        </button>
        <button
          type="button"
          onClick={step}
          disabled={running}
          className="rounded-lg border border-apple-border bg-white px-4 py-2 text-sm font-medium text-apple-text transition-colors duration-200 hover:border-apple-blue/40 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue focus-visible:ring-offset-2 motion-reduce:transition-none"
        >
          Step
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-full border border-apple-border bg-white px-4 py-1.5 text-xs font-medium text-apple-text-secondary transition-colors duration-200 hover:text-apple-text focus:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue focus-visible:ring-offset-2 motion-reduce:transition-none"
        >
          Reset
        </button>
      </div>

      <div className="mx-auto mt-5 max-w-[420px]">
        <label className="flex items-center gap-3">
          <span className="shrink-0 text-xs font-semibold uppercase tracking-widest text-apple-text-secondary">
            Step rate
          </span>
          <input
            type="range"
            min={MIN_RATE_MS}
            max={MAX_RATE_MS}
            step={250}
            value={rateMs}
            onChange={(e) => setRateMs(Number(e.target.value))}
            aria-label="Step rate in milliseconds"
            className="flex-1 accent-apple-blue"
          />
          <span className="w-20 shrink-0 text-right font-mono text-xs text-apple-text-secondary">
            {rateMs} ms
          </span>
        </label>
      </div>
    </div>
  );
}

function PickerRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className="w-14 shrink-0 text-right font-mono text-xs font-semibold text-apple-text-secondary">
        {label}
      </span>
      <div role="radiogroup" aria-label={label} className="flex flex-1 flex-wrap gap-2">
        {options.map((o) => {
          const active = o === value;
          return (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o)}
              className={`rounded-md border px-3 py-1.5 font-mono text-xs font-semibold tracking-wide transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue focus-visible:ring-offset-2 motion-reduce:transition-none ${
                active
                  ? 'border-apple-blue bg-apple-blue text-white'
                  : 'border-apple-border bg-white text-apple-text-secondary hover:text-apple-text'
              }`}
            >
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ByteDisplay({ byte }: { byte: number }) {
  // Bits MSB-first. Chunks: 1 (ALU flag) | 3 (op) | 2 (regA) | 2 (regB).
  const bits: number[] = [];
  for (let i = 7; i >= 0; i--) bits.push((byte >> i) & 1);

  const chunks = [
    { bits: bits.slice(0, 1), label: 'ALU flag', color: 'bg-amber-100 border-amber-400' },
    { bits: bits.slice(1, 4), label: 'op', color: 'bg-purple-100 border-purple-400' },
    { bits: bits.slice(4, 6), label: 'reg A', color: 'bg-emerald-100 border-emerald-400' },
    { bits: bits.slice(6, 8), label: 'reg B', color: 'bg-sky-100 border-sky-400' },
  ];

  return (
    <div className="mt-4 rounded-lg border border-apple-border bg-apple-bg/30 p-3">
      <div className="text-center text-[11px] font-semibold uppercase tracking-widest text-apple-text-secondary">
        Instruction byte
      </div>
      <div
        className="mx-auto mt-2 grid w-fit"
        style={{ gridTemplateColumns: 'repeat(4, auto)', columnGap: '4px' }}
      >
        {chunks.map((c) => (
          <div key={c.label} className="flex flex-col items-center">
            <div className="flex gap-[2px]">
              {c.bits.map((b, i) => (
                <span
                  key={i}
                  data-bit-value={b}
                  className={`flex h-8 w-8 items-center justify-center rounded-md border font-mono text-sm font-semibold ${c.color}`}
                >
                  {b}
                </span>
              ))}
            </div>
            <span className="mt-1 font-mono text-[10px] text-apple-text-secondary">
              {c.label}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-xs text-apple-text-secondary">
        decimal{' '}
        <output
          aria-label="instruction byte as decimal"
          className="font-mono font-semibold text-apple-text"
        >
          {byte}
        </output>{' '}
        · binary{' '}
        <output
          aria-label="instruction byte as binary"
          className="font-mono text-apple-text"
        >
          {byte.toString(2).padStart(8, '0')}
        </output>
      </p>
    </div>
  );
}
