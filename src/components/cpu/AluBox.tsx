import type { AluSnapshot } from '../../lib/cpu/types';

/**
 * AluBox — visual block for the ALU.
 *
 * Shows the currently-selected op (or "idle" if no op fires this step) and
 * the ALU's output value. The two inputs (bus-side and TMP-side) are
 * implied by position — the bus runs above, TMP sits to the side.
 */

interface Props {
  alu: AluSnapshot;
  /** TMP value at this step (one of the ALU's inputs). */
  tmpValue: number;
}

function toBinary(n: number): string {
  const s = (n & 0xff).toString(2).padStart(8, '0');
  return `${s.slice(0, 4)} ${s.slice(4)}`;
}

export default function AluBox({ alu, tmpValue }: Props) {
  const active = alu.op !== null;
  return (
    <div
      data-active={active ? 'true' : 'false'}
      className={`rounded-lg border px-4 py-3 text-center transition-colors duration-150 motion-reduce:transition-none ${
        active
          ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-500/40'
          : 'border-apple-border bg-white'
      }`}
    >
      <div className="text-[11px] font-semibold uppercase tracking-widest text-apple-text-secondary">
        ALU
      </div>
      <div className="mt-1 font-mono text-sm font-semibold text-apple-text">
        op:{' '}
        <output aria-label="ALU op" className="text-apple-text">
          {alu.op ?? 'idle'}
        </output>
      </div>
      <div className="mt-2 text-xs text-apple-text-secondary">
        TMP ={' '}
        <span className="font-mono text-apple-text">{tmpValue}</span>
      </div>
      <div className="mt-1">
        <span className="text-[11px] text-apple-text-secondary">output: </span>
        <output
          aria-label="ALU output"
          className="font-mono text-sm font-semibold text-apple-text"
        >
          {alu.output}
        </output>
        <div className="font-mono text-[10px] text-apple-text-secondary">
          {toBinary(alu.output)}
        </div>
      </div>
    </div>
  );
}
