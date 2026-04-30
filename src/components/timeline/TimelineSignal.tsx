import type { Bit } from '../../lib/gates/types';

/**
 * TimelineSignal — reusable discrete-tick visualization primitive.
 *
 * Used by:
 *   - lesson 17 (the clock): three rows for clk / clk_e / clk_s
 *   - lesson 18 (the stepper): one row, the active cell IS the active step
 *   - lesson 20 (the instruction cycle): one row, cells are labeled with phase
 *
 * Renders a horizontal row of fixed-width cells. Each cell is "on" or "off"
 * based on the bit at that index. The cell at activeIndex is ringed; cells
 * before it are slightly faded (already happened) and cells after it are
 * shown at full opacity but unringed (not yet).
 *
 * The primitive does not own any timing — the parent advances activeIndex.
 * That keeps it composable: the clock widget runs three of these in lock-step.
 */
interface Props {
  label: string;
  bits: Bit[];
  activeIndex: number;
  /** Optional per-cell labels; same length as bits. Used by the stepper. */
  cellLabels?: readonly string[];
}

export default function TimelineSignal({ label, bits, activeIndex, cellLabels }: Props) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-16 shrink-0 text-right font-mono text-xs font-semibold text-apple-text-secondary">
        {label}
      </div>
      <div
        role="row"
        aria-label={`${label} timeline`}
        className="flex flex-1 gap-[2px]"
      >
        {bits.map((bit, i) => {
          const on = bit === 1;
          const isActive = i === activeIndex;
          const isPast = i < activeIndex;
          return (
            <div
              key={i}
              role="cell"
              data-tick={i}
              data-on={on ? 'true' : 'false'}
              data-active={isActive ? 'true' : 'false'}
              aria-label={`${label} tick ${i}: ${on ? 'on' : 'off'}${isActive ? ', active' : ''}`}
              className={`relative flex h-7 flex-1 items-center justify-center rounded-sm border font-mono text-[10px] transition-colors duration-150 motion-reduce:transition-none ${
                on
                  ? 'border-apple-blue bg-apple-blue text-white'
                  : 'border-apple-border bg-apple-surface text-apple-text-secondary'
              } ${isActive ? 'ring-2 ring-apple-blue ring-offset-1' : ''} ${
                isPast && !isActive ? 'opacity-60' : ''
              }`}
            >
              {cellLabels ? cellLabels[i] : on ? '1' : '0'}
            </div>
          );
        })}
      </div>
    </div>
  );
}
