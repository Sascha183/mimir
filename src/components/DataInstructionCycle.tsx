import { useEffect, useMemo, useRef, useState } from 'react';
import { executeStep } from '../lib/cpu/simulator';
import { buildRecipeForIR, disassemble } from '../lib/cpu/decoder';
import {
  buildDemoProgramState,
  PROGRAM_DEMO_LENGTH,
  PROGRAM_DEMO_RESULT_ADDRESS,
} from '../lib/cpu/program';
import type { CpuState } from '../lib/cpu/types';
import CpuDiagram from './cpu/CpuDiagram';

/**
 * DataInstructionCycle — lesson-23 scene.
 *
 * Runs a fixed 5-instruction program on the CPU. Unlike L20–22 (which run
 * one instruction at a time with a fixed recipe), this widget *decodes*
 * the recipe dynamically from IR every render. The program runs cycle
 * after cycle until IAR walks past the end of the program.
 *
 * Adds a program-listing panel beside the standard CpuDiagram so the
 * learner can see the disassembled instructions and which one is
 * currently executing.
 */

const DEFAULT_RATE_MS = 800;
const MIN_RATE_MS = 300;
const MAX_RATE_MS = 3000;
const STORAGE_KEY = 'hciw:data-instruction:state';

interface PersistedState {
  rateMs: number;
}

function defaultPersisted(): PersistedState {
  return { rateMs: DEFAULT_RATE_MS };
}

function loadPersisted(): PersistedState {
  if (typeof window === 'undefined') return defaultPersisted();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPersisted();
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    const r = parsed.rateMs;
    if (typeof r === 'number' && r >= MIN_RATE_MS && r <= MAX_RATE_MS) {
      return { rateMs: Math.round(r) };
    }
    return defaultPersisted();
  } catch {
    return defaultPersisted();
  }
}

export default function DataInstructionCycle() {
  const [cpuState, setCpuState] = useState<CpuState>(() => buildDemoProgramState());
  const [running, setRunning] = useState(false);
  const [rateMs, setRateMs] = useState(DEFAULT_RATE_MS);
  const [hydrated, setHydrated] = useState(false);
  // The IAR at the moment a cycle began — used to highlight the current
  // line in the program listing throughout the cycle, even after fetch
  // advances IAR past the instruction's first byte.
  const [cycleStartIAR, setCycleStartIAR] = useState(0);
  const intervalRef = useRef<number | null>(null);

  const recipe = useMemo(
    () => buildRecipeForIR(cpuState.registers.IR, cpuState.flags),
    [cpuState.registers.IR, cpuState.flags],
  );

  const program = useMemo(
    () => disassemble(cpuState.ram, 0, PROGRAM_DEMO_LENGTH),
    [cpuState.ram],
  );

  useEffect(() => {
    setRateMs(loadPersisted().rateMs);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ rateMs }));
    } catch {
      // ignore
    }
  }, [hydrated, rateMs]);

  function step() {
    setCpuState((prev) => {
      const next = executeStep(prev, recipe.steps[prev.stepIdx]);
      // When a cycle completes (stepIdx wraps to 0) we now point at the
      // next instruction — update the listing's "current line" cursor.
      if (next.stepIdx === 0) setCycleStartIAR(next.registers.IAR);
      return next;
    });
  }

  function stepInstruction() {
    // Advance until we complete a full cycle (stepIdx wraps to 0).
    setCpuState((prev) => {
      let s = prev;
      const maxSteps = 7;
      for (let i = 0; i < maxSteps; i++) {
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
    setCpuState(buildDemoProgramState());
    setCycleStartIAR(0);
  }

  const programDone = cpuState.registers.IAR >= PROGRAM_DEMO_LENGTH;
  const resultByte = cpuState.ram[PROGRAM_DEMO_RESULT_ADDRESS];

  return (
    <div className="not-prose mx-auto my-12 w-full max-w-[860px] text-apple-text">
      {/* Program listing */}
      <div className="rounded-xl border border-apple-border bg-white p-4">
        <div className="text-center text-xs font-semibold uppercase tracking-widest text-apple-text-secondary">
          Program in RAM
        </div>
        <ol className="mt-3 space-y-1">
          {program.map((line) => {
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
              Program complete. RAM[{PROGRAM_DEMO_RESULT_ADDRESS}] holds{' '}
              <output
                aria-label="result byte"
                className="font-mono font-semibold text-apple-text"
              >
                {resultByte}
              </output>
              . The CPU is now executing zeros from RAM (no-ops) — Reset to start over.
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
          onClick={stepInstruction}
          disabled={running}
          className="rounded-lg border border-apple-border bg-white px-4 py-2 text-sm font-medium text-apple-text transition-colors duration-200 hover:border-apple-blue/40 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue focus-visible:ring-offset-2 motion-reduce:transition-none"
        >
          Step instruction
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
