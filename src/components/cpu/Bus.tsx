import type { BusSnapshot } from '../../lib/cpu/types';

/**
 * Bus — the CPU's central data wire, drawn as a horizontal bar.
 *
 * Shows whatever value is currently being driven onto it (from a register's
 * 'enable' action this step), or '—' if there's no driver. The driving
 * source is labeled at the right end so the learner can see the protocol
 * "X is enabled, X's value is on the bus."
 */

interface Props {
  bus: BusSnapshot;
}

function toBinary(n: number): string {
  const s = (n & 0xff).toString(2).padStart(8, '0');
  return `${s.slice(0, 4)} ${s.slice(4)}`;
}

export default function Bus({ bus }: Props) {
  const hasDriver = bus.value !== null && bus.source !== null;
  return (
    <div
      data-driver={bus.source ?? ''}
      className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-2 transition-colors duration-150 motion-reduce:transition-none ${
        hasDriver
          ? 'border-emerald-500 bg-emerald-50/60'
          : 'border-apple-border bg-apple-bg/30'
      }`}
    >
      <span className="font-mono text-xs font-semibold uppercase tracking-widest text-apple-text-secondary">
        bus
      </span>
      <div className="flex flex-1 items-baseline justify-center gap-3">
        <output
          aria-label="bus value"
          className="font-mono text-base font-semibold text-apple-text"
        >
          {bus.value ?? '—'}
        </output>
        <span className="font-mono text-[11px] text-apple-text-secondary">
          {bus.value !== null ? toBinary(bus.value) : '— — — —'}
        </span>
      </div>
      <span className="font-mono text-[11px] text-apple-text-secondary">
        {hasDriver ? `driven by ${bus.source}` : 'no driver'}
      </span>
    </div>
  );
}
