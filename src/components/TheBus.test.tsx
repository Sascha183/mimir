import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import TheBus from './TheBus';

describe('TheBus', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with three empty registers; bus shows the input switches (all 0)', () => {
    render(<TheBus />);
    // 8 input switches + 3 register-enable switches = 11 switches.
    expect(screen.getAllByRole('switch')).toHaveLength(11);
    expect(screen.getByLabelText('bus as number')).toHaveTextContent('0');
    expect(screen.getByLabelText('bus as binary')).toHaveTextContent('0000 0000');
  });

  it('toggling an input switch is reflected immediately on the bus when no register is enabled', () => {
    render(<TheBus />);
    act(() => {
      screen.getByRole('switch', { name: /Input bit 0/i }).click();
      screen.getByRole('switch', { name: /Input bit 4/i }).click();
    });
    // bit 0 + bit 4 = 1 + 16 = 17.
    expect(screen.getByLabelText('bus as number')).toHaveTextContent('17');
  });

  it('Set captures the current bus value into a register', () => {
    render(<TheBus />);
    act(() => {
      screen.getByRole('switch', { name: /Input bit 1/i }).click();
      screen.getByRole('switch', { name: /Input bit 3/i }).click();
      // bus is now 0000 1010 = decimal 10
      screen.getByRole('button', { name: /Set R0 from the bus/i }).click();
    });
    expect(screen.getByLabelText('R0 as number')).toHaveTextContent('10');
  });

  it('Enable on a register puts its stored byte on the bus (overriding the inputs)', () => {
    render(<TheBus />);
    // Load R0 with decimal 5 (bits 0 + 2).
    act(() => {
      screen.getByRole('switch', { name: /Input bit 0/i }).click();
      screen.getByRole('switch', { name: /Input bit 2/i }).click();
      screen.getByRole('button', { name: /Set R0 from the bus/i }).click();
    });
    // Change the inputs to a different value (decimal 64 = bit 6).
    act(() => {
      screen.getByRole('switch', { name: /Input bit 0/i }).click(); // off
      screen.getByRole('switch', { name: /Input bit 2/i }).click(); // off
      screen.getByRole('switch', { name: /Input bit 6/i }).click(); // on
    });
    expect(screen.getByLabelText('bus as number')).toHaveTextContent('64');

    // Enable R0 — bus should now show R0's stored value (5), not the inputs (64).
    act(() => {
      screen.getByRole('switch', { name: /R0 enable/i }).click();
    });
    expect(screen.getByLabelText('bus as number')).toHaveTextContent('5');
  });

  it('copy from R0 to R2: enable R0, set R2, R2 captures R0', () => {
    render(<TheBus />);
    // Load R0 with decimal 42 = 0010 1010 = bits 1, 3, 5.
    act(() => {
      [1, 3, 5].forEach((b) =>
        screen.getByRole('switch', { name: new RegExp(`Input bit ${b}`, 'i') }).click(),
      );
      screen.getByRole('button', { name: /Set R0 from the bus/i }).click();
    });
    expect(screen.getByLabelText('R0 as number')).toHaveTextContent('42');
    expect(screen.getByLabelText('R2 as number')).toHaveTextContent('0');

    // Enable R0, then Set R2.
    act(() => {
      screen.getByRole('switch', { name: /R0 enable/i }).click();
      screen.getByRole('button', { name: /Set R2 from the bus/i }).click();
    });
    expect(screen.getByLabelText('R2 as number')).toHaveTextContent('42');
    // R0 unchanged — copy, not move.
    expect(screen.getByLabelText('R0 as number')).toHaveTextContent('42');
  });

  it('two enabled registers triggers a conflict; Set is blocked during conflict', () => {
    render(<TheBus />);
    // Load R0 = 1. Each switch toggle goes in its own act so React
    // re-renders the InputSwitch between flips (its isOn closure is stale
    // otherwise).
    act(() => {
      screen.getByRole('switch', { name: /Input bit 0/i }).click(); // bus=1
    });
    act(() => {
      screen.getByRole('button', { name: /Set R0 from the bus/i }).click();
    });
    act(() => {
      screen.getByRole('switch', { name: /Input bit 0/i }).click(); // off
    });
    act(() => {
      screen.getByRole('switch', { name: /Input bit 1/i }).click(); // bus=2
    });
    act(() => {
      screen.getByRole('button', { name: /Set R1 from the bus/i }).click();
    });
    expect(screen.getByLabelText('R0 as number')).toHaveTextContent('1');
    expect(screen.getByLabelText('R1 as number')).toHaveTextContent('2');

    // Enable both.
    act(() => {
      screen.getByRole('switch', { name: /R0 enable/i }).click();
      screen.getByRole('switch', { name: /R1 enable/i }).click();
    });
    expect(screen.getByRole('alert')).toHaveTextContent(/R0 and R1 are both driving the bus/);

    // The Set buttons are now disabled.
    expect(screen.getByRole('button', { name: /Set R2 from the bus/i })).toBeDisabled();

    // R2 should still be empty after a click attempt during conflict.
    act(() => {
      screen.getByRole('button', { name: /Set R2 from the bus/i }).click();
    });
    expect(screen.getByLabelText('R2 as number')).toHaveTextContent('0');
  });

  it('persists registers, inputs, and enable flags across mounts', () => {
    const { unmount } = render(<TheBus />);
    act(() => {
      screen.getByRole('switch', { name: /Input bit 5/i }).click(); // bus = 32
      screen.getByRole('button', { name: /Set R1 from the bus/i }).click();
      screen.getByRole('switch', { name: /R1 enable/i }).click();
    });
    expect(screen.getByLabelText('R1 as number')).toHaveTextContent('32');
    unmount();

    render(<TheBus />);
    expect(screen.getByLabelText('R1 as number')).toHaveTextContent('32');
    expect(screen.getByRole('switch', { name: /R1 enable/i })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByLabelText('bus as number')).toHaveTextContent('32');
  });

  it('Reset all clears every register, every input, and every enable', () => {
    render(<TheBus />);
    act(() => {
      screen.getByRole('switch', { name: /Input bit 7/i }).click(); // bus = 128
      screen.getByRole('button', { name: /Set R0 from the bus/i }).click();
      screen.getByRole('switch', { name: /R0 enable/i }).click();
    });
    expect(screen.getByLabelText('R0 as number')).toHaveTextContent('128');

    act(() => {
      screen.getByRole('button', { name: /^Reset all$/i }).click();
    });
    expect(screen.getByLabelText('R0 as number')).toHaveTextContent('0');
    expect(screen.getByLabelText('bus as number')).toHaveTextContent('0');
    screen
      .getAllByRole('switch')
      .forEach((s) => expect(s).toHaveAttribute('aria-checked', 'false'));
  });
});
