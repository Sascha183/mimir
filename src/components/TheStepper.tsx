import { useEffect, useRef, useState } from 'react';
import type { Bit } from '../lib/gates/types';
import TimelineSignal from './timeline/TimelineSignal';

/**
 * TheStepper — lesson-18 scene.
 *
 * Builds on lesson 17's clock view. We extend the timeline to 28 ticks =
 * 7 full clock periods = exactly one complete instruction cycle, and add a
 * 7-cell stepper row below the clock rows. The active stepper output
 * advances each time clk_s pulses, so over one timeline pass the learner
 * sees seven clk_s pulses produce seven step transitions in lockstep.
 *
 * Each clock period = 4 timeline ticks (matches L17's discretization):
 *   tick 0 1 2 3
 *   clk    0 1 1 0
 *   clk_s  0 0 1 0     (capture pulse — also when the stepper advances)
 *
 * Stepper outputs: 7 wires, named step1..step7. Exactly one is high per
 * clock period. Steps 1-3 are the "fetch" phase (constant for every
 * instruction); steps 4-6 are the "execute" phase (varies per instruction);
 * step 7 is the reset that brings us back to step 1.
 *
 * Implementation: stepIdx = Math.floor(tick / 4). When tick wraps from 27
 * to 0, stepIdx wraps from 6 to 0. No separate state for the stepper.
 */

const TICKS_PER_PERIOD = 4;
const STEP_COUNT = 7;
const TIMELINE_LENGTH = TICKS_PER_PERIOD * STEP_COUNT; // 28
const DEFAULT_RATE_MS = 500;
const MIN_RATE_MS = 200;
const MAX_RATE_MS = 1600;
const STORAGE_KEY = 'hciw:the-stepper:state';

interface PersistedState {
  rateMs: number;
}

function defaultState(): PersistedState {
  return { rateMs: DEFAULT_RATE_MS };
}

function loadState(): PersistedState {
  if (typeof window === 'undefined') return defaultState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    const r = parsed.rateMs;
    if (typeof r === 'number' && r >= MIN_RATE_MS && r <= MAX_RATE_MS) {
      return { rateMs: Math.round(r) };
    }
    return defaultState();
  } catch {
    return defaultState();
  }
}

function clkAt(i: number): Bit {
  const phase = i % TICKS_PER_PERIOD;
  return phase === 1 || phase === 2 ? 1 : 0;
}
function clkSAt(i: number): Bit {
  const phase = i % TICKS_PER_PERIOD;
  return phase === 2 ? 1 : 0;
}

function buildRow(fn: (i: number) => Bit): Bit[] {
  const out: Bit[] = [];
  for (let i = 0; i < TIMELINE_LENGTH; i++) out.push(fn(i));
  return out;
}

const CLK_ROW = buildRow(clkAt);
const CLK_S_ROW = buildRow(clkSAt);

const STEP_LABELS = ['1', '2', '3', '4', '5', '6', '7'] as const;
const STEP_PHASES: readonly string[] = [
  'fetch',
  'fetch',
  'fetch',
  'execute',
  'execute',
  'execute',
  'reset',
];

function stepperBits(activeStep: number): Bit[] {
  const out: Bit[] = [];
  for (let i = 0; i < STEP_COUNT; i++) out.push(i === activeStep ? 1 : 0);
  return out;
}

export default function TheStepper() {
  const [tick, setTick] = useState(0);
  const [running, setRunning] = useState(false);
  const [rateMs, setRateMs] = useState(DEFAULT_RATE_MS);
  const [hydrated, setHydrated] = useState(false);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    const loaded = loadState();
    setRateMs(loaded.rateMs);
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

  useEffect(() => {
    if (!running) {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    intervalRef.current = window.setInterval(() => {
      setTick((t) => (t + 1) % TIMELINE_LENGTH);
    }, rateMs);
    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [running, rateMs]);

  function step() {
    setTick((t) => (t + 1) % TIMELINE_LENGTH);
  }
  function toggleRun() {
    setRunning((r) => !r);
  }
  function reset() {
    setRunning(false);
    setTick(0);
  }

  const stepIdx = Math.floor(tick / TICKS_PER_PERIOD);
  const stepNumber = stepIdx + 1; // 1-indexed for display
  const phase = STEP_PHASES[stepIdx];

  return (
    <div className="not-prose mx-auto my-12 w-full max-w-[760px] text-apple-text">
      <div className="rounded-xl border border-apple-border bg-white p-5">
        <div className="overflow-x-auto">
          <div className="min-w-[640px] space-y-3">
            <TimelineSignal label="clk" bits={CLK_ROW} activeIndex={tick} />
            <TimelineSignal label="clk_s" bits={CLK_S_ROW} activeIndex={tick} />
            <div className="pt-2">
              <TimelineSignal
                label="step"
                bits={stepperBits(stepIdx)}
                activeIndex={stepIdx}
                cellLabels={STEP_LABELS}
              />
              <div className="mt-1 flex items-center gap-3">
                <div className="w-16 shrink-0" aria-hidden="true" />
                <div className="flex flex-1 gap-[2px]">
                  {STEP_PHASES.map((label, i) => (
                    <div
                      key={i}
                      className={`flex-1 text-center font-mono text-[10px] ${
                        i === stepIdx
                          ? 'font-semibold text-apple-text'
                          : 'text-apple-text-secondary'
                      }`}
                    >
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-sm text-apple-text-secondary" aria-live="polite">
          Tick{' '}
          <output
            aria-label="current tick"
            className="font-mono font-semibold text-apple-text"
          >
            {tick}
          </output>{' '}
          · step{' '}
          <output
            aria-label="current step"
            className="font-mono font-semibold text-apple-text"
          >
            {stepNumber}
          </output>{' '}
          of {STEP_COUNT} ({phase})
        </p>
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
            Tick rate
          </span>
          <input
            type="range"
            min={MIN_RATE_MS}
            max={MAX_RATE_MS}
            step={100}
            value={rateMs}
            onChange={(e) => setRateMs(Number(e.target.value))}
            aria-label="Tick rate in milliseconds"
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
