import { useState, useEffect } from 'react';

/**
 * Interactive NAND gate widget.
 *
 * Two clickable inputs (a, b). Output is NOT(a AND b).
 *
 * Pattern notes for future components:
 *  - Default-exported, no required props.
 *  - State managed locally with useState.
 *  - Persists last-seen state to localStorage so the lesson resumes where the learner left off.
 *  - Fully keyboard-operable: inputs are <button> elements, focusable, toggleable with Space/Enter.
 *  - Color is paired with text labels (1/0) so it's not the only signal.
 *  - SVG is decorative; the canonical state lives in the buttons and an aria-live output region.
 */

const STORAGE_KEY = 'hciw:nand-gate:state';

type Bit = 0 | 1;

function loadInitial(): { a: Bit; b: Bit } {
  if (typeof window === 'undefined') return { a: 0, b: 0 };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { a: 0, b: 0 };
    const parsed = JSON.parse(raw) as { a: Bit; b: Bit };
    if ((parsed.a === 0 || parsed.a === 1) && (parsed.b === 0 || parsed.b === 1)) {
      return parsed;
    }
  } catch {
    // Invalid storage — ignore and start fresh. Don't throw on the learner.
  }
  return { a: 0, b: 0 };
}

export default function NandGate() {
  const [{ a, b }, setState] = useState<{ a: Bit; b: Bit }>({ a: 0, b: 0 });

  // Hydrate from localStorage after mount (avoids SSR/CSR mismatch).
  useEffect(() => {
    setState(loadInitial());
  }, []);

  // Persist on change.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ a, b }));
    } catch {
      // localStorage may be disabled (private mode, etc.). Continue silently.
    }
  }, [a, b]);

  const out: Bit = a === 1 && b === 1 ? 0 : 1;

  const toggle = (which: 'a' | 'b') => {
    setState((prev) => ({ ...prev, [which]: prev[which] === 1 ? 0 : 1 }));
  };

  return (
    <div className="not-prose my-12 rounded-2xl border border-apple-border bg-white p-8 text-apple-text">
      <div className="mb-6 text-xs font-semibold uppercase tracking-widest text-apple-text-secondary">
        Try it — toggle the inputs
      </div>

      <div className="flex items-center justify-center gap-8">
        {/* Input column */}
        <div className="flex flex-col gap-3">
          <InputButton label="A" value={a} onToggle={() => toggle('a')} />
          <InputButton label="B" value={b} onToggle={() => toggle('b')} />
        </div>

        {/* Gate visualization (decorative) */}
        <svg
          viewBox="0 0 120 80"
          className="h-24 w-32 text-apple-text-secondary"
          aria-hidden="true"
          role="presentation"
        >
          {/* Wires from inputs */}
          <line x1="0" y1="25" x2="30" y2="25" stroke="currentColor" strokeWidth="1.5" />
          <line x1="0" y1="55" x2="30" y2="55" stroke="currentColor" strokeWidth="1.5" />

          {/* AND-gate body (D shape) */}
          <path
            d="M 30 10 L 60 10 A 30 30 0 0 1 60 70 L 30 70 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />

          {/* NOT bubble */}
          <circle
            cx="95"
            cy="40"
            r="5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />

          {/* Output wire */}
          <line x1="100" y1="40" x2="120" y2="40" stroke="currentColor" strokeWidth="1.5" />
        </svg>

        {/* Output indicator */}
        <Output value={out} />
      </div>

      {/* Truth-table reference */}
      <div
        className="mt-8 text-center font-mono text-sm text-apple-text-secondary"
        aria-live="polite"
      >
        NAND({a}, {b}) = {out}
      </div>
    </div>
  );
}

function InputButton({
  label,
  value,
  onToggle,
}: {
  label: string;
  value: Bit;
  onToggle: () => void;
}) {
  const isOn = value === 1;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={`Input ${label}, currently ${value}. Click to toggle.`}
      aria-pressed={isOn}
      className={`flex h-12 w-24 items-center justify-center gap-2 rounded-xl border font-mono text-base font-semibold transition-all duration-300 motion-reduce:transition-none ${
        isOn
          ? 'border-apple-blue bg-apple-blue text-white shadow-[0_2px_8px_rgba(0,113,227,0.25)]'
          : 'border-apple-border bg-white text-apple-text-secondary hover:border-apple-text-secondary hover:text-apple-text'
      } focus:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue focus-visible:ring-offset-2 focus-visible:ring-offset-white`}
    >
      <span className="opacity-70">{label}</span>
      <span>{value}</span>
    </button>
  );
}

function Output({ value }: { value: Bit }) {
  const isOn = value === 1;
  return (
    <div
      role="status"
      aria-label={`Output: ${value}`}
      className={`flex h-16 w-16 items-center justify-center rounded-full border font-mono text-2xl font-semibold transition-all duration-300 motion-reduce:transition-none ${
        isOn
          ? 'border-apple-blue bg-apple-blue text-white shadow-[0_2px_12px_rgba(0,113,227,0.3)]'
          : 'border-apple-border bg-white text-apple-text-secondary'
      }`}
    >
      {value}
    </div>
  );
}
