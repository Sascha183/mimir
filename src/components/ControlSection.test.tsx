import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import ControlSection from './ControlSection';
import { RECIPES, findRecipe } from '../lib/cpu/recipes';

function rowAt(i: number): HTMLElement {
  const row = document.querySelector(`tr[data-step="${i}"]`);
  if (!row) throw new Error(`No row at step ${i}`);
  return row as HTMLElement;
}

function clickStep(n = 1) {
  for (let i = 0; i < n; i++) {
    act(() => {
      screen.getByRole('button', { name: /^Step$/ }).click();
    });
  }
}

describe('cpu/recipes', () => {
  it('every recipe has 7 steps', () => {
    for (const r of RECIPES) {
      expect(r.steps).toHaveLength(7);
    }
  });

  it('the FETCH steps (1-3) are identical across all recipes', () => {
    const ref = RECIPES[0].steps.slice(0, 3);
    for (const r of RECIPES) {
      expect(r.steps.slice(0, 3)).toEqual(ref);
    }
  });

  it('step 7 is always reset', () => {
    for (const r of RECIPES) {
      expect(r.steps[6]).toHaveLength(1);
      expect(r.steps[6][0].kind).toBe('misc');
    }
  });

  it('ADD R2,R3 has the documented execute steps', () => {
    const r = findRecipe('add');
    // Step 4: enable R2, set TMP
    expect(r.steps[3]).toEqual([
      { kind: 'enable', label: 'R2' },
      { kind: 'set', label: 'TMP' },
    ]);
    // Step 5: enable R3, ALU=ADD, set ACC
    expect(r.steps[4]).toEqual([
      { kind: 'enable', label: 'R3' },
      { kind: 'alu', label: 'ADD' },
      { kind: 'set', label: 'ACC' },
    ]);
    // Step 6: enable ACC, set R3
    expect(r.steps[5]).toEqual([
      { kind: 'enable', label: 'ACC' },
      { kind: 'set', label: 'R3' },
    ]);
  });
});

describe('ControlSection', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders 7 step rows for the default instruction', () => {
    render(<ControlSection />);
    for (let i = 0; i < 7; i++) {
      expect(rowAt(i)).toBeInTheDocument();
    }
  });

  it('starts at step 1 with that row marked active', () => {
    render(<ControlSection />);
    expect(rowAt(0)).toHaveAttribute('data-active', 'true');
    expect(rowAt(1)).toHaveAttribute('data-active', 'false');
  });

  it('Step advances the active row by one', () => {
    render(<ControlSection />);
    clickStep(3);
    expect(rowAt(3)).toHaveAttribute('data-active', 'true');
    expect(rowAt(2)).toHaveAttribute('data-active', 'false');
  });

  it('wraps from step 7 back to step 1', () => {
    render(<ControlSection />);
    clickStep(7);
    expect(rowAt(0)).toHaveAttribute('data-active', 'true');
  });

  it('switching instruction resets to step 1 and updates the action chips', () => {
    render(<ControlSection />);
    clickStep(4);
    expect(rowAt(4)).toHaveAttribute('data-active', 'true');

    act(() => {
      screen.getByRole('radio', { name: /^JMPR R0$/ }).click();
    });

    // Reset to step 1.
    expect(rowAt(0)).toHaveAttribute('data-active', 'true');
    // JMPR's step 4 has just two chips (enable R0, set IAR);
    // ADD's step 4 had two as well but R2/TMP. Verify the labels changed.
    const step4 = rowAt(3);
    expect(within(step4).getByText('R0')).toBeInTheDocument();
    expect(within(step4).getByText('IAR')).toBeInTheDocument();
  });

  it('JMPR shows "nothing" placeholder for unused execute steps', () => {
    render(<ControlSection />);
    act(() => {
      screen.getByRole('radio', { name: /^JMPR R0$/ }).click();
    });
    // Steps 5 and 6 are empty for JMPR.
    expect(within(rowAt(4)).getByText(/nothing/i)).toBeInTheDocument();
    expect(within(rowAt(5)).getByText(/nothing/i)).toBeInTheDocument();
  });

  it('Start runs an interval; Step is disabled while running', () => {
    render(<ControlSection />);
    act(() => {
      screen.getByRole('button', { name: /^Start$/ }).click();
    });
    expect(screen.getByRole('button', { name: /^Step$/ })).toBeDisabled();
    // Default rate 1500ms.
    act(() => {
      vi.advanceTimersByTime(1600);
    });
    expect(rowAt(1)).toHaveAttribute('data-active', 'true');
  });

  it('Reset returns to step 1 and pauses', () => {
    render(<ControlSection />);
    clickStep(5);
    act(() => {
      screen.getByRole('button', { name: /^Reset$/ }).click();
    });
    expect(rowAt(0)).toHaveAttribute('data-active', 'true');
  });

  it('persists rate and instruction across mounts', () => {
    const { unmount } = render(<ControlSection />);
    act(() => {
      screen.getByRole('radio', { name: /^LOAD R0, R1$/ }).click();
    });
    unmount();

    render(<ControlSection />);
    expect(screen.getByRole('radio', { name: /^LOAD R0, R1$/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });
});
