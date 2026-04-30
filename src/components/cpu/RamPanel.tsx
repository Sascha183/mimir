/**
 * RamPanel — displays a small window of RAM (16 bytes) for the CPU diagram.
 *
 * The cell at MAR's address is highlighted. Cells with non-zero values get
 * a subtle tint so the learner can see at a glance which addresses hold
 * data.
 */

interface Props {
  ram: number[];
  marAddress: number;
}

export default function RamPanel({ ram, marAddress }: Props) {
  return (
    <div className="rounded-xl border border-apple-border bg-apple-surface p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-apple-text-secondary">
          RAM (16 bytes shown)
        </span>
        <span className="font-mono text-[11px] text-apple-text-secondary">
          MAR → addr {marAddress}
        </span>
      </div>
      <div className="grid grid-cols-8 gap-1">
        {ram.map((value, i) => {
          const isSelected = i === marAddress;
          const hasData = value !== 0;
          return (
            <div
              key={i}
              data-addr={i}
              data-selected={isSelected ? 'true' : 'false'}
              className={`rounded-md border px-1 py-1 text-center transition-colors duration-150 motion-reduce:transition-none ${
                isSelected
                  ? 'border-apple-blue bg-apple-blue text-white ring-2 ring-apple-blue/40'
                  : hasData
                    ? 'border-apple-border bg-apple-blue/10 text-apple-text'
                    : 'border-apple-border bg-apple-surface text-apple-text-secondary'
              }`}
            >
              <div className="font-mono text-[9px] opacity-70">{i}</div>
              <div className="font-mono text-xs font-semibold">{value}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
