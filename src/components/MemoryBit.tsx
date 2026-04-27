import { useEffect, useRef, useState } from 'react';
import type { Bit } from '../lib/gates/types';
import GateSymbol from './gates/GateSymbol';
import Wire from './gates/Wire';
import { Bulb } from './gates/OutputBulb';

/**
 * MemoryBit — lesson-8 scene.
 *
 * A self-contained cross-coupled NAND set–reset latch. Deliberately built
 * outside the shared Circuit/simulator infrastructure: the shared simulator
 * rejects feedback loops on purpose (its acyclic-only contract is what makes
 * cycle detection in CircuitEditor reliable). This widget hard-codes the
 * latch's state machine so we can demonstrate feedback without weakening that
 * contract.
 *
 *   - Two clickable buttons pulse the latch's "Set" or "Reset" line low for a
 *     brief moment, then return to high. The persistent state Q updates on
 *     pulse start; releasing the button leaves Q in its new state.
 *   - Q and Q-bar are derived from the latch's NAND truth table given the
 *     pulse state and the persistent Q. Outside a pulse, Q-bar is the
 *     complement of Q.
 *   - The cross-coupled wires (top output → bottom in, bottom output → top in)
 *     are always carrying live values, which is the entire point of the
 *     lesson: they ARE the memory.
 */

const STORAGE_KEY = 'hciw:memory-bit:state';
const PULSE_MS = 280;

type Pulse = 'set' | 'reset' | null;

interface PersistedState {
  q: Bit;
}

const DEFAULT_STATE: PersistedState = { q: 0 };

function loadState(): PersistedState {
  if (typeof window === 'undefined') return DEFAULT_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return { q: parsed.q === 1 ? 1 : 0 };
  } catch {
    return DEFAULT_STATE;
  }
}

// SVG layout — kept generous so the cross-coupled feedback wires have room
// to curve around the gates without overlapping inputs/outputs.
const CANVAS_W = 600;
const CANVAS_H = 320;
const TOP_NAND = { x: 300, y: 100 };
const BOT_NAND = { x: 300, y: 220 };

// Local gate ports relative to GateSymbol's center (see GateSymbol comments).
const IN1 = { dx: -28, dy: -10 };
const IN2 = { dx: -28, dy: 10 };
const OUT = { dx: 32, dy: 0 };

function port(
  gate: { x: number; y: number },
  which: 'in1' | 'in2' | 'out',
): { x: number; y: number } {
  const off = which === 'in1' ? IN1 : which === 'in2' ? IN2 : OUT;
  return { x: gate.x + off.dx, y: gate.y + off.dy };
}

export default function MemoryBit() {
  const [q, setQ] = useState<Bit>(0);
  const [pulse, setPulse] = useState<Pulse>(null);
  const [hydrated, setHydrated] = useState(false);
  const pulseTimer = useRef<number | null>(null);

  // Hydrate persisted state on mount.
  useEffect(() => {
    setQ(loadState().q);
    setHydrated(true);
    return () => {
      if (pulseTimer.current !== null) window.clearTimeout(pulseTimer.current);
    };
  }, []);

  // Persist q whenever it changes (after hydration).
  useEffect(() => {
    if (!hydrated) return;
    try {
      const state: PersistedState = { q };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore — localStorage may be disabled
    }
  }, [hydrated, q]);

  function triggerPulse(kind: 'set' | 'reset') {
    if (pulseTimer.current !== null) {
      window.clearTimeout(pulseTimer.current);
    }
    setQ(kind === 'set' ? 1 : 0);
    setPulse(kind);
    pulseTimer.current = window.setTimeout(() => {
      setPulse(null);
      pulseTimer.current = null;
    }, PULSE_MS);
  }

  function reset() {
    if (pulseTimer.current !== null) {
      window.clearTimeout(pulseTimer.current);
      pulseTimer.current = null;
    }
    setPulse(null);
    setQ(0);
    // The persist effect rewrites localStorage to { q: 0 } on the next render,
    // so there's no need to remove the entry explicitly — and doing so would
    // race with the effect.
  }

  // Live wire values derived from button pulses + persistent q.
  // The set/reset lines rest at HIGH (1) and pulse LOW (0) when their button
  // is pressed. The two NANDs implement the SR latch.
  const sLine: Bit = pulse === 'set' ? 0 : 1;
  const rLine: Bit = pulse === 'reset' ? 0 : 1;

  // Derive displayed Q and Q-bar from inputs. Outside a pulse, Q follows the
  // persistent state and Q-bar is its complement. During a pulse, the latch
  // settles to its driven state.
  let qDisplay: Bit;
  let qbarDisplay: Bit;
  if (sLine === 0 && rLine === 1) {
    qDisplay = 1;
    qbarDisplay = 0;
  } else if (sLine === 1 && rLine === 0) {
    qDisplay = 0;
    qbarDisplay = 1;
  } else if (sLine === 0 && rLine === 0) {
    // Forbidden state: both NANDs go high since either input being 0 forces
    // the output to 1. We don't expose this to the learner — buttons can't
    // both pulse at the same time given how triggerPulse cancels — but if it
    // ever happened, this is what the gates would say.
    qDisplay = 1;
    qbarDisplay = 1;
  } else {
    qDisplay = q;
    qbarDisplay = q === 1 ? 0 : 1;
  }

  // Wire endpoints
  const topIn1 = port(TOP_NAND, 'in1');
  const topIn2 = port(TOP_NAND, 'in2');
  const topOut = port(TOP_NAND, 'out');
  const botIn1 = port(BOT_NAND, 'in1');
  const botIn2 = port(BOT_NAND, 'in2');
  const botOut = port(BOT_NAND, 'out');

  // Set button feeds the top NAND's in1; Reset button feeds the bottom
  // NAND's in2. Visually, the buttons live at the left edge of the canvas
  // (HTML overlay) and each wire emerges just to the right of its button.
  const setButtonRight = { x: 92, y: topIn1.y };
  const resetButtonRight = { x: 92, y: botIn2.y };

  // Bulbs on the right
  const qBulbCenter = { x: 510, y: topOut.y };
  const qbarBulbCenter = { x: 510, y: botOut.y };

  return (
    <div className="not-prose mx-auto my-12 w-full max-w-[760px] text-apple-text">
      <section className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-apple-text-secondary">
          Try this
        </p>
        <p className="mt-2 text-base leading-relaxed text-apple-text">
          Click <strong>Set</strong>, then look at Q. It is on. Now do nothing.
          It stays on. Click <strong>Reset</strong>: Q goes off, and stays off.
          The buttons are momentary — they only act when clicked — yet the
          latch remembers what you last told it.
        </p>
      </section>

      <div className="overflow-x-auto pb-1">
        <div
          className="relative rounded-xl border border-apple-border bg-[#f5f5f7] p-4"
          style={{ width: CANVAS_W + 32, height: CANVAS_H + 32 }}
        >
          <svg
            viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
            width={CANVAS_W}
            height={CANVAS_H}
            className="block select-none text-apple-text"
            aria-hidden="true"
          >
            {/* Set line (button → top NAND in1) */}
            <Wire from={setButtonRight} to={topIn1} active={sLine === 1} />

            {/* Reset line (button → bottom NAND in2) */}
            <Wire
              from={resetButtonRight}
              to={botIn2}
              active={rLine === 1}
            />

            {/* Cross-couple: top out → bottom in1 (carries Q). The Bezier
                naturally bows out to the right, passing through the gap
                between the two gates without overlapping their bodies. */}
            <Wire from={topOut} to={botIn1} active={qDisplay === 1} />

            {/* Cross-couple: bottom out → top in2 (carries Q-bar) */}
            <Wire from={botOut} to={topIn2} active={qbarDisplay === 1} />

            {/* Branch from top out to Q bulb (stop just outside the bulb body
                so the wire doesn't visually pass through the circle) */}
            <Wire
              from={topOut}
              to={{ x: qBulbCenter.x - 22, y: qBulbCenter.y }}
              active={qDisplay === 1}
            />

            {/* Branch from bottom out to Q-bar bulb */}
            <Wire
              from={botOut}
              to={{ x: qbarBulbCenter.x - 22, y: qbarBulbCenter.y }}
              active={qbarDisplay === 1}
            />

            {/* Junction dots where each NAND output forks (output + cross-couple) */}
            <circle
              cx={topOut.x}
              cy={topOut.y}
              r="4"
              className="transition-colors duration-300 motion-reduce:transition-none"
              style={{ fill: qDisplay === 1 ? '#0071e3' : '#1d1d1f' }}
            />
            <circle
              cx={botOut.x}
              cy={botOut.y}
              r="4"
              className="transition-colors duration-300 motion-reduce:transition-none"
              style={{ fill: qbarDisplay === 1 ? '#0071e3' : '#1d1d1f' }}
            />

            {/* Gates (drawn last so they sit on top of wires) */}
            <GateSymbol kind="NAND" x={TOP_NAND.x} y={TOP_NAND.y} />
            <GateSymbol kind="NAND" x={BOT_NAND.x} y={BOT_NAND.y} />

            {/* Output labels next to the bulbs */}
            <text
              x={qBulbCenter.x + 38}
              y={qBulbCenter.y + 4}
              fontSize="14"
              fontWeight="600"
              fill="#1d1d1f"
              stroke="none"
            >
              Q
            </text>
            <text
              x={qbarBulbCenter.x + 38}
              y={qbarBulbCenter.y + 4}
              fontSize="14"
              fontWeight="600"
              fill="#6e6e73"
              stroke="none"
            >
              Q̄
            </text>

            {/* Output bulbs */}
            <Bulb cx={qBulbCenter.x} cy={qBulbCenter.y} value={qDisplay} r={18} />
            <Bulb
              cx={qbarBulbCenter.x}
              cy={qbarBulbCenter.y}
              value={qbarDisplay}
              r={18}
            />
          </svg>

          {/* Buttons (HTML overlay, on top of the SVG) */}
          <PulseButton
            label="Set"
            top={topIn1.y - 22 + 16}
            pulsing={pulse === 'set'}
            onPress={() => triggerPulse('set')}
          />
          <PulseButton
            label="Reset"
            top={botIn2.y - 22 + 16}
            pulsing={pulse === 'reset'}
            onPress={() => triggerPulse('reset')}
          />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-apple-text-secondary">
        <span aria-live="polite">
          Stored bit: <strong className="text-apple-text">{q}</strong>
          {pulse && (
            <span className="ml-2 text-apple-blue">
              {pulse === 'set' ? '— Set pulse' : '— Reset pulse'}
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={reset}
          className="rounded-full border border-apple-border bg-white px-4 py-1.5 text-xs font-medium text-apple-text-secondary transition-colors duration-200 hover:text-apple-text focus:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue focus-visible:ring-offset-2 motion-reduce:transition-none"
        >
          Reset to 0
        </button>
      </div>
    </div>
  );
}

function PulseButton({
  label,
  top,
  pulsing,
  onPress,
}: {
  label: string;
  top: number;
  pulsing: boolean;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={`${label} the memory bit`}
      className={`absolute left-4 flex h-11 w-20 items-center justify-center rounded-lg border text-sm font-semibold transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue focus-visible:ring-offset-2 motion-reduce:transition-none ${
        pulsing
          ? 'border-apple-blue bg-apple-blue text-white shadow-md'
          : 'border-apple-border bg-white text-apple-text hover:border-apple-blue/40'
      }`}
      style={{ top }}
    >
      {label}
    </button>
  );
}

