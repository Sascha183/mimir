import { useEffect, useMemo, useRef, useState } from 'react';
import { executeStep } from '../lib/cpu/simulator';
import {
  ALU_REGS,
  type AluReg,
} from '../lib/cpu/alu-instructions';
import {
  LOAD_STORE_OPS,
  buildLoadStorePreset,
  buildLoadStoreRecipe,
  encodeLoadStore,
  type LoadStoreOp,
} from '../lib/cpu/load-store-instructions';
import type { CpuState } from '../lib/cpu/types';
import CpuDiagram from './cpu/CpuDiagram';

/**
 * LoadStoreCycle — lesson-22 scene.
 *
 * Mirrors `AluInstructionsCycle` (lesson 21) but for the LOAD/STORE family.
 * Three picker rows: op (LOAD/STORE), regA (address), regB (data). The 8-bit
 * instruction byte is shown with three chunks (4-bit opcode, 2-bit regA,
 * 2-bit regB) — the same color palette as L21 so the format-comparison is
 * easy to read across lessons.
 */

const DEFAULT_RATE_MS = 1500;
const MIN_RATE_MS = 500;
const MAX_RATE_MS = 4000;
const STORAGE_KEY = 'hciw:load-store:state';

interface PersistedState {
  rateMs: number;
  op: LoadStoreOp;
  regA: AluReg;
  regB: AluReg;
}

function defaultPersisted(): PersistedState {
  return { rateMs: DEFAULT_RATE_MS, op: 'LOAD', regA: 'R0', regB: 'R1' };
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
      op: LOAD_STORE_OPS.includes(parsed.op as LoadStoreOp)
        ? (parsed.op as LoadStoreOp)
        : 'LOAD',
      regA: ALU_REGS.includes(parsed.regA as AluReg) ? (parsed.regA as AluReg) : 'R0',
      regB: ALU_REGS.includes(parsed.regB as AluReg) ? (parsed.regB as AluReg) : 'R1',
    };
  } catch {
    return defaultPersisted();
  }
}

export default function LoadStoreCycle() {
  const [op, setOp] = useState<LoadStoreOp>('LOAD');
  const [regA, setRegA] = useState<AluReg>('R0');
  const [regB, setRegB] = useState<AluReg>('R1');
  const [rateMs, setRateMs] = useState(DEFAULT_RATE_MS);
  const [running, setRunning] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const intervalRef = useRef<number | null>(null);

  const recipe = useMemo(() => buildLoadStoreRecipe(op, regA, regB), [op, regA, regB]);
  const preset = useMemo(() => buildLoadStorePreset(op, regA, regB), [op, regA, regB]);
  const byte = useMemo(() => encodeLoadStore(op, regA, regB), [op, regA, regB]);

  const [cpuState, setCpuState] = useState<CpuState>(() => preset.initialState);

  useEffect(() => {
    const loaded = loadPersisted();
    setOp(loaded.op);
    setRegA(loaded.regA);
    setRegB(loaded.regB);
    setRateMs(loaded.rateMs);
    setHydrated(true);
  }, []);

  useEffect(() => {
    setRunning(false);
    setCpuState(preset.initialState);
  }, [preset]);

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
          Build a memory instruction
        </div>

        <PickerRow
          label="op"
          options={LOAD_STORE_OPS}
          value={op}
          onChange={(v) => setOp(v as LoadStoreOp)}
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
        <p className="mt-1 text-center text-xs text-apple-text-secondary">
          {preset.setup}
        </p>
        <p className="mt-1 text-center text-xs italic text-apple-text-secondary">
          {preset.expected}
        </p>
      </div>

      <div className="mt-5">
        <CpuDiagram state={cpuState} recipe={recipe} />
      </div>

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
  const bits: number[] = [];
  for (let i = 7; i >= 0; i--) bits.push((byte >> i) & 1);

  const chunks = [
    {
      bits: bits.slice(0, 4),
      label: 'opcode',
      color: 'bg-amber-100 border-amber-400',
    },
    {
      bits: bits.slice(4, 6),
      label: 'reg A',
      color: 'bg-emerald-100 border-emerald-400',
    },
    {
      bits: bits.slice(6, 8),
      label: 'reg B',
      color: 'bg-sky-100 border-sky-400',
    },
  ];

  return (
    <div className="mt-4 rounded-lg border border-apple-border bg-apple-bg/30 p-3">
      <div className="text-center text-[11px] font-semibold uppercase tracking-widest text-apple-text-secondary">
        Instruction byte
      </div>
      <div
        className="mx-auto mt-2 grid w-fit"
        style={{ gridTemplateColumns: 'repeat(3, auto)', columnGap: '4px' }}
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
