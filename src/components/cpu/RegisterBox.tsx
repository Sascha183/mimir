/**
 * RegisterBox — a labeled register cell for the CPU diagram.
 *
 * Visually conveys two pieces of info per render:
 *   - the register's current value (decimal + binary)
 *   - whether it's idle / being driven onto the bus / being captured this step
 *
 * The state colors match the chip palette in lesson 19: enable=green, set=blue.
 */

export type RegisterBoxState = 'idle' | 'enabled' | 'set';

interface Props {
  name: string;
  value: number;
  state?: RegisterBoxState;
  /** Optional secondary label, e.g. "instruction reg". */
  hint?: string;
}

const STATE_CLASSES: Record<RegisterBoxState, string> = {
  idle: 'border-apple-border bg-apple-surface',
  enabled: 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/40',
  set: 'border-apple-blue bg-apple-blue/10 ring-2 ring-apple-blue/40',
};

function toBinary(n: number): string {
  const s = (n & 0xff).toString(2).padStart(8, '0');
  return `${s.slice(0, 4)} ${s.slice(4)}`;
}

export default function RegisterBox({ name, value, state = 'idle', hint }: Props) {
  return (
    <div
      data-register={name}
      data-state={state}
      className={`rounded-lg border px-3 py-2 transition-colors duration-150 motion-reduce:transition-none ${STATE_CLASSES[state]}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-xs font-semibold tracking-wide text-apple-text">
          {name}
        </span>
        {hint ? (
          <span className="text-[10px] text-apple-text-secondary">{hint}</span>
        ) : null}
      </div>
      <div className="mt-1 text-center">
        <output
          aria-label={`${name} value`}
          className="font-mono text-base font-semibold text-apple-text"
        >
          {value}
        </output>
      </div>
      <div className="text-center font-mono text-[10px] text-apple-text-secondary">
        {toBinary(value)}
      </div>
    </div>
  );
}
