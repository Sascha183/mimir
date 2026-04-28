import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import TheByte from './TheByte';

describe('TheByte', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with eight inputs and a stored byte of 0000 0000', () => {
    render(<TheByte />);
    const switches = screen.getAllByRole('switch');
    expect(switches).toHaveLength(8);
    switches.forEach((s) => expect(s).toHaveAttribute('aria-checked', 'false'));

    expect(screen.getByLabelText('byte as binary')).toHaveTextContent('0000 0000');
    expect(screen.getByLabelText('byte as number')).toHaveTextContent('0');
  });

  it('toggling input switches does NOT change the stored byte until Store is pressed', () => {
    render(<TheByte />);
    act(() => {
      // Flip bit 0 (LSB) and bit 2.
      screen.getByRole('switch', { name: /Input bit 0/i }).click();
      screen.getByRole('switch', { name: /Input bit 2/i }).click();
    });

    // Stored byte unchanged.
    expect(screen.getByLabelText('byte as binary')).toHaveTextContent('0000 0000');
    expect(screen.getByLabelText('byte as number')).toHaveTextContent('0');
  });

  it('pressing Store captures the inputs into the stored byte (decimal 5 = 0000 0101)', () => {
    render(<TheByte />);
    act(() => {
      screen.getByRole('switch', { name: /Input bit 0/i }).click();
      screen.getByRole('switch', { name: /Input bit 2/i }).click();
      screen.getByRole('button', { name: /Store the inputs into the byte/i }).click();
    });

    expect(screen.getByLabelText('byte as binary')).toHaveTextContent('0000 0101');
    expect(screen.getByLabelText('byte as number')).toHaveTextContent('5');
  });

  it('captures all eight bits at once (0010 1101 = 45)', () => {
    render(<TheByte />);
    // Bits 0, 2, 3, 5 set → 0b00101101 = 45.
    [0, 2, 3, 5].forEach((b) => {
      act(() => {
        screen.getByRole('switch', { name: new RegExp(`Input bit ${b}`, 'i') }).click();
      });
    });
    act(() => {
      screen.getByRole('button', { name: /Store the inputs into the byte/i }).click();
    });

    expect(screen.getByLabelText('byte as binary')).toHaveTextContent('0010 1101');
    expect(screen.getByLabelText('byte as number')).toHaveTextContent('45');
  });

  it('changing inputs after Store does not retroactively affect the stored byte', () => {
    render(<TheByte />);
    act(() => {
      screen.getByRole('switch', { name: /Input bit 0/i }).click();
      screen.getByRole('button', { name: /Store the inputs into the byte/i }).click();
    });
    expect(screen.getByLabelText('byte as number')).toHaveTextContent('1');

    // Flip more inputs without storing.
    act(() => {
      screen.getByRole('switch', { name: /Input bit 7/i }).click();
    });
    expect(screen.getByLabelText('byte as number')).toHaveTextContent('1');
  });

  it('persists inputs and stored byte across mounts via localStorage', () => {
    const { unmount } = render(<TheByte />);
    act(() => {
      screen.getByRole('switch', { name: /Input bit 1/i }).click();
      screen.getByRole('switch', { name: /Input bit 3/i }).click();
      screen.getByRole('button', { name: /Store the inputs into the byte/i }).click();
    });
    expect(screen.getByLabelText('byte as number')).toHaveTextContent('10');
    unmount();

    render(<TheByte />);
    expect(screen.getByLabelText('byte as number')).toHaveTextContent('10');
    // The two inputs should still be on after rehydration.
    expect(screen.getByRole('switch', { name: /Input bit 1/i })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('switch', { name: /Input bit 3/i })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('Reset to 0 clears both inputs and stored byte', () => {
    render(<TheByte />);
    act(() => {
      screen.getByRole('switch', { name: /Input bit 0/i }).click();
      screen.getByRole('switch', { name: /Input bit 7/i }).click();
      screen.getByRole('button', { name: /Store the inputs into the byte/i }).click();
    });
    expect(screen.getByLabelText('byte as number')).toHaveTextContent('129');

    act(() => {
      screen.getByRole('button', { name: /^Reset to 0$/i }).click();
    });
    expect(screen.getByLabelText('byte as number')).toHaveTextContent('0');
    expect(screen.getByLabelText('byte as binary')).toHaveTextContent('0000 0000');
    screen
      .getAllByRole('switch')
      .forEach((s) => expect(s).toHaveAttribute('aria-checked', 'false'));
  });
});
