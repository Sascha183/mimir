import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import TheClock from './TheClock';

function getRow(label: string): HTMLElement {
  return screen.getByRole('row', { name: new RegExp(`^${label} timeline$`) });
}

function tickAt(row: HTMLElement, i: number): HTMLElement {
  const cell = within(row).getAllByRole('cell')[i];
  if (!cell) throw new Error(`No cell at index ${i}`);
  return cell;
}

describe('TheClock', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders three timeline rows: clk, clk_e, clk_s — each 16 ticks', () => {
    render(<TheClock />);
    expect(within(getRow('clk')).getAllByRole('cell')).toHaveLength(16);
    expect(within(getRow('clk_e')).getAllByRole('cell')).toHaveLength(16);
    expect(within(getRow('clk_s')).getAllByRole('cell')).toHaveLength(16);
  });

  it('clk pattern is 0,1,1,0 repeating', () => {
    render(<TheClock />);
    const row = getRow('clk');
    // First period.
    expect(tickAt(row, 0)).toHaveAttribute('data-on', 'false');
    expect(tickAt(row, 1)).toHaveAttribute('data-on', 'true');
    expect(tickAt(row, 2)).toHaveAttribute('data-on', 'true');
    expect(tickAt(row, 3)).toHaveAttribute('data-on', 'false');
    // Second period — same.
    expect(tickAt(row, 4)).toHaveAttribute('data-on', 'false');
    expect(tickAt(row, 5)).toHaveAttribute('data-on', 'true');
  });

  it('clk_e is wider than clk: high in phases 1, 2, 3 — only phase 0 is low', () => {
    render(<TheClock />);
    const row = getRow('clk_e');
    expect(tickAt(row, 0)).toHaveAttribute('data-on', 'false');
    expect(tickAt(row, 1)).toHaveAttribute('data-on', 'true');
    expect(tickAt(row, 2)).toHaveAttribute('data-on', 'true');
    expect(tickAt(row, 3)).toHaveAttribute('data-on', 'true');
    expect(tickAt(row, 4)).toHaveAttribute('data-on', 'false');
  });

  it('clk_s is narrower than clk: high only at phase 2', () => {
    render(<TheClock />);
    const row = getRow('clk_s');
    expect(tickAt(row, 0)).toHaveAttribute('data-on', 'false');
    expect(tickAt(row, 1)).toHaveAttribute('data-on', 'false');
    expect(tickAt(row, 2)).toHaveAttribute('data-on', 'true');
    expect(tickAt(row, 3)).toHaveAttribute('data-on', 'false');
    expect(tickAt(row, 6)).toHaveAttribute('data-on', 'true'); // phase 2 of second period
  });

  it('Step advances the active tick by one', () => {
    render(<TheClock />);
    expect(screen.getByLabelText('current tick')).toHaveTextContent('0');
    act(() => {
      screen.getByRole('button', { name: /^Step$/ }).click();
    });
    expect(screen.getByLabelText('current tick')).toHaveTextContent('1');
  });

  it('Reset returns to tick 0 and pauses', () => {
    render(<TheClock />);
    act(() => {
      screen.getByRole('button', { name: /^Step$/ }).click();
      screen.getByRole('button', { name: /^Step$/ }).click();
    });
    expect(screen.getByLabelText('current tick')).toHaveTextContent('2');
    act(() => {
      screen.getByRole('button', { name: /^Reset$/ }).click();
    });
    expect(screen.getByLabelText('current tick')).toHaveTextContent('0');
  });

  it('Start advances ticks on a setInterval; Pause stops them', () => {
    render(<TheClock />);
    act(() => {
      screen.getByRole('button', { name: /^Start$/ }).click();
    });
    // Default rate is 600ms — advance time by ~3 intervals.
    act(() => {
      vi.advanceTimersByTime(1800);
    });
    expect(screen.getByLabelText('current tick')).toHaveTextContent('3');

    act(() => {
      screen.getByRole('button', { name: /^Pause$/ }).click();
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByLabelText('current tick')).toHaveTextContent('3');
  });

  it('tick wraps from 15 back to 0', () => {
    render(<TheClock />);
    for (let i = 0; i < 16; i++) {
      act(() => {
        screen.getByRole('button', { name: /^Step$/ }).click();
      });
    }
    expect(screen.getByLabelText('current tick')).toHaveTextContent('0');
  });

  it('Step button is disabled while running', () => {
    render(<TheClock />);
    expect(screen.getByRole('button', { name: /^Step$/ })).toBeEnabled();
    act(() => {
      screen.getByRole('button', { name: /^Start$/ }).click();
    });
    expect(screen.getByRole('button', { name: /^Step$/ })).toBeDisabled();
  });

  it('persists tick rate across mounts', () => {
    const { unmount } = render(<TheClock />);
    const slider = screen.getByLabelText(/Tick rate in milliseconds/);
    act(() => {
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      // Use fireEvent-style change instead.
    });
    // Easier path: set value directly via the change handler.
    // (testing-library's user-event API is a bigger lift here than warranted.)
    act(() => {
      const newSlider = slider as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )!.set!;
      setter.call(newSlider, '1000');
      newSlider.dispatchEvent(new Event('input', { bubbles: true }));
      newSlider.dispatchEvent(new Event('change', { bubbles: true }));
    });
    unmount();

    render(<TheClock />);
    expect(screen.getByLabelText(/Tick rate in milliseconds/)).toHaveValue('1000');
  });
});
