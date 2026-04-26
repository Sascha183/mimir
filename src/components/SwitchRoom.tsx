import { useEffect, useState } from 'react';
import { Bulb } from './gates/OutputBulb';

/**
 * SwitchRoom — discovery + verification widget for the NAND-gate lesson.
 *
 * Two parts:
 *   1. A "room" the learner can manipulate freely: two iOS-style toggles
 *      and a ceiling light. The light follows the NAND rule.
 *   2. A truth table the learner fills in from observation, with gentle
 *      verification feedback once all four answer cells are non-empty.
 *
 * Pattern shared with NandGate.tsx:
 *   - Default-exported, no required props.
 *   - State managed locally.
 *   - Persists progress to localStorage; hydrates after mount to avoid SSR mismatch.
 *   - Fully keyboard-operable; toggles use role="switch" with aria-checked.
 *   - aria-live status node announces the light state to screen readers.
 *   - Color is paired with text so it is never the only signal.
 */

const ROOM_KEY = 'hciw:switch-room:room';
const ANSWERS_KEY = 'hciw:switch-room:answers';

type Bit = 'on' | 'off';
type CellValue = Bit | null;
type Room = { a: Bit; b: Bit };
type Answers = [CellValue, CellValue, CellValue, CellValue];

const ROWS: Array<{ a: Bit; b: Bit; expected: Bit }> = [
  { a: 'off', b: 'off', expected: 'on' },
  { a: 'off', b: 'on', expected: 'on' },
  { a: 'on', b: 'off', expected: 'on' },
  { a: 'on', b: 'on', expected: 'off' },
];

function nandLight(a: Bit, b: Bit): Bit {
  return a === 'on' && b === 'on' ? 'off' : 'on';
}

function cycleCell(value: CellValue): CellValue {
  if (value === null) return 'off';
  if (value === 'off') return 'on';
  return 'off';
}

function loadRoom(): Room {
  if (typeof window === 'undefined') return { a: 'off', b: 'off' };
  try {
    const raw = window.localStorage.getItem(ROOM_KEY);
    if (!raw) return { a: 'off', b: 'off' };
    const parsed = JSON.parse(raw) as Room;
    const ok = (v: unknown): v is Bit => v === 'on' || v === 'off';
    if (ok(parsed.a) && ok(parsed.b)) return parsed;
  } catch {
    // Invalid storage — start fresh.
  }
  return { a: 'off', b: 'off' };
}

function loadAnswers(): Answers {
  const empty: Answers = [null, null, null, null];
  if (typeof window === 'undefined') return empty;
  try {
    const raw = window.localStorage.getItem(ANSWERS_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as unknown;
    if (
      Array.isArray(parsed) &&
      parsed.length === 4 &&
      parsed.every((v) => v === null || v === 'on' || v === 'off')
    ) {
      return parsed as Answers;
    }
  } catch {
    // Invalid storage — start fresh.
  }
  return empty;
}

export default function SwitchRoom() {
  const [room, setRoom] = useState<Room>({ a: 'off', b: 'off' });
  const [answers, setAnswers] = useState<Answers>([null, null, null, null]);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage after mount. The `hydrated` flag prevents the
  // persistence effects below from clobbering localStorage with default state
  // before the load has a chance to run.
  useEffect(() => {
    setRoom(loadRoom());
    setAnswers(loadAnswers());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(ROOM_KEY, JSON.stringify(room));
    } catch {
      // localStorage may be disabled — continue silently.
    }
  }, [hydrated, room]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(ANSWERS_KEY, JSON.stringify(answers));
    } catch {
      // localStorage may be disabled — continue silently.
    }
  }, [hydrated, answers]);

  const light = nandLight(room.a, room.b);
  const allFilled = answers.every((a) => a !== null);
  const isCorrect =
    allFilled && answers.every((a, i) => a === ROWS[i].expected);

  const toggle = (which: 'a' | 'b') => {
    setRoom((prev) => ({
      ...prev,
      [which]: prev[which] === 'on' ? 'off' : 'on',
    }));
  };

  const onCell = (idx: number) => {
    setAnswers((prev) => {
      const next = [...prev] as Answers;
      next[idx] = cycleCell(prev[idx]);
      return next;
    });
  };

  return (
    <div className="not-prose mx-auto my-12 w-full max-w-[640px] text-apple-text">
      {/* Room scene */}
      <div className="relative mx-auto w-full max-w-[480px]">
        <svg
          viewBox="0 0 480 320"
          className="block h-auto w-full"
          aria-hidden="true"
          role="presentation"
        >
          {/* Wall outline */}
          <rect
            x="20"
            y="20"
            width="440"
            height="280"
            rx="14"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
          />
          {/* Cord, cap, halo, and bulb body — shared with the gates library. */}
          <Bulb cx={240} cy={100} cordTop={20} value={light === 'on' ? 1 : 0} />
        </svg>

        {/* Toggles overlaid on the lower portion of the wall */}
        <div className="absolute inset-x-0 bottom-[14%] flex justify-center gap-12 sm:gap-20">
          {(['a', 'b'] as const).map((which) => (
            <div key={which} className="flex flex-col items-center">
              <ToggleSwitch
                label={which.toUpperCase()}
                value={room[which]}
                onToggle={() => toggle(which)}
              />
              <p className="mt-2 text-xs text-apple-text-secondary">
                Switch {which.toUpperCase()}
              </p>
            </div>
          ))}
        </div>

        {/* Visually hidden status announcement for screen readers */}
        <span role="status" aria-live="polite" className="sr-only">
          Light is {light}
        </span>
      </div>

      <p className="my-4 text-center text-sm italic text-apple-text-secondary">
        Try to turn off the light. There's a rule hidden in this room — find it.
      </p>

      {/* Truth table */}
      <div className="mt-12">
        <h3 className="text-center text-xl font-semibold text-apple-text">
          Now write down the rule
        </h3>
        <p className="mb-6 mt-2 text-center text-sm text-apple-text-secondary">
          Click each cell to toggle between &ldquo;off&rdquo; and &ldquo;on&rdquo;.
        </p>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="border-b border-apple-border px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-apple-text-secondary">
                Switch A
              </th>
              <th className="border-b border-apple-border px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-apple-text-secondary">
                Switch B
              </th>
              <th className="border-b border-apple-border px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-apple-text-secondary">
                Light
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, idx) => {
              const value = answers[idx];
              return (
                <tr key={idx}>
                  <td className="border-b border-apple-border/60 px-4 py-3 text-base font-medium text-apple-text">
                    {row.a}
                  </td>
                  <td className="border-b border-apple-border/60 px-4 py-3 text-base font-medium text-apple-text">
                    {row.b}
                  </td>
                  <td className="border-b border-apple-border/60 px-2 py-2">
                    <button
                      type="button"
                      onClick={() => onCell(idx)}
                      aria-label={`Row ${idx + 1}, Light value, currently ${
                        value ?? 'empty'
                      }. Click to cycle.`}
                      className={`w-full rounded-md px-3 py-2 text-left text-base ring-1 ring-apple-border transition-colors duration-200 hover:bg-apple-bg/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue focus-visible:ring-offset-2 motion-reduce:transition-none ${
                        value === null
                          ? 'text-apple-text-secondary'
                          : 'font-medium text-apple-text'
                      }`}
                    >
                      {value ?? '—'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Verification feedback */}
      <div className="mt-6 min-h-[80px]">
        {allFilled && !isCorrect && (
          <p className="text-center text-apple-text-secondary">
            Not quite. Try each switch combination in the room above and watch the light.
          </p>
        )}
        {allFilled && isCorrect && <SuccessBlock />}
      </div>
    </div>
  );
}

function ToggleSwitch({
  label,
  value,
  onToggle,
}: {
  label: string;
  value: Bit;
  onToggle: () => void;
}) {
  const isOn = value === 'on';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isOn}
      aria-label={`Switch ${label}, currently ${value}. Click to toggle.`}
      onClick={onToggle}
      className={`relative inline-flex h-9 w-16 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue focus-visible:ring-offset-2 focus-visible:ring-offset-apple-bg motion-reduce:transition-none ${
        isOn ? 'bg-apple-blue' : 'bg-apple-border'
      }`}
    >
      <span
        className={`inline-block h-7 w-7 transform rounded-full bg-white shadow transition-transform duration-200 motion-reduce:transition-none ${
          isOn ? 'translate-x-8' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

function SuccessBlock() {
  // Mount at opacity 0, flip to 1 on the next frame so the CSS transition
  // has a starting point to animate from. motion-reduce zeroes the duration.
  const [opacity, setOpacity] = useState(0);
  useEffect(() => {
    const id = window.requestAnimationFrame(() => setOpacity(1));
    return () => window.cancelAnimationFrame(id);
  }, []);

  return (
    <div
      className="rounded-xl bg-green-50/60 p-6 transition-opacity duration-500 motion-reduce:duration-0"
      style={{ opacity }}
    >
      <div className="flex items-start gap-4">
        <svg
          className="mt-1 h-6 w-6 flex-shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#16a34a"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 13l4 4L19 7" />
        </svg>
        <div>
          <h4 className="text-xl font-semibold text-apple-text">That's it.</h4>
          <p className="mt-2 max-w-prose leading-relaxed text-apple-text">
            You've just discovered the rule a NAND gate follows. The light is off only when
            both switches are on. Three out of four combinations leave the light on — only the
            "both on" case turns it off. This single rule, applied billions of times across
            tiny electronic switches, is the foundation of every computer ever built. The
            switches you just clicked are inputs. The light is the output. The room is a NAND
            gate.
          </p>
        </div>
      </div>
    </div>
  );
}
