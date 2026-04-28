import { describe, it, expect, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import TheALU from './TheALU';

type Bit8 = [number, number, number, number, number, number, number, number];

function clickSwitch(label: string) {
  act(() => {
    screen.getByRole('switch', { name: new RegExp(label, 'i') }).click();
  });
}

function setByte(label: 'Input A' | 'Input B', desiredBits: Bit8) {
  for (let i = 0; i < 8; i++) {
    if (desiredBits[i] === 1) {
      clickSwitch(`${label} bit ${i}`);
    }
  }
}

function selectOp(name: string) {
  act(() => {
    screen.getByRole('radio', { name: new RegExp(`^${name}$`) }).click();
  });
}

function flagOn(testId: string): boolean {
  return screen.getByTestId(testId).getAttribute('data-on') === 'true';
}

describe('TheALU', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('starts with op=000 (ADD) and zeroed inputs', () => {
    render(<TheALU />);
    expect(screen.getByRole('radio', { name: /^ADD$/ })).toHaveAttribute('aria-checked', 'true');
    // 8 input switches per byte + 3 op-select switches = 19 total.
    expect(screen.getAllByRole('switch')).toHaveLength(19);
  });

  it('ADD: 5 + 3 = 8, no carry, not zero', () => {
    render(<TheALU />);
    selectOp('ADD');
    setByte('Input A', [1, 0, 1, 0, 0, 0, 0, 0] as Bit8); // 5
    setByte('Input B', [1, 1, 0, 0, 0, 0, 0, 0] as Bit8); // 3

    expect(screen.getByLabelText('output as binary')).toHaveTextContent('0000 1000');
    expect(screen.getByLabelText('output as number')).toHaveTextContent('8');
    expect(flagOn('flag-carry')).toBe(false);
    expect(flagOn('flag-zero')).toBe(false);
  });

  it('ADD: 200 + 100 = 44 with carry', () => {
    render(<TheALU />);
    selectOp('ADD');
    // 200 = 11001000 → LSB-first [0,0,0,1,0,0,1,1]
    setByte('Input A', [0, 0, 0, 1, 0, 0, 1, 1] as Bit8);
    // 100 = 01100100 → LSB-first [0,0,1,0,0,1,1,0]
    setByte('Input B', [0, 0, 1, 0, 0, 1, 1, 0] as Bit8);

    expect(screen.getByLabelText('output as binary')).toHaveTextContent('0010 1100');
    expect(flagOn('flag-carry')).toBe(true);
  });

  it('AND: 1111 0000 & 1010 1010 = 1010 0000', () => {
    render(<TheALU />);
    selectOp('AND');
    setByte('Input A', [0, 0, 0, 0, 1, 1, 1, 1] as Bit8); // 1111 0000
    setByte('Input B', [0, 1, 0, 1, 0, 1, 0, 1] as Bit8); // 1010 1010

    expect(screen.getByLabelText('output as binary')).toHaveTextContent('1010 0000');
    expect(flagOn('flag-zero')).toBe(false);
  });

  it('Zero flag turns on when output is all zeros', () => {
    render(<TheALU />);
    selectOp('AND');
    // A=1111 0000, B=0000 1111 → AND=0000 0000 → Zero on.
    setByte('Input A', [0, 0, 0, 0, 1, 1, 1, 1] as Bit8);
    setByte('Input B', [1, 1, 1, 1, 0, 0, 0, 0] as Bit8);

    expect(flagOn('flag-zero')).toBe(true);
  });

  it('NOT: A=0000 0001 → 1111 1110, regardless of B', () => {
    render(<TheALU />);
    setByte('Input A', [1, 0, 0, 0, 0, 0, 0, 0] as Bit8);
    setByte('Input B', [1, 1, 1, 1, 1, 1, 1, 1] as Bit8); // sanity: B is set, but NOT ignores it
    selectOp('NOT');

    expect(screen.getByLabelText('output as binary')).toHaveTextContent('1111 1110');
  });

  it('CMP: A == B → equal flag on, output forced to zero, A>B off', () => {
    render(<TheALU />);
    setByte('Input A', [1, 0, 1, 0, 1, 0, 1, 0] as Bit8);
    setByte('Input B', [1, 0, 1, 0, 1, 0, 1, 0] as Bit8);
    selectOp('CMP');

    expect(flagOn('flag-equal')).toBe(true);
    expect(flagOn('flag-larger')).toBe(false);
    expect(flagOn('flag-zero')).toBe(true); // Output byte is zeroed for CMP.
    expect(screen.getByLabelText('output as binary')).toHaveTextContent('0000 0000');
  });

  it('CMP: A > B → A larger flag on, equal off', () => {
    render(<TheALU />);
    setByte('Input A', [0, 0, 0, 0, 0, 0, 0, 1] as Bit8); // 128
    setByte('Input B', [1, 0, 0, 0, 0, 0, 0, 0] as Bit8); // 1
    selectOp('CMP');

    expect(flagOn('flag-larger')).toBe(true);
    expect(flagOn('flag-equal')).toBe(false);
  });

  it('SHR shifts right and uses A only (B is dimmed)', () => {
    render(<TheALU />);
    setByte('Input A', [0, 1, 0, 0, 0, 0, 0, 0] as Bit8); // 2
    setByte('Input B', [1, 1, 1, 1, 1, 1, 1, 1] as Bit8); // sanity
    selectOp('SHR');

    // 0000 0010 SHR → 0000 0001
    expect(screen.getByLabelText('output as binary')).toHaveTextContent('0000 0001');
    // The B input card should be aria-labeled "unused by current op".
    expect(screen.getByLabelText(/Input B \(unused by current op\)/)).toBeInTheDocument();
  });

  it('selecting an op via the op-select toggles updates the radiogroup highlighting', () => {
    render(<TheALU />);
    // 3-bit op = 100 → idx 4 → AND. Bit 2 high, others low.
    clickSwitch('Op-select bit 2');

    expect(screen.getByRole('radio', { name: /^AND$/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('radio', { name: /^ADD$/ })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('persists state across mounts via localStorage', () => {
    const { unmount } = render(<TheALU />);
    selectOp('XOR');
    setByte('Input A', [1, 0, 0, 0, 0, 0, 0, 1] as Bit8);
    unmount();

    render(<TheALU />);
    expect(screen.getByRole('radio', { name: /^XOR$/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('switch', { name: /Input A bit 0/i })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('switch', { name: /Input A bit 7/i })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('Reset clears inputs, op, and flags', () => {
    render(<TheALU />);
    selectOp('XOR');
    setByte('Input A', [1, 1, 1, 1, 1, 1, 1, 1] as Bit8);

    act(() => {
      screen.getByRole('button', { name: /^Reset$/ }).click();
    });

    expect(screen.getByRole('radio', { name: /^ADD$/ })).toHaveAttribute('aria-checked', 'true');
    screen
      .getAllByRole('switch')
      .forEach((s) => expect(s).toHaveAttribute('aria-checked', 'false'));
  });
});
