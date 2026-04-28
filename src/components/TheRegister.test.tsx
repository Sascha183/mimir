import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import TheRegister from './TheRegister';

describe('TheRegister', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with a zero byte and the enable line off', () => {
    render(<TheRegister />);

    // 8 input switches + 1 enable switch = 9 switches.
    expect(screen.getAllByRole('switch')).toHaveLength(9);
    expect(screen.getByRole('switch', { name: /^Enable/i })).toHaveAttribute(
      'aria-checked',
      'false',
    );

    expect(screen.getByLabelText('stored byte as binary')).toHaveTextContent('0000 0000');
    expect(screen.getByLabelText('output as binary')).toHaveTextContent('0000 0000');
  });

  it('with enable OFF, output is all zeros even when stored byte is non-zero', () => {
    render(<TheRegister />);
    act(() => {
      screen.getByRole('switch', { name: /Input bit 0/i }).click();
      screen.getByRole('switch', { name: /Input bit 7/i }).click();
      screen.getByRole('button', { name: /Store the inputs into the byte/i }).click();
    });

    expect(screen.getByLabelText('stored byte as number')).toHaveTextContent('129');
    expect(screen.getByLabelText('output as number')).toHaveTextContent('0');
    expect(screen.getByLabelText('output as binary')).toHaveTextContent('0000 0000');
  });

  it('flipping enable ON exposes the stored byte on the output', () => {
    render(<TheRegister />);
    act(() => {
      // Store decimal 45 = 0010 1101 (bits 0, 2, 3, 5 on).
      [0, 2, 3, 5].forEach((b) =>
        screen.getByRole('switch', { name: new RegExp(`Input bit ${b}`, 'i') }).click(),
      );
      screen.getByRole('button', { name: /Store the inputs into the byte/i }).click();
    });
    expect(screen.getByLabelText('output as number')).toHaveTextContent('0');

    act(() => {
      screen.getByRole('switch', { name: /^Enable/i }).click();
    });
    expect(screen.getByLabelText('output as binary')).toHaveTextContent('0010 1101');
    expect(screen.getByLabelText('output as number')).toHaveTextContent('45');
  });

  it('flipping enable back OFF mutes the output (stored byte unchanged)', () => {
    render(<TheRegister />);
    act(() => {
      screen.getByRole('switch', { name: /Input bit 0/i }).click();
      screen.getByRole('button', { name: /Store the inputs into the byte/i }).click();
      screen.getByRole('switch', { name: /^Enable/i }).click();
    });
    expect(screen.getByLabelText('output as number')).toHaveTextContent('1');

    act(() => {
      screen.getByRole('switch', { name: /^Enable/i }).click();
    });
    expect(screen.getByLabelText('output as number')).toHaveTextContent('0');
    // Stored byte is unchanged — the enabler only gates the output.
    expect(screen.getByLabelText('stored byte as number')).toHaveTextContent('1');
  });

  it('with enable ON, storing a new byte updates the output immediately', () => {
    render(<TheRegister />);
    act(() => {
      screen.getByRole('switch', { name: /^Enable/i }).click();
    });
    expect(screen.getByLabelText('output as number')).toHaveTextContent('0');

    act(() => {
      screen.getByRole('switch', { name: /Input bit 4/i }).click(); // = 16
      screen.getByRole('button', { name: /Store the inputs into the byte/i }).click();
    });
    expect(screen.getByLabelText('output as number')).toHaveTextContent('16');
  });

  it('persists inputs, stored byte, and enable across mounts', () => {
    const { unmount } = render(<TheRegister />);
    act(() => {
      screen.getByRole('switch', { name: /Input bit 1/i }).click();
      screen.getByRole('switch', { name: /Input bit 3/i }).click();
      screen.getByRole('button', { name: /Store the inputs into the byte/i }).click();
      screen.getByRole('switch', { name: /^Enable/i }).click();
    });
    unmount();

    render(<TheRegister />);
    expect(screen.getByLabelText('stored byte as number')).toHaveTextContent('10');
    expect(screen.getByLabelText('output as number')).toHaveTextContent('10');
    expect(screen.getByRole('switch', { name: /^Enable/i })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('Reset clears inputs, stored byte, output, and the enable line', () => {
    render(<TheRegister />);
    act(() => {
      screen.getByRole('switch', { name: /Input bit 0/i }).click();
      screen.getByRole('button', { name: /Store the inputs into the byte/i }).click();
      screen.getByRole('switch', { name: /^Enable/i }).click();
    });
    expect(screen.getByLabelText('output as number')).toHaveTextContent('1');

    act(() => {
      screen.getByRole('button', { name: /^Reset$/i }).click();
    });
    expect(screen.getByLabelText('stored byte as number')).toHaveTextContent('0');
    expect(screen.getByLabelText('output as number')).toHaveTextContent('0');
    expect(screen.getByRole('switch', { name: /^Enable/i })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });
});
