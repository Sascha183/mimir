import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import TheStepper from './TheStepper';

function getRow(label: string): HTMLElement {
  return screen.getByRole('row', { name: new RegExp(`^${label} timeline$`) });
}
function tickAt(row: HTMLElement, i: number): HTMLElement {
  return within(row).getAllByRole('cell')[i];
}
function clickStep(n = 1) {
  for (let i = 0; i < n; i++) {
    act(() => {
      screen.getByRole('button', { name: /^Step$/ }).click();
    });
  }
}

describe('TheStepper', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders three timeline rows: clk (28 ticks), clk_s (28 ticks), step (7 cells)', () => {
    render(<TheStepper />);
    expect(within(getRow('clk')).getAllByRole('cell')).toHaveLength(28);
    expect(within(getRow('clk_s')).getAllByRole('cell')).toHaveLength(28);
    expect(within(getRow('step')).getAllByRole('cell')).toHaveLength(7);
  });

  it('clk_s pulses occur at phase 2 of each period — 7 pulses total over 28 ticks', () => {
    render(<TheStepper />);
    const row = getRow('clk_s');
    let onCount = 0;
    for (let i = 0; i < 28; i++) {
      if (tickAt(row, i).getAttribute('data-on') === 'true') {
        onCount += 1;
        expect(i % 4).toBe(2);
      }
    }
    expect(onCount).toBe(7);
  });

  it('starts at step 1 (stepIdx 0) with the first stepper cell active', () => {
    render(<TheStepper />);
    expect(screen.getByLabelText('current step')).toHaveTextContent('1');
    const stepRow = getRow('step');
    expect(tickAt(stepRow, 0)).toHaveAttribute('data-active', 'true');
    expect(tickAt(stepRow, 0)).toHaveAttribute('data-on', 'true');
  });

  it('stepper advances every 4 timeline ticks (one clock period)', () => {
    render(<TheStepper />);
    // After 4 step button presses the stepper should be at step 2.
    clickStep(4);
    expect(screen.getByLabelText('current step')).toHaveTextContent('2');
    clickStep(4);
    expect(screen.getByLabelText('current step')).toHaveTextContent('3');
  });

  it('phase labels match step ranges: 1-3 fetch, 4-6 execute, 7 reset', () => {
    render(<TheStepper />);
    // Step 1.
    expect(screen.getByLabelText('current step').parentElement).toHaveTextContent(
      /step\s+1\s+of\s+7\s+\(fetch\)/,
    );
    // Advance to step 4.
    clickStep(12);
    expect(screen.getByLabelText('current step').parentElement).toHaveTextContent(
      /step\s+4\s+of\s+7\s+\(execute\)/,
    );
    // Advance to step 7.
    clickStep(12);
    expect(screen.getByLabelText('current step').parentElement).toHaveTextContent(
      /step\s+7\s+of\s+7\s+\(reset\)/,
    );
  });

  it('after step 7, the stepper wraps back to step 1 on the next clk_s pulse', () => {
    render(<TheStepper />);
    // 28 ticks brings tick back to 0 → step 1.
    clickStep(28);
    expect(screen.getByLabelText('current step')).toHaveTextContent('1');
  });

  it('only one stepper cell is active at any moment', () => {
    render(<TheStepper />);
    const stepRow = getRow('step');
    const checkOneActive = () => {
      const active = within(stepRow)
        .getAllByRole('cell')
        .filter((c) => c.getAttribute('data-active') === 'true');
      expect(active).toHaveLength(1);
    };
    // Sample several positions across one full instruction cycle.
    [0, 5, 12, 16, 23, 27].forEach((target) => {
      act(() => {
        screen.getByRole('button', { name: /^Reset$/ }).click();
      });
      clickStep(target);
      checkOneActive();
    });
  });

  it('Start runs the timeline; Pause stops; Step is disabled while running', () => {
    render(<TheStepper />);
    act(() => {
      screen.getByRole('button', { name: /^Start$/ }).click();
    });
    expect(screen.getByRole('button', { name: /^Step$/ })).toBeDisabled();
    // Default rate 500ms, advance ~5 intervals.
    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(screen.getByLabelText('current tick')).toHaveTextContent('5');
    act(() => {
      screen.getByRole('button', { name: /^Pause$/ }).click();
    });
    expect(screen.getByRole('button', { name: /^Step$/ })).toBeEnabled();
  });

  it('Reset returns to tick 0 and step 1', () => {
    render(<TheStepper />);
    clickStep(10);
    act(() => {
      screen.getByRole('button', { name: /^Reset$/ }).click();
    });
    expect(screen.getByLabelText('current tick')).toHaveTextContent('0');
    expect(screen.getByLabelText('current step')).toHaveTextContent('1');
  });
});
