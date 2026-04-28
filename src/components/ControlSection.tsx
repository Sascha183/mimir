import { useEffect, useRef, useState } from 'react';
import {
  RECIPES,
  STEP_PHASES,
  findRecipe,
  type Action,
  type ActionKind,
} from '../lib/cpu/recipes';

/**
 * ControlSection — lesson-19 scene.
 *
 * A 7-row recipe table that visualizes the control section's behavior. Each
 * row is one step of the stepper; cells contain the action chips that fire
 * AT that step for the currently-selected instruction. The active step row
 * is highlighted, advancing once per "clock period" of internal time.
 *
 * The widget does not render the underlying control wiring (AND gates between
 * the stepper outputs and the IR's bits). That wiring is real and exists in
 * the book; visualizing it directly produces a rats-nest. Instead this widget
 * shows the *result* of the wiring — what fires, when, for what instruction.
 *
 * The recipe data lives in src/lib/cpu/recipes.ts and is reused by lesson 20+
 * to drive the CPU diagram.
 */

const STEP_COUNT = 7;
const DEFAULT_RATE_MS = 1500;
const MIN_RATE_MS = 500;
const MAX_RATE_MS = 4000;
const STORAGE_KEY = 'hciw:control-section:state';

interface PersistedState {
  rateMs: number;
  instructionKey: string;
}

function defaultState(): PersistedState {
  return { rateMs: DEFAULT_RATE_MS, instructionKey: RECIPES[0].key };
}

function loadState(): PersistedState {
  if (typeof window === 'undefined') return defaultState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    const r = parsed.rateMs;
    const k = parsed.instructionKey;
    return {
      rateMs:
        typeof r === 'number' && r >= MIN_RATE_MS && r <= MAX_RATE_MS
          ? Math.round(r)
          : DEFAULT_RATE_MS,
      instructionKey:
        typeof k === 'string' && RECIPES.some((x) => x.key === k)
          ? k
          : RECIPES[0].key,
    };
  } catch {
    return defaultState();
  }
}

const KIND_STYLES: Record<ActionKind, string> = {
  enable: 'border-emerald-500 bg-emerald-50 text-emerald-900',
  set: 'border-apple-blue bg-apple-blue/10 text-apple-blue',
  alu: 'border-purple-500 bg-purple-50 text-purple-900',
  misc: 'border-apple-border bg-apple-bg text-apple-text-secondary',
};

const KIND_LEAD: Record<ActionKind, string> = {
  enable: 'enable',
  set: 'set',
  alu: 'ALU',
  misc: '',
};

export default function ControlSection() {
  const [stepIdx, setStepIdx] = useState(0);
  const [running, setRunning] = useState(false);
  const [rateMs, setRateMs] = useState(DEFAULT_RATE_MS);
  const [instructionKey, setInstructionKey] = useState(RECIPES[0].key);
  const [hydrated, setHydrated] = useState(false);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    const loaded = loadState();
    setRateMs(loaded.rateMs);
    setInstructionKey(loaded.instructionKey);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ rateMs, instructionKey }),
      );
    } catch {
      // ignore
    }
  }, [hydrated, rateMs, instructionKey]);

  useEffect(() => {
    if (!running) {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    intervalRef.current = window.setInterval(() => {
      setStepIdx((s) => (s + 1) % STEP_COUNT);
    }, rateMs);
    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [running, rateMs]);

  const recipe = findRecipe(instructionKey);

  function step() {
    setStepIdx((s) => (s + 1) % STEP_COUNT);
  }
  function toggleRun() {
    setRunning((r) => !r);
  }
  function reset() {
    setRunning(false);
    setStepIdx(0);
  }
  function pickInstruction(key: string) {
    setInstructionKey(key);
    setRunning(false);
    setStepIdx(0);
  }

  return (
    <div className="not-prose mx-auto my-12 w-full max-w-[760px] text-apple-text">
      {/* Instruction selector */}
      <div className="rounded-xl border border-apple-border bg-white p-4">
        <div className="text-center text-xs font-semibold uppercase tracking-widest text-apple-text-secondary">
          Instruction
        </div>
        <div
          role="radiogroup"
          aria-label="Instruction to run"
          className="mt-3 flex flex-wrap items-center justify-center gap-2"
        >
          {RECIPES.map((r) => {
            const active = r.key === instructionKey;
            return (
              <button
                key={r.key}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => pickInstruction(r.key)}
                className={`rounded-lg border px-3 py-2 font-mono text-xs font-semibold tracking-wide transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue focus-visible:ring-offset-2 motion-reduce:transition-none ${
                  active
                    ? 'border-apple-blue bg-apple-blue text-white'
                    : 'border-apple-border bg-white text-apple-text-secondary hover:text-apple-text'
                }`}
              >
                {r.name}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-center text-sm text-apple-text-secondary">
          {recipe.blurb}
        </p>
      </div>

      {/* The 7-row recipe table */}
      <div className="mt-5 overflow-hidden rounded-xl border border-apple-border bg-white">
        <table className="w-full border-collapse text-sm">
          <thead className="border-b border-apple-border bg-apple-bg/40">
            <tr>
              <th
                scope="col"
                className="w-16 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-widest text-apple-text-secondary"
              >
                Step
              </th>
              <th
                scope="col"
                className="w-20 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-widest text-apple-text-secondary"
              >
                Phase
              </th>
              <th
                scope="col"
                className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-widest text-apple-text-secondary"
              >
                Actions that fire
              </th>
            </tr>
          </thead>
          <tbody>
            {recipe.steps.map((actions, i) => {
              const isActive = i === stepIdx;
              return (
                <tr
                  key={i}
                  data-step={i}
                  data-active={isActive ? 'true' : 'false'}
                  aria-current={isActive ? 'step' : undefined}
                  className={`border-t border-apple-border/60 transition-colors duration-150 motion-reduce:transition-none ${
                    isActive ? 'bg-apple-blue/10' : ''
                  }`}
                >
                  <td className="px-3 py-3 align-top">
                    <span
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-full font-mono text-sm font-semibold ${
                        isActive
                          ? 'bg-apple-blue text-white'
                          : 'bg-apple-bg text-apple-text-secondary'
                      }`}
                    >
                      {i + 1}
                    </span>
                  </td>
                  <td className="px-3 py-3 align-top font-mono text-xs uppercase tracking-wide text-apple-text-secondary">
                    {STEP_PHASES[i]}
                  </td>
                  <td className="px-3 py-3 align-top">
                    {actions.length === 0 ? (
                      <span className="text-xs italic text-apple-text-secondary">
                        nothing — this step is unused by this instruction
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {actions.map((a, j) => (
                          <ActionChip key={j} action={a} />
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-center text-sm text-apple-text-secondary" aria-live="polite">
        Active:{' '}
        <output
          aria-label="current step"
          className="font-mono font-semibold text-apple-text"
        >
          step {stepIdx + 1}
        </output>{' '}
        ({STEP_PHASES[stepIdx]})
      </p>

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
          {running ? 'Pause' : 'Start'}
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
            aria-valuemin={MIN_RATE_MS}
            aria-valuemax={MAX_RATE_MS}
            aria-valuenow={rateMs}
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

function ActionChip({ action }: { action: Action }) {
  const lead = KIND_LEAD[action.kind];
  return (
    <span
      data-kind={action.kind}
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 font-mono text-xs ${KIND_STYLES[action.kind]}`}
    >
      {lead ? (
        <span className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
          {lead}
        </span>
      ) : null}
      <span className="font-semibold">{action.label}</span>
    </span>
  );
}
