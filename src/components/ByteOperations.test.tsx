import { describe, it, expect, beforeEach } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import ByteOperations from './ByteOperations';

/**
 * The widget seeds A and B with non-zero default patterns so the showcase
 * isn't a sea of zeros on first render. Tests reset both bytes to zero at
 * the start by using the Reset + manual flips, OR they assert relative
 * behavior (toggle a bit, observe the right device output flips with it).
 */

const ALL_OFF: Bit8 = [0, 0, 0, 0, 0, 0, 0, 0];
type Bit8 = [number, number, number, number, number, number, number, number];

function clickSwitch(label: string) {
  act(() => {
    screen.getByRole('switch', { name: new RegExp(label, 'i') }).click();
  });
}

function setByte(label: 'Input A' | 'Input B', desiredBits: Bit8) {
  // Bits are LSB-first in the array (matches project convention).
  for (let i = 0; i < 8; i++) {
    if (desiredBits[i] === 1) {
      clickSwitch(`${label} bit ${i}`);
    }
  }
}

function getDeviceCard(name: string): HTMLElement {
  // Each card has its mnemonic (ADD, NOT, etc) as the prominent label.
  const heading = screen.getByText(new RegExp(`^${name}$`));
  // Walk up to the card root.
  const card = heading.closest('div.rounded-xl');
  if (!card) throw new Error(`Card for ${name} not found`);
  return card as HTMLElement;
}

describe('ByteOperations', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders eight device cards', () => {
    render(<ByteOperations />);
    ['ADD', 'SHR', 'SHL', 'NOT', 'AND', 'OR', 'XOR', 'CMP'].forEach((name) => {
      expect(screen.getByText(new RegExp(`^${name}$`))).toBeInTheDocument();
    });
  });

  it('Reset zeroes both input bytes', () => {
    render(<ByteOperations />);
    act(() => {
      screen.getByRole('button', { name: /Reset inputs/i }).click();
    });
    // Every switch should be off after Reset.
    screen
      .getAllByRole('switch')
      .forEach((s) => expect(s).toHaveAttribute('aria-checked', 'false'));
  });

  it('AND of A=10101010 and B=11110000 is 10100000', () => {
    render(<ByteOperations />);
    act(() => {
      screen.getByRole('button', { name: /Reset inputs/i }).click();
    });

    // A = 10101010 (MSB-left) → bits 7,5,3,1 on → LSB-first [0,1,0,1,0,1,0,1]
    setByte('Input A', [0, 1, 0, 1, 0, 1, 0, 1] as Bit8);
    // B = 11110000 → bits 7,6,5,4 on → LSB-first [0,0,0,0,1,1,1,1]
    setByte('Input B', [0, 0, 0, 0, 1, 1, 1, 1] as Bit8);

    const andCard = getDeviceCard('AND');
    expect(within(andCard).getByText(/1010 0000/)).toBeInTheDocument();
  });

  it('NOT inverts every bit of A and ignores B', () => {
    render(<ByteOperations />);
    act(() => {
      screen.getByRole('button', { name: /Reset inputs/i }).click();
    });

    // A = 0000 0001 → NOT(A) = 1111 1110
    setByte('Input A', [1, 0, 0, 0, 0, 0, 0, 0] as Bit8);
    setByte('Input B', [1, 1, 1, 1, 1, 1, 1, 1] as Bit8);

    const notCard = getDeviceCard('NOT');
    expect(within(notCard).getByText(/1111 1110/)).toBeInTheDocument();
  });

  it('XOR of A=11110000 and B=10101010 is 01011010', () => {
    render(<ByteOperations />);
    act(() => {
      screen.getByRole('button', { name: /Reset inputs/i }).click();
    });

    setByte('Input A', [0, 0, 0, 0, 1, 1, 1, 1] as Bit8); // 1111 0000
    setByte('Input B', [0, 1, 0, 1, 0, 1, 0, 1] as Bit8); // 1010 1010

    const xorCard = getDeviceCard('XOR');
    expect(within(xorCard).getByText(/0101 1010/)).toBeInTheDocument();
  });

  it('ADD with carry: 200 + 100 = 44 (low byte) with carry on', () => {
    render(<ByteOperations />);
    act(() => {
      screen.getByRole('button', { name: /Reset inputs/i }).click();
    });

    // 200 = 11001000 → LSB-first [0,0,0,1,0,0,1,1]
    setByte('Input A', [0, 0, 0, 1, 0, 0, 1, 1] as Bit8);
    // 100 = 01100100 → LSB-first [0,0,1,0,0,1,1,0]
    setByte('Input B', [0, 0, 1, 0, 0, 1, 1, 0] as Bit8);

    const addCard = getDeviceCard('ADD');
    // 200 + 100 = 300 = 256 + 44 → low byte is 44 = 0010 1100
    expect(within(addCard).getByText(/0010 1100/)).toBeInTheDocument();
    expect(within(addCard).getByText(/carry: 1/)).toBeInTheDocument();
  });

  it('SHR shifts A right by one and surfaces the LSB as shifted-out', () => {
    render(<ByteOperations />);
    act(() => {
      screen.getByRole('button', { name: /Reset inputs/i }).click();
    });

    // A = 0000 0011 → SHR(A) = 0000 0001, shifted-out = 1
    setByte('Input A', [1, 1, 0, 0, 0, 0, 0, 0] as Bit8);

    const shrCard = getDeviceCard('SHR');
    expect(within(shrCard).getByText(/0000 0001/)).toBeInTheDocument();
    expect(within(shrCard).getByText(/shifted out: 1/)).toBeInTheDocument();
  });

  it('SHL shifts A left by one and surfaces the MSB as shifted-out', () => {
    render(<ByteOperations />);
    act(() => {
      screen.getByRole('button', { name: /Reset inputs/i }).click();
    });

    // A = 1100 0000 → SHL(A) = 1000 0000, shifted-out = 1
    setByte('Input A', [0, 0, 0, 0, 0, 0, 1, 1] as Bit8);

    const shlCard = getDeviceCard('SHL');
    expect(within(shlCard).getByText(/1000 0000/)).toBeInTheDocument();
    expect(within(shlCard).getByText(/shifted out: 1/)).toBeInTheDocument();
  });

  it('CMP: equal flag on when A == B', () => {
    render(<ByteOperations />);
    act(() => {
      screen.getByRole('button', { name: /Reset inputs/i }).click();
    });

    setByte('Input A', [1, 0, 1, 0, 1, 0, 1, 0] as Bit8);
    setByte('Input B', [1, 0, 1, 0, 1, 0, 1, 0] as Bit8);

    const cmpCard = getDeviceCard('CMP');
    expect(within(cmpCard).getByText('A = B')).toBeInTheDocument();
  });

  it('persists the input bytes across mounts via localStorage', () => {
    const { unmount } = render(<ByteOperations />);
    act(() => {
      screen.getByRole('button', { name: /Reset inputs/i }).click();
    });
    setByte('Input A', [1, 0, 0, 0, 0, 0, 0, 1] as Bit8); // 1000 0001 = 129
    unmount();

    render(<ByteOperations />);
    // Bit 0 and bit 7 of A should still be on.
    expect(screen.getByRole('switch', { name: /Input A bit 0/i })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('switch', { name: /Input A bit 7/i })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });
});
