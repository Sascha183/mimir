import { useEffect, useState } from 'react';
import type { Bit } from '../lib/gates/types';
import InputSwitch from './gates/InputSwitch';

/**
 * TheALU — lesson-16 scene.
 *
 * The Arithmetic-Logic Unit. Wraps the eight byte-operation devices from
 * lesson 15 in one package, with a 3-bit op-select that picks which one's
 * output is exposed. Conceptually all eight are computing in parallel; the
 * op-select just gates which output reaches the bus. We don't draw the
 * inner devices — the widget is one black box with op-select and flags
 * on the outside.
 *
 * Op-code mapping (matches the book's convention):
 *   000 ADD   001 SHR   010 SHL   011 NOT
 *   100 AND   101 OR    110 XOR   111 CMP
 *
 * Flag wiring:
 *   - Carry: set when ADD overflows past 255.
 *   - A>B:   set when CMP sees A larger.
 *   - A=B:   set when CMP sees A equal to B.
 *   - Zero:  set when the output byte is all zeros (any op; CMP forces 0).
 */

const STORAGE_KEY = 'hciw:the-alu:state';
const ZERO_BYTE: Bit[] = [0, 0, 0, 0, 0, 0, 0, 0];
const ZERO_OP: Bit[] = [0, 0, 0]; // LSB-first: bit 0, bit 1, bit 2

interface PersistedState {
  a: Bit[];
  b: Bit[];
  op: Bit[]; // length 3, LSB-first
}

function defaultState(): PersistedState {
  return { a: [...ZERO_BYTE], b: [...ZERO_BYTE], op: [...ZERO_OP] };
}

function validateByte(arr: unknown): Bit[] | null {
  if (!Array.isArray(arr) || arr.length !== 8) return null;
  if (!arr.every((b) => b === 0 || b === 1)) return null;
  return arr as Bit[];
}

function validateOp(arr: unknown): Bit[] | null {
  if (!Array.isArray(arr) || arr.length !== 3) return null;
  if (!arr.every((b) => b === 0 || b === 1)) return null;
  return arr as Bit[];
}

function loadState(): PersistedState {
  if (typeof window === 'undefined') return defaultState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      a: validateByte(parsed.a) ?? [...ZERO_BYTE],
      b: validateByte(parsed.b) ?? [...ZERO_BYTE],
      op: validateOp(parsed.op) ?? [...ZERO_OP],
    };
  } catch {
    return defaultState();
  }
}

function bitsToNumber(bits: Bit[]): number {
  let n = 0;
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] === 1) n += 1 << i;
  }
  return n;
}

function numberToBits(n: number): Bit[] {
  const bits: Bit[] = [];
  for (let i = 0; i < 8; i++) bits.push(((n >> i) & 1) as Bit);
  return bits;
}

function bitsAsBinary(bits: Bit[]): string {
  const msbFirst = [...bits].reverse().join('');
  return `${msbFirst.slice(0, 4)} ${msbFirst.slice(4)}`;
}

const POSITIONS = [7, 6, 5, 4, 3, 2, 1, 0] as const; // MSB → LSB
const OP_POSITIONS = [2, 1, 0] as const;

const OP_NAMES = ['ADD', 'SHR', 'SHL', 'NOT', 'AND', 'OR', 'XOR', 'CMP'] as const;
type OpName = (typeof OP_NAMES)[number];

const OP_DESCRIPTIONS: Record<OpName, string> = {
  ADD: 'A + B (with carry-out)',
  SHR: 'A shifted right by 1',
  SHL: 'A shifted left by 1',
  NOT: 'flip every bit of A',
  AND: 'bit-wise A and B',
  OR: 'bit-wise A or B',
  XOR: 'bit-wise A xor B',
  CMP: 'compare A and B (flags only, no byte)',
};

const OP_USES_B: Record<OpName, boolean> = {
  ADD: true,
  SHR: false,
  SHL: false,
  NOT: false,
  AND: true,
  OR: true,
  XOR: true,
  CMP: true,
};

interface AluResult {
  bits: Bit[];        // The output byte. Forced to all zeros for CMP.
  carry: Bit;          // Set by ADD overflow.
  aLarger: Bit;        // Set by CMP.
  equal: Bit;          // Set by CMP.
  zero: Bit;           // True when the output byte is all zeros.
}

function computeAlu(a: Bit[], b: Bit[], opIdx: number): AluResult {
  let bits: Bit[] = [...ZERO_BYTE];
  let carry: Bit = 0;
  let aLarger: Bit = 0;
  let equal: Bit = 0;

  switch (opIdx) {
    case 0: { // ADD
      const sum = bitsToNumber(a) + bitsToNumber(b);
      carry = sum > 255 ? 1 : 0;
      bits = numberToBits(sum & 0xff);
      break;
    }
    case 1: // SHR
      bits = [a[1], a[2], a[3], a[4], a[5], a[6], a[7], 0];
      break;
    case 2: // SHL
      bits = [0, a[0], a[1], a[2], a[3], a[4], a[5], a[6]];
      break;
    case 3: // NOT
      bits = a.map((bit) => (bit === 1 ? 0 : 1)) as Bit[];
      break;
    case 4: // AND
      bits = a.map((bit, i) => ((bit === 1 && b[i] === 1 ? 1 : 0) as Bit));
      break;
    case 5: // OR
      bits = a.map((bit, i) => ((bit === 1 || b[i] === 1 ? 1 : 0) as Bit));
      break;
    case 6: // XOR
      bits = a.map((bit, i) => ((bit !== b[i] ? 1 : 0) as Bit));
      break;
    case 7: { // CMP
      const av = bitsToNumber(a);
      const bv = bitsToNumber(b);
      equal = av === bv ? 1 : 0;
      aLarger = av > bv ? 1 : 0;
      bits = [...ZERO_BYTE];
      break;
    }
  }

  const zero: Bit = bits.every((bit) => bit === 0) ? 1 : 0;
  return { bits, carry, aLarger, equal, zero };
}

export default function TheALU() {
  const [state, setState] = useState<PersistedState>(defaultState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(loadState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [hydrated, state]);

  const opIdx = bitsToNumber(state.op);
  const opName = OP_NAMES[opIdx];
  const result = computeAlu(state.a, state.b, opIdx);

  function setABit(i: number, v: Bit) {
    setState((prev) => ({ ...prev, a: prev.a.map((b, j) => (j === i ? v : b)) }));
  }
  function setBBit(i: number, v: Bit) {
    setState((prev) => ({ ...prev, b: prev.b.map((b, j) => (j === i ? v : b)) }));
  }
  function setOpBit(i: number, v: Bit) {
    setState((prev) => ({ ...prev, op: prev.op.map((b, j) => (j === i ? v : b)) }));
  }
  function selectOpByIndex(idx: number) {
    setState((prev) => ({ ...prev, op: numberToBits(idx).slice(0, 3) }));
  }
  function reset() {
    setState(defaultState());
  }

  return (
    <div className="not-prose mx-auto my-12 w-full max-w-[760px] text-apple-text">
      {/* Op-select bar */}
      <div className="rounded-xl border border-apple-border bg-apple-surface p-4">
        <div className="text-center text-xs font-semibold uppercase tracking-widest text-apple-text-secondary">
          Op-select (3 bits)
        </div>
        <div className="mt-3 flex items-end justify-center gap-3">
          {OP_POSITIONS.map((pos) => (
            <div key={`op-${pos}`} className="flex flex-col items-center gap-1">
              <span className="font-mono text-[11px] text-apple-text-secondary">
                bit {pos}
              </span>
              <InputSwitch
                value={state.op[pos]}
                onChange={(v) => setOpBit(pos, v)}
                label={`Op-select bit ${pos}`}
              />
            </div>
          ))}
        </div>
        <p className="mt-3 text-center text-sm text-apple-text-secondary" aria-live="polite">
          <output
            aria-label="op as binary"
            className="font-mono text-base font-semibold tracking-widest text-apple-text"
          >
            {[...state.op].reverse().join('')}
          </output>{' '}
          → selecting{' '}
          <output
            aria-label="selected op"
            className="font-mono font-semibold text-apple-text"
          >
            {opName}
          </output>{' '}
          <span className="text-apple-text-secondary">— {OP_DESCRIPTIONS[opName]}</span>
        </p>

        {/* The 8 op labels — all visible, the active one highlighted. */}
        <div
          className="mt-4 grid gap-2"
          style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}
          role="radiogroup"
          aria-label="ALU operation"
        >
          {OP_NAMES.map((name, idx) => {
            const active = idx === opIdx;
            return (
              <button
                key={name}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => selectOpByIndex(idx)}
                className={`rounded-md border px-2 py-1.5 font-mono text-xs font-semibold tracking-wide transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue focus-visible:ring-offset-2 motion-reduce:transition-none ${
                  active
                    ? 'border-apple-blue bg-apple-blue text-white'
                    : 'border-apple-border bg-apple-surface text-apple-text-secondary hover:text-apple-text'
                }`}
              >
                {name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Inputs A and B */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <ByteInput
          label="Input A"
          bits={state.a}
          onChange={setABit}
          dimmed={false}
        />
        <ByteInput
          label="Input B"
          bits={state.b}
          onChange={setBBit}
          dimmed={!OP_USES_B[opName]}
        />
      </div>

      <div className="mt-3 flex items-center justify-center">
        <button
          type="button"
          onClick={reset}
          className="rounded-full border border-apple-border bg-apple-surface px-4 py-1.5 text-xs font-medium text-apple-text-secondary transition-colors duration-200 hover:text-apple-text focus:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue focus-visible:ring-offset-2 motion-reduce:transition-none"
        >
          Reset
        </button>
      </div>

      {/* Output */}
      <div className="mt-6 rounded-xl border border-apple-border bg-apple-surface p-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-apple-text-secondary">
            Output
          </span>
          <span className="text-[11px] text-apple-text-secondary">
            from <span className="font-mono font-semibold text-apple-text">{opName}</span>
          </span>
        </div>
        <div
          className="mt-3 grid place-items-center"
          style={{ gridTemplateColumns: 'repeat(8, 1fr)', columnGap: '4px' }}
        >
          {POSITIONS.map((pos) => (
            <BitCell key={pos} value={result.bits[pos]} />
          ))}
        </div>
        <p className="mt-2 text-center text-xs text-apple-text-secondary" aria-live="polite">
          <span className="font-mono text-sm font-semibold text-apple-text">
            <output aria-label="output as binary">{bitsAsBinary(result.bits)}</output>
          </span>{' '}
          · decimal{' '}
          <output aria-label="output as number" className="font-medium text-apple-text">
            {bitsToNumber(result.bits)}
          </output>
          {opName === 'CMP' ? (
            <span className="block italic">
              CMP produces no byte output; the answer is in the flags below.
            </span>
          ) : null}
        </p>

        {/* Flags */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Flag label="Carry" on={result.carry === 1} testId="flag-carry" />
          <Flag label="A > B" on={result.aLarger === 1} testId="flag-larger" />
          <Flag label="A = B" on={result.equal === 1} testId="flag-equal" />
          <Flag label="Zero" on={result.zero === 1} testId="flag-zero" />
        </div>
      </div>
    </div>
  );
}

function ByteInput({
  label,
  bits,
  onChange,
  dimmed,
}: {
  label: string;
  bits: Bit[];
  onChange: (i: number, v: Bit) => void;
  dimmed: boolean;
}) {
  return (
    <div
      className={`rounded-xl border bg-apple-surface p-4 transition-opacity duration-200 motion-reduce:transition-none ${
        dimmed ? 'border-apple-border/60 opacity-50' : 'border-apple-border'
      }`}
      aria-label={dimmed ? `${label} (unused by current op)` : label}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-widest text-apple-text-secondary">
          {label}
        </span>
        {dimmed ? (
          <span className="text-[11px] italic text-apple-text-secondary">
            unused by this op
          </span>
        ) : null}
      </div>
      <div
        className="mt-3 grid place-items-center"
        style={{ gridTemplateColumns: 'repeat(8, 1fr)', columnGap: '4px' }}
      >
        {POSITIONS.map((pos) => (
          <div key={`${label}-${pos}`} className="flex flex-col items-center gap-1">
            <span className="font-mono text-[10px] text-apple-text-secondary">{pos}</span>
            <InputSwitch
              value={bits[pos]}
              onChange={(v) => onChange(pos, v)}
              label={`${label} bit ${pos}`}
            />
          </div>
        ))}
      </div>
      <p className="mt-2 text-center text-xs text-apple-text-secondary">
        <span className="font-mono text-sm font-semibold text-apple-text">
          {bitsAsBinary(bits)}
        </span>{' '}
        · decimal{' '}
        <span className="font-medium text-apple-text">{bitsToNumber(bits)}</span>
      </p>
    </div>
  );
}

function Flag({ label, on, testId }: { label: string; on: boolean; testId: string }) {
  return (
    <span
      data-testid={testId}
      data-on={on ? 'true' : 'false'}
      className={`rounded-full border px-3 py-1 font-mono text-xs font-semibold tracking-wide ${
        on
          ? 'border-apple-blue bg-apple-blue text-white'
          : 'border-apple-border bg-apple-surface text-apple-text-secondary'
      }`}
    >
      {label}
    </span>
  );
}

function BitCell({ value }: { value: Bit }) {
  const isOn = value === 1;
  return (
    <div
      role="status"
      aria-label={`Output bit: ${value}`}
      className={`flex h-8 w-8 items-center justify-center rounded-md border font-mono text-sm font-semibold transition-colors duration-200 motion-reduce:transition-none ${
        isOn
          ? 'border-apple-blue bg-apple-blue text-white'
          : 'border-apple-border bg-apple-surface text-apple-text-secondary'
      }`}
    >
      {value}
    </div>
  );
}
