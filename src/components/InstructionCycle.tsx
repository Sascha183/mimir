import { useEffect, useRef, useState } from 'react';
import { findRecipe } from '../lib/cpu/recipes';
import { executeStep } from '../lib/cpu/simulator';
import { findPreset, PRESETS } from '../lib/cpu/instructions';
import type { CpuState } from '../lib/cpu/types';
import CpuDiagram from './cpu/CpuDiagram';

/**
 * InstructionCycle — lesson-20 scene.
 *
 * Picks one of three pre-loaded demo instructions (ADD, LOAD, JMPR), runs
 * the recipe through the simulator one step at a time, and renders the
 * full CPU via the shared `CpuDiagram` primitive.
 */

const DEFAULT_RATE_MS = 1500;
const MIN_RATE_MS = 500;
const MAX_RATE_MS = 4000;
const STORAGE_KEY = 'hciw:instruction-cycle:state';

interface PersistedState {
  rateMs: number;
  presetKey: string;
}

function defaultPersisted(): PersistedState {
  return { rateMs: DEFAULT_RATE_MS, presetKey: PRESETS[0].key };
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
      presetKey:
        typeof parsed.presetKey === 'string' &&
        PRESETS.some((p) => p.key === parsed.presetKey)
          ? parsed.presetKey
          : PRESETS[0].key,
    };
  } catch {
    return defaultPersisted();
  }
}

export default function InstructionCycle() {
  const [presetKey, setPresetKey] = useState(PRESETS[0].key);
  const [cpuState, setCpuState] = useState<CpuState>(() =>
    findPreset(PRESETS[0].key).initialState,
  );
  const [running, setRunning] = useState(false);
  const [rateMs, setRateMs] = useState(DEFAULT_RATE_MS);
  const [hydrated, setHydrated] = useState(false);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    const loaded = loadPersisted();
    setPresetKey(loaded.presetKey);
    setRateMs(loaded.rateMs);
    setCpuState(findPreset(loaded.presetKey).initialState);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ rateMs, presetKey }),
      );
    } catch {
      // ignore
    }
  }, [hydrated, rateMs, presetKey]);

  const recipe = findRecipe(presetKey);
  const preset = findPreset(presetKey);

  function step() {
    setCpuState((prev) => executeStep(prev, recipe.steps[prev.stepIdx]));
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
      setCpuState((prev) => executeStep(prev, recipe.steps[prev.stepIdx]));
    }, rateMs);
    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [running, rateMs, recipe]);

  function toggleRun() {
    setRunning((r) => !r);
  }
  function reset() {
    setRunning(false);
    setCpuState(preset.initialState);
  }
  function pickPreset(key: string) {
    setRunning(false);
    setPresetKey(key);
    setCpuState(findPreset(key).initialState);
  }

  return (
    <div className="not-prose mx-auto my-12 w-full max-w-[860px] text-apple-text">
      {/* Instruction selector */}
      <div className="rounded-xl border border-apple-border bg-apple-surface p-4">
        <div className="text-center text-xs font-semibold uppercase tracking-widest text-apple-text-secondary">
          Instruction
        </div>
        <div
          role="radiogroup"
          aria-label="Instruction to run"
          className="mt-3 flex flex-wrap items-center justify-center gap-2"
        >
          {PRESETS.map((p) => {
            const active = p.key === presetKey;
            const r = findRecipe(p.key);
            return (
              <button
                key={p.key}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => pickPreset(p.key)}
                className={`rounded-lg border px-3 py-2 font-mono text-xs font-semibold tracking-wide transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue focus-visible:ring-offset-2 motion-reduce:transition-none ${
                  active
                    ? 'border-apple-blue bg-apple-blue text-white'
                    : 'border-apple-border bg-apple-surface text-apple-text-secondary hover:text-apple-text'
                }`}
              >
                {r.name}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-center text-sm text-apple-text-secondary">
          {preset.setup}
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
