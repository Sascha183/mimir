import { useEffect, useRef, useState } from 'react';
import type { Bit } from '../lib/gates/types';
import TimelineSignal from './timeline/TimelineSignal';

/**
 * TheClock — lesson-17 scene.
 *
 * The CPU's heartbeat. A single bit (clk) that oscillates on/off, plus two
 * derived signals that the rest of the CPU actually uses:
 *
 *   clk_e (clock enable) — wider pulse than clk; high while the bus is being
 *                          driven by an enabled register.
 *   clk_s (clock set)    — narrower pulse than clk, landing inside the
 *                          enable window; high only when the bus has settled
 *                          and a destination should latch the value.
 *
 * Construction follows Scott's book: we discretize one full clock period as
 * 4 ticks, and use a delayed copy of clk to derive the other two signals.
 *
 *   tick 0 1 2 3 …
 *   clk    0 1 1 0
 *   clk_d  0 0 1 1     (clk delayed by 1 tick)
 *   clk_e  0 1 1 1     (clk OR clk_d  — wider)
 *   clk_s  0 0 1 0     (clk AND clk_d — narrower, landing in the middle)
 *
 * Each tick of the visualization corresponds to a quarter-period of the
 * actual clock. We render 16 ticks (= 4 full clock periods) so the
 * repetition is obvious.
 */

const TIMELINE_LENGTH = 16;
const PERIOD = 4;
const DEFAULT_RATE_MS = 600;
const MIN_RATE_MS = 200;
const MAX_RATE_MS = 1600;
const STORAGE_KEY = 'hciw:the-clock:state';

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

// Each row is a 16-cell repeating pattern. Cell `i`'s bit is determined by
// (i mod 4): tick within the period.
function clkAt(i: number): Bit {
  const phase = i % PERIOD;
  return phase === 1 || phase === 2 ? 1 : 0;
}
function clkDAt(i: number): Bit {
  const phase = i % PERIOD;
  return phase === 2 || phase === 3 ? 1 : 0;
}
function clkEAt(i: number): Bit {
  return clkAt(i) === 1 || clkDAt(i) === 1 ? 1 : 0;
}
function clkSAt(i: number): Bit {
  return clkAt(i) === 1 && clkDAt(i) === 1 ? 1 : 0;
}

function buildRow(fn: (i: number) => Bit): Bit[] {
  const out: Bit[] = [];
  for (let i = 0; i < TIMELINE_LENGTH; i++) out.push(fn(i));
  return out;
}

const CLK_ROW = buildRow(clkAt);
const CLK_E_ROW = buildRow(clkEAt);
const CLK_S_ROW = buildRow(clkSAt);

export default function TheClock() {
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

  const phase = tick % PERIOD;
  const phaseLabel = ['rest', 'enable rising', 'capture', 'enable falling'][phase];

  return (
    <div className="not-prose mx-auto my-12 w-full max-w-[760px] text-apple-text">
      <div className="rounded-xl border border-apple-border bg-white p-5">
        <div className="space-y-3">
          <TimelineSignal label="clk" bits={CLK_ROW} activeIndex={tick} />
          <TimelineSignal label="clk_e" bits={CLK_E_ROW} activeIndex={tick} />
          <TimelineSignal label="clk_s" bits={CLK_S_ROW} activeIndex={tick} />
        </div>

        <p className="mt-4 text-center text-sm text-apple-text-secondary" aria-live="polite">
          Tick{' '}
          <output
            aria-label="current tick"
            className="font-mono font-semibold text-apple-text"
          >
            {tick}
          </output>{' '}
          of {TIMELINE_LENGTH} · phase{' '}
          <output
            aria-label="current phase"
            className="font-mono text-apple-text"
          >
            {phase}
          </output>{' '}
          ({phaseLabel})
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
            // The slider is "speed" not "delay", so we invert the displayed direction:
            // slider all the way left = slow (large rateMs), all the way right = fast (small rateMs).
            // To keep things simple we just keep the direct mapping but label both ends.
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
        <p className="mt-1 text-center text-[11px] text-apple-text-secondary">
          A real CPU ticks roughly a billion times per second. We&rsquo;re running at hand-readable speed.
        </p>
      </div>
    </div>
  );
}
