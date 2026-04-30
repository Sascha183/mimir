import { useEffect, useMemo, useRef, useState } from 'react';
import { executeStep } from '../lib/cpu/simulator';
import { buildRecipeForIR, disassemble } from '../lib/cpu/decoder';
import {
  CONDITIONAL_PROGRAMS,
  findConditionalProgram,
} from '../lib/cpu/conditional-programs';
import type { CpuState } from '../lib/cpu/types';
import CpuDiagram from './cpu/CpuDiagram';

/**
 * ConditionalJumpsCycle — lesson-25 scene.
 *
 * Three pre-loaded variants of the same "find the larger" program,
 * differing only in the literal values baked into the DATA instructions.
 * The user runs the program and watches CMP set the A larger flag, then
 * JA branches conditionally based on the flag.
 */

const DEFAULT_RATE_MS = 700;
const MIN_RATE_MS = 300;
const MAX_RATE_MS = 3000;
const STORAGE_KEY = 'hciw:conditional-jumps:state';

interface PersistedState {
  rateMs: number;
  programKey: string;
}

function defaultPersisted(): PersistedState {
  return { rateMs: DEFAULT_RATE_MS, programKey: CONDITIONAL_PROGRAMS[0].key };
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
      programKey:
        typeof parsed.programKey === 'string' &&
        CONDITIONAL_PROGRAMS.some((p) => p.key === parsed.programKey)
          ? parsed.programKey
          : CONDITIONAL_PROGRAMS[0].key,
    };
  } catch {
    return defaultPersisted();
  }
}

export default function ConditionalJumpsCycle() {
  const [programKey, setProgramKey] = useState(CONDITIONAL_PROGRAMS[0].key);
  const [cpuState, setCpuState] = useState<CpuState>(() =>
    CONDITIONAL_PROGRAMS[0].build(),
  );
  const [running, setRunning] = useState(false);
  const [rateMs, setRateMs] = useState(DEFAULT_RATE_MS);
  const [hydrated, setHydrated] = useState(false);
  const [cycleStartIAR, setCycleStartIAR] = useState(0);
  const intervalRef = useRef<number | null>(null);

  const program = useMemo(
    () => findConditionalProgram(programKey),
    [programKey],
  );
  const recipe = useMemo(
    () => buildRecipeForIR(cpuState.registers.IR, cpuState.flags),
    [cpuState.registers.IR, cpuState.flags],
  );
  const lines = useMemo(
    () => disassemble(cpuState.ram, 0, program.programLength),
    [cpuState.ram, program.programLength],
  );

  useEffect(() => {
    const loaded = loadPersisted();
    setProgramKey(loaded.programKey);
    setRateMs(loaded.rateMs);
    setCpuState(findConditionalProgram(loaded.programKey).build());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ rateMs, programKey }),
      );
    } catch {
      // ignore
    }
  }, [hydrated, rateMs, programKey]);

  function pickProgram(key: string) {
    setRunning(false);
    setProgramKey(key);
    setCpuState(findConditionalProgram(key).build());
    setCycleStartIAR(0);
  }

  function step() {
    setCpuState((prev) => {
      const r = buildRecipeForIR(prev.registers.IR, prev.flags);
      const next = executeStep(prev, r.steps[prev.stepIdx]);
      if (next.stepIdx === 0) setCycleStartIAR(next.registers.IAR);
      return next;
    });
  }

  function stepInstruction() {
    setCpuState((prev) => {
      let s = prev;
      for (let i = 0; i < 7; i++) {
        const r = buildRecipeForIR(s.registers.IR, s.flags);
        s = executeStep(s, r.steps[s.stepIdx]);
        if (s.stepIdx === 0) break;
      }
      setCycleStartIAR(s.registers.IAR);
      return s;
    });
  }

  useEffect(() => {
    if (!running) {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    intervalRef.current = window.setInterval(() => {
      setCpuState((prev) => {
        const r = buildRecipeForIR(prev.registers.IR, prev.flags);
        const next = executeStep(prev, r.steps[prev.stepIdx]);
        if (next.stepIdx === 0) setCycleStartIAR(next.registers.IAR);
        return next;
      });
    }, rateMs);
    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [running, rateMs]);

  function toggleRun() {
    setRunning((r) => !r);
  }
  function reset() {
    setRunning(false);
    setCpuState(program.build());
    setCycleStartIAR(0);
  }

  const programDone = cpuState.registers.IAR >= program.programLength;

  return (
    <div className="not-prose mx-auto my-12 w-full max-w-[860px] text-apple-text">
      {/* Program selector */}
      <div className="rounded-xl border border-apple-border bg-apple-surface p-4">
        <div className="text-center text-xs font-semibold uppercase tracking-widest text-apple-text-secondary">
          Scenario
        </div>
        <div
          role="radiogroup"
          aria-label="Scenario to run"
          className="mt-3 flex flex-wrap items-center justify-center gap-2"
        >
          {CONDITIONAL_PROGRAMS.map((p) => {
            const active = p.key === programKey;
            return (
              <button
                key={p.key}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => pickProgram(p.key)}
                className={`rounded-lg border px-3 py-2 font-mono text-xs font-semibold tracking-wide transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue focus-visible:ring-offset-2 motion-reduce:transition-none ${
                  active
                    ? 'border-apple-blue bg-apple-blue text-white'
                    : 'border-apple-border bg-apple-surface text-apple-text-secondary hover:text-apple-text'
                }`}
              >
                {p.name}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-center text-sm text-apple-text-secondary">
          {program.description}
        </p>
      </div>

      {/* Program listing */}
      <div className="mt-5 rounded-xl border border-apple-border bg-apple-surface p-4">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-apple-text-secondary">
          Program in RAM
        </div>
        <ol className="mt-3 space-y-1">
          {lines.map((line) => {
            const isCurrent =
              cycleStartIAR >= line.address &&
              cycleStartIAR < line.address + line.byteCount;
            return (
              <li
                key={line.address}
                data-line-address={line.address}
                data-current={isCurrent ? 'true' : 'false'}
                className={`flex items-baseline justify-between gap-3 rounded-md border px-3 py-2 transition-colors duration-150 motion-reduce:transition-none ${
                  isCurrent
                    ? 'border-apple-blue bg-apple-blue/10'
                    : 'border-transparent'
                }`}
              >
                <span className="font-mono text-[11px] text-apple-text-secondary">
                  {String(line.address).padStart(2, '0')}
                  {line.byteCount === 2 ? `–${line.address + 1}` : '   '}
                </span>
                <span className="flex-1 font-mono text-sm font-semibold text-apple-text">
                  {line.mnemonic}
                </span>
                <span className="font-mono text-[11px] text-apple-text-secondary">
                  {line.byteCount === 2 ? '2 bytes' : '1 byte'}
                </span>
              </li>
            );
          })}
        </ol>

        <p className="mt-3 text-center text-sm text-apple-text-secondary" aria-live="polite">
          {programDone ? (
            <>
              Program complete. R3 holds{' '}
              <output
                aria-label="result R3"
                className="font-mono font-semibold text-apple-text"
              >
                {cpuState.registers.R3}
              </output>{' '}
              — the larger of {cpuState.registers.R0} and {cpuState.registers.R1}.
              Reset to start over.
            </>
          ) : (
            <>
              Running. Currently inside instruction at address{' '}
              <output
                aria-label="current instruction address"
                className="font-mono font-semibold text-apple-text"
              >
                {cycleStartIAR}
              </output>
              .
            </>
          )}
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
              : 'border-apple-border bg-apple-surface text-apple-text hover:border-apple-blue/40'
          }`}
        >
          {running ? 'Pause' : 'Run'}
        </button>
        <button
          type="button"
          onClick={step}
          disabled={running}
          className="rounded-lg border border-apple-border bg-apple-surface px-4 py-2 text-sm font-medium text-apple-text transition-colors duration-200 hover:border-apple-blue/40 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue focus-visible:ring-offset-2 motion-reduce:transition-none"
        >
          Step
        </button>
        <button
          type="button"
          onClick={stepInstruction}
          disabled={running}
          className="rounded-lg border border-apple-border bg-apple-surface px-4 py-2 text-sm font-medium text-apple-text transition-colors duration-200 hover:border-apple-blue/40 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue focus-visible:ring-offset-2 motion-reduce:transition-none"
        >
          Step instruction
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-full border border-apple-border bg-apple-surface px-4 py-1.5 text-xs font-medium text-apple-text-secondary transition-colors duration-200 hover:text-apple-text focus:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue focus-visible:ring-offset-2 motion-reduce:transition-none"
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
            step={100}
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
