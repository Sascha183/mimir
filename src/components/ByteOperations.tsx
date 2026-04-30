import { useEffect, useState } from 'react';
import type { Bit } from '../lib/gates/types';
import InputSwitch from './gates/InputSwitch';

/**
 * ByteOperations — lesson-15 scene.
 *
 * Two shared input bytes (A and B) drive eight independent byte-operation
 * "devices": ADD, SHR, SHL, NOT, AND, OR, XOR, CMP. Each device is a black
 * box for the purposes of this lesson — the inner wiring (built from the
 * gates from Module 1) is intentionally hidden. The point is the *shape* of
 * the input/output relationship for each device, not the gate-level proof.
 *
 * Single-input devices (NOT, SHR, SHL) ignore B and visually grey it out in
 * their card. Two-input devices use both. CMP is the odd one out: it
 * produces flag bits (equal, A-larger), not a byte.
 */

const STORAGE_KEY = 'hciw:byte-operations:state';
const ZERO_BYTE: Bit[] = [0, 0, 0, 0, 0, 0, 0, 0];

interface PersistedState {
  a: Bit[];
  b: Bit[];
}

function defaultState(): PersistedState {
  return {
    a: [0, 1, 0, 1, 0, 1, 0, 1] as Bit[], // 0xAA-ish-but-different — gives a non-trivial first impression
    b: [0, 1, 1, 0, 0, 0, 1, 1] as Bit[],
  };
}

function validateByte(arr: unknown): Bit[] | null {
  if (!Array.isArray(arr) || arr.length !== 8) return null;
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
      a: validateByte(parsed.a) ?? defaultState().a,
      b: validateByte(parsed.b) ?? defaultState().b,
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

const POSITIONS = [7, 6, 5, 4, 3, 2, 1, 0] as const; // MSB → LSB, left → right

interface ByteResult {
  bits: Bit[];
  /** A small extra bit some devices produce — carry, shift-out, etc. */
  flag?: { label: string; value: Bit };
}

function opAdd(a: Bit[], b: Bit[]): ByteResult {
  const sum = bitsToNumber(a) + bitsToNumber(b);
  const carry: Bit = sum > 255 ? 1 : 0;
  return { bits: numberToBits(sum & 0xff), flag: { label: 'carry', value: carry } };
}

function opShr(a: Bit[]): ByteResult {
  // Shift right by one. bit[i] receives bit[i+1]. The new MSB is 0.
  // Bit 0 falls out — surface it as the shift-out flag.
  const shiftedOut: Bit = a[0];
  const bits: Bit[] = [a[1], a[2], a[3], a[4], a[5], a[6], a[7], 0];
  return { bits, flag: { label: 'shifted out', value: shiftedOut } };
}

function opShl(a: Bit[]): ByteResult {
  // Shift left by one. bit[i] receives bit[i-1]. The new LSB is 0.
  // Bit 7 falls out.
  const shiftedOut: Bit = a[7];
  const bits: Bit[] = [0, a[0], a[1], a[2], a[3], a[4], a[5], a[6]];
  return { bits, flag: { label: 'shifted out', value: shiftedOut } };
}

function opNot(a: Bit[]): ByteResult {
  return { bits: a.map((bit) => (bit === 1 ? 0 : 1)) as Bit[] };
}

function opAnd(a: Bit[], b: Bit[]): ByteResult {
  return { bits: a.map((bit, i) => ((bit === 1 && b[i] === 1 ? 1 : 0) as Bit)) };
}

function opOr(a: Bit[], b: Bit[]): ByteResult {
  return { bits: a.map((bit, i) => ((bit === 1 || b[i] === 1 ? 1 : 0) as Bit)) };
}

function opXor(a: Bit[], b: Bit[]): ByteResult {
  return { bits: a.map((bit, i) => ((bit !== b[i] ? 1 : 0) as Bit)) };
}

interface CmpResult {
  equal: Bit;
  aLarger: Bit;
}

function opCmp(a: Bit[], b: Bit[]): CmpResult {
  const av = bitsToNumber(a);
  const bv = bitsToNumber(b);
  return {
    equal: av === bv ? 1 : 0,
    aLarger: av > bv ? 1 : 0,
  };
}

type DeviceKey = 'ADD' | 'SHR' | 'SHL' | 'NOT' | 'AND' | 'OR' | 'XOR' | 'CMP';

interface DeviceMeta {
  key: DeviceKey;
  inputs: 'A' | 'A and B';
  blurb: string;
}

const DEVICES: DeviceMeta[] = [
  { key: 'ADD', inputs: 'A and B', blurb: 'sum, with carry' },
  { key: 'SHR', inputs: 'A', blurb: 'shift right by 1' },
  { key: 'SHL', inputs: 'A', blurb: 'shift left by 1' },
  { key: 'NOT', inputs: 'A', blurb: 'flip every bit' },
  { key: 'AND', inputs: 'A and B', blurb: 'bit-wise A and B' },
  { key: 'OR', inputs: 'A and B', blurb: 'bit-wise A or B' },
  { key: 'XOR', inputs: 'A and B', blurb: 'bit-wise A xor B' },
  { key: 'CMP', inputs: 'A and B', blurb: 'flags: equal, A larger' },
];

export default function ByteOperations() {
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
      // localStorage unavailable — keep going.
    }
  }, [hydrated, state]);

  function setABit(i: number, v: Bit) {
    setState((prev) => ({ ...prev, a: prev.a.map((b, j) => (j === i ? v : b)) }));
  }
  function setBBit(i: number, v: Bit) {
    setState((prev) => ({ ...prev, b: prev.b.map((b, j) => (j === i ? v : b)) }));
  }
  function reset() {
    setState({ a: [...ZERO_BYTE], b: [...ZERO_BYTE] });
  }

  const cmp = opCmp(state.a, state.b);

  function resultFor(key: DeviceKey): ByteResult | CmpResult {
    switch (key) {
      case 'ADD':
        return opAdd(state.a, state.b);
      case 'SHR':
        return opShr(state.a);
      case 'SHL':
        return opShl(state.a);
      case 'NOT':
        return opNot(state.a);
      case 'AND':
        return opAnd(state.a, state.b);
      case 'OR':
        return opOr(state.a, state.b);
      case 'XOR':
        return opXor(state.a, state.b);
      case 'CMP':
        return cmp;
    }
  }

  return (
    <div className="not-prose mx-auto my-12 w-full max-w-[760px] text-apple-text">
      {/* Two input bytes side-by-side. */}
      <div className="grid gap-6 sm:grid-cols-2">
        <ByteInput label="Input A" bits={state.a} onChange={setABit} />
        <ByteInput label="Input B" bits={state.b} onChange={setBBit} />
      </div>

      <div className="mt-3 flex items-center justify-center">
        <button
          type="button"
          onClick={reset}
          className="rounded-full border border-apple-border bg-apple-surface px-4 py-1.5 text-xs font-medium text-apple-text-secondary transition-colors duration-200 hover:text-apple-text focus:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue focus-visible:ring-offset-2 motion-reduce:transition-none"
        >
          Reset inputs
        </button>
      </div>

      {/* Grid of devices. */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {DEVICES.map((d) => (
          <DeviceCard
            key={d.key}
            meta={d}
            result={resultFor(d.key)}
          />
        ))}
      </div>

      <p className="mt-8 text-center text-xs text-apple-text-secondary">
        Eight black boxes. Same two inputs feed every one of them. Each box
        produces its own answer the instant the inputs change.
      </p>
    </div>
  );
}

function ByteInput({
  label,
  bits,
  onChange,
}: {
  label: string;
  bits: Bit[];
  onChange: (i: number, v: Bit) => void;
}) {
  return (
    <div className="rounded-xl border border-apple-border bg-apple-surface p-4">
      <div className="text-center text-xs font-semibold uppercase tracking-widest text-apple-text-secondary">
        {label}
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

function isCmpResult(r: ByteResult | CmpResult): r is CmpResult {
  return (r as CmpResult).equal !== undefined;
}

function DeviceCard({ meta, result }: { meta: DeviceMeta; result: ByteResult | CmpResult }) {
  return (
    <div className="rounded-xl border border-apple-border bg-apple-surface p-4">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-base font-semibold tracking-wider text-apple-text">
          {meta.key}
        </span>
        <span className="text-[11px] text-apple-text-secondary">
          uses {meta.inputs} · {meta.blurb}
        </span>
      </div>

      <div className="mt-3">
        {isCmpResult(result) ? (
          <FlagOutput equal={result.equal} aLarger={result.aLarger} />
        ) : (
          <ByteOutput result={result} />
        )}
      </div>
    </div>
  );
}

function ByteOutput({ result }: { result: ByteResult }) {
  return (
    <>
      <div
        className="grid place-items-center"
        style={{ gridTemplateColumns: 'repeat(8, 1fr)', columnGap: '4px' }}
      >
        {POSITIONS.map((pos) => (
          <BitCell key={pos} value={result.bits[pos]} />
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-apple-text-secondary">
        <span>
          <span className="font-mono text-sm font-semibold text-apple-text">
            {bitsAsBinary(result.bits)}
          </span>{' '}
          · {bitsToNumber(result.bits)}
        </span>
        {result.flag ? (
          <span
            className={`rounded-full border px-2 py-0.5 font-mono ${
              result.flag.value === 1
                ? 'border-apple-blue bg-apple-blue text-white'
                : 'border-apple-border bg-apple-surface text-apple-text-secondary'
            }`}
          >
            {result.flag.label}: {result.flag.value}
          </span>
        ) : (
          <span aria-hidden="true">&nbsp;</span>
        )}
      </div>
    </>
  );
}

function FlagOutput({ equal, aLarger }: { equal: Bit; aLarger: Bit }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Flag label="A = B" on={equal === 1} />
      <Flag label="A > B" on={aLarger === 1} />
      <Flag label="A < B" on={equal === 0 && aLarger === 0} />
      <span className="ml-auto text-[11px] text-apple-text-secondary">
        no byte output, only flags
      </span>
    </div>
  );
}

function Flag({ label, on }: { label: string; on: boolean }) {
  return (
    <span
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
