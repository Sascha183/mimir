import { useEffect, useRef, useState } from 'react';

/**
 * OperationsCounter — visceral demonstration of "operations per second".
 *
 * The reader picks a speed (1, 1k, or 1M per second). A counter ticks up
 * accordingly, and a 40×25 dot grid (1,000 dots) fills left-to-right, top-to-
 * bottom in apple-blue. When the grid fills, it visually wraps and starts
 * over while the underlying count keeps growing.
 *
 * Below the count we print "if you counted one per second, this would have
 * taken: X" to ground the abstract number in a human timescale. At 1M/sec
 * the duration text rockets through minutes/hours/days/years within seconds.
 *
 * Implementation notes:
 *   - rAF loop, not setInterval, for smooth animation.
 *   - Per-frame count increment uses elapsed dt × speed, so missed frames
 *     don't shrink the animation. dt is capped at 0.1s so background-tab
 *     resumes don't produce an absurd jump.
 *   - The dot grid is a Canvas. Updates are incremental: at low speeds we
 *     light up only the freshly-crossed dots; on a wrap (or at very high
 *     speeds where one frame crosses a full grid) we do a single full
 *     redraw. No redrawing all 1,000 dots each frame.
 *   - Persists count + speed to localStorage at most once per second.
 *   - prefers-reduced-motion hides the grid entirely; the count and duration
 *     keep updating.
 */

const STORAGE_KEY = 'hciw:operations-counter';

const COLS = 40;
const ROWS = 25;
const GRID_TOTAL = COLS * ROWS; // 1,000
const CELL = 12; // CSS px per cell — 40×12 = 480, 25×12 = 300
const DOT_R = 3;
const CANVAS_W = COLS * CELL;
const CANVAS_H = ROWS * CELL;

// Resolve theme tokens at draw time. Canvas doesn't honor CSS variables, so
// we read the resolved RGB values off the document element and reconstruct
// concrete `rgb()` strings. This automatically picks up dark/light mode.
function readColor(varName: string): string {
  if (typeof window === 'undefined') return '#0071e3'; // SSR fallback
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
  return raw ? `rgb(${raw})` : '#0071e3';
}

type Speed = 1 | 1000 | 1000000;
const SPEEDS: Speed[] = [1, 1000, 1000000];

interface PersistedState {
  count: number;
  speed: Speed;
}

function loadState(): PersistedState {
  if (typeof window === 'undefined') return { count: 0, speed: 1 };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { count: 0, speed: 1 };
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    const count =
      typeof parsed.count === 'number' && parsed.count >= 0 && Number.isFinite(parsed.count)
        ? parsed.count
        : 0;
    const speed: Speed =
      parsed.speed === 1 || parsed.speed === 1000 || parsed.speed === 1000000
        ? parsed.speed
        : 1;
    return { count, speed };
  } catch {
    return { count: 0, speed: 1 };
  }
}

/**
 * Convert a number of seconds to a human-friendly duration string.
 * Exported for direct unit testing.
 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 1) return '0 seconds';

  if (seconds < 60) {
    const s = Math.round(seconds);
    return `${s} second${s === 1 ? '' : 's'}`;
  }
  const minutes = seconds / 60;
  if (minutes < 60) {
    const m = Math.round(minutes);
    return `${m} minute${m === 1 ? '' : 's'}`;
  }
  const hours = minutes / 60;
  if (hours < 24) {
    const h = Math.round(hours);
    return `${h} hour${h === 1 ? '' : 's'}`;
  }
  const days = hours / 24;
  if (days < 30) {
    const d = Math.round(days);
    return `${d} day${d === 1 ? '' : 's'}`;
  }
  if (days < 365) {
    const months = Math.round(days / 30.44);
    return `${months} month${months === 1 ? '' : 's'}`;
  }
  const years = days / 365.25;
  if (years < 100) {
    const y = Math.round(years);
    return `${y} year${y === 1 ? '' : 's'}`;
  }
  // ≥ 100 years: round to the nearest hundred for visual cadence.
  const rounded = Math.round(years / 100) * 100;
  return `${rounded.toLocaleString('en-US')} years`;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = () => setReduced(mq.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);
  return reduced;
}

export default function OperationsCounter() {
  const [count, setCount] = useState(0);
  const [speed, setSpeed] = useState<Speed>(1);
  const [hydrated, setHydrated] = useState(false);

  // Mutable mirror of count/speed for the rAF loop. We avoid re-creating the
  // animation effect every time count changes (which would happen 60×/sec)
  // by reading these from refs inside the loop.
  const countRef = useRef(0);
  const speedRef = useRef<Speed>(1);
  const lastFrameRef = useRef(0);
  const lastSaveRef = useRef(0);

  // Canvas state for incremental drawing.
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const lastLitRef = useRef(0);
  const lastDrawnIntRef = useRef(0);

  const reducedMotion = useReducedMotion();

  // Hydrate from localStorage after mount.
  useEffect(() => {
    const loaded = loadState();
    countRef.current = loaded.count;
    speedRef.current = loaded.speed;
    setCount(Math.floor(loaded.count));
    setSpeed(loaded.speed);
    setHydrated(true);
  }, []);

  // Keep the speed ref in sync with state changes.
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  // One-time canvas setup (DPR scaling + initial draw).
  useEffect(() => {
    if (reducedMotion) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;
    canvas.style.width = `${CANVAS_W}px`;
    canvas.style.height = `${CANVAS_H}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctxRef.current = ctx;

    const lit = Math.floor(countRef.current) % GRID_TOTAL;
    drawAllDots(ctx, lit);
    lastLitRef.current = lit;
    lastDrawnIntRef.current = Math.floor(countRef.current);
  }, [hydrated, reducedMotion]);

  // Animation loop. Re-installs only when reducedMotion or hydrated flips,
  // not on every count change.
  useEffect(() => {
    if (!hydrated) return;

    let cancelled = false;
    let rafId = 0;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const advance = (now: number) => {
      const last = lastFrameRef.current || now;
      const dt = Math.min((now - last) / 1000, 0.1);
      lastFrameRef.current = now;
      countRef.current += dt * speedRef.current;
      setCount(Math.floor(countRef.current));

      if (!reducedMotion) {
        const ctx = ctxRef.current;
        if (ctx) updateDots(ctx);
      }

      // Persist at most once per second.
      if (now - lastSaveRef.current > 1000) {
        lastSaveRef.current = now;
        try {
          window.localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
              count: countRef.current,
              speed: speedRef.current,
            }),
          );
        } catch {
          // localStorage may be disabled — continue silently.
        }
      }
    };

    if (reducedMotion) {
      // No motion: tick at a slow cadence (4Hz) so the count and duration
      // still update visibly without animating the grid.
      lastFrameRef.current = performance.now();
      intervalId = setInterval(() => {
        if (cancelled) return;
        advance(performance.now());
      }, 250);
    } else {
      lastFrameRef.current = performance.now();
      const tick = (t: number) => {
        if (cancelled) return;
        advance(t);
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
    }

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [hydrated, reducedMotion]);

  function selectSpeed(s: Speed) {
    setSpeed(s);
    speedRef.current = s;
    // Save immediately on user input so a quick reload doesn't lose the choice.
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ count: countRef.current, speed: s }),
      );
    } catch {
      // ignore
    }
  }

  function reset() {
    countRef.current = 0;
    setCount(0);
    setSpeed(1);
    speedRef.current = 1;
    lastLitRef.current = 0;
    lastDrawnIntRef.current = 0;
    const ctx = ctxRef.current;
    if (ctx) drawAllDots(ctx, 0);
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ count: 0, speed: 1 }),
      );
    } catch {
      // ignore
    }
  }

  // Incremental dot update. Reads countRef + lastLitRef + lastDrawnIntRef
  // from the closure so it's safe to call from inside the rAF loop without
  // re-creating handlers on every frame.
  function updateDots(ctx: CanvasRenderingContext2D) {
    const intCount = Math.floor(countRef.current);
    const diff = intCount - lastDrawnIntRef.current;
    if (diff <= 0) return;

    const newLit = intCount % GRID_TOTAL;

    if (diff >= GRID_TOTAL || newLit < lastLitRef.current) {
      // The grid wrapped at least once (or we crossed many grids in one frame).
      // Fastest correct thing is a single full redraw at the new state.
      drawAllDots(ctx, newLit);
    } else {
      // No wrap, no full grid crossed: light up only the newly-crossed dots.
      const litColor = readColor('--apple-blue');
      for (let i = lastLitRef.current; i < newLit; i++) {
        drawDot(ctx, i, litColor);
      }
    }

    lastLitRef.current = newLit;
    lastDrawnIntRef.current = intCount;
  }

  return (
    <div className="not-prose mx-auto my-12 w-full max-w-[640px] text-apple-text">
      {/* Counter display */}
      <div className="text-center">
        <output
          aria-label="operations performed so far"
          className="block font-mono text-4xl font-semibold tabular-nums tracking-tight"
        >
          {count.toLocaleString('en-US')}
        </output>
        <p className="mt-1 text-sm text-apple-text-secondary">operations performed</p>
        <p className="mt-3 text-sm text-apple-text-secondary">
          if you counted one per second, this would have taken{' '}
          <span className="font-medium text-apple-text">
            {formatDuration(count)}
          </span>
        </p>
      </div>

      {/* Dot grid */}
      {!reducedMotion && (
        <div className="mt-8 flex flex-col items-center">
          <canvas
            ref={canvasRef}
            className="block max-w-full rounded-md"
            aria-hidden="true"
          />
          <p className="mt-3 text-xs text-apple-text-secondary">
            Each dot is one operation. This grid holds 1,000.
          </p>
        </div>
      )}

      {/* Speed controls */}
      <div className="mt-8 flex flex-col items-center gap-3">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {SPEEDS.map((s) => (
            <SpeedButton
              key={s}
              active={speed === s}
              onClick={() => selectSpeed(s)}
            >
              {labelForSpeed(s)}
            </SpeedButton>
          ))}
        </div>
        <p className="text-xs text-apple-text-secondary">
          A modern CPU does billions of these per second.
        </p>
        <button
          type="button"
          onClick={reset}
          className="rounded-full border border-apple-border bg-apple-surface px-4 py-1.5 text-xs font-medium text-apple-text-secondary transition-colors duration-200 hover:text-apple-text focus:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue focus-visible:ring-offset-2 motion-reduce:transition-none"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

function labelForSpeed(s: Speed): string {
  if (s === 1) return '1 per second';
  if (s === 1000) return '1,000 per second';
  return '1,000,000 per second';
}

function SpeedButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue focus-visible:ring-offset-2 motion-reduce:transition-none ${
        active
          ? 'bg-apple-blue text-white'
          : 'border border-apple-border bg-apple-surface text-apple-text hover:border-apple-text-secondary'
      }`}
    >
      {children}
    </button>
  );
}

// ─── Canvas drawing helpers ────────────────────────────────────────────────

function drawAllDots(ctx: CanvasRenderingContext2D, lit: number) {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  const litColor = readColor('--apple-blue');
  const unlitColor = readColor('--apple-border');
  for (let i = 0; i < GRID_TOTAL; i++) {
    drawDot(ctx, i, i < lit ? litColor : unlitColor);
  }
}

function drawDot(ctx: CanvasRenderingContext2D, index: number, color: string) {
  const row = Math.floor(index / COLS);
  const col = index % COLS;
  const x = col * CELL + CELL / 2;
  const y = row * CELL + CELL / 2;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, DOT_R, 0, Math.PI * 2);
  ctx.fill();
}
