import { describe, it, expect, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import InstructionCycle from './InstructionCycle';

function clickStep(n = 1) {
  for (let i = 0; i < n; i++) {
    act(() => {
      screen.getByRole('button', { name: /^Step$/ }).click();
    });
  }
}

function clickReset() {
  act(() => {
    screen.getByRole('button', { name: /^Reset$/ }).click();
  });
}

function getRegisterValue(name: string): string {
  return screen.getByLabelText(`${name} value`).textContent ?? '';
}

describe('InstructionCycle', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders all 9 registers', () => {
    render(<InstructionCycle />);
    ['IAR', 'MAR', 'IR', 'TMP', 'ACC', 'R0', 'R1', 'R2', 'R3'].forEach((name) => {
      expect(screen.getByLabelText(`${name} value`)).toBeInTheDocument();
    });
  });

  it('starts on the ADD preset with R2=5, R3=3', () => {
    render(<InstructionCycle />);
    expect(getRegisterValue('R2')).toBe('5');
    expect(getRegisterValue('R3')).toBe('3');
  });

  it('a full 7-step cycle of ADD produces R3 = 8', () => {
    render(<InstructionCycle />);
    clickStep(7);
    expect(getRegisterValue('R3')).toBe('8');
    expect(getRegisterValue('IAR')).toBe('1');
  });

  it('switching to LOAD resets state and shows the LOAD preset values', () => {
    render(<InstructionCycle />);
    clickStep(3);
    act(() => {
      screen.getByRole('radio', { name: /^LOAD R0, R1$/ }).click();
    });
    expect(getRegisterValue('R0')).toBe('7');
    expect(getRegisterValue('R1')).toBe('0');
  });

  it('LOAD full cycle puts RAM[7]=99 into R1', () => {
    render(<InstructionCycle />);
    act(() => {
      screen.getByRole('radio', { name: /^LOAD R0, R1$/ }).click();
    });
    clickStep(7);
    expect(getRegisterValue('R1')).toBe('99');
  });

  it('JMPR full cycle redirects IAR to R0=12', () => {
    render(<InstructionCycle />);
    act(() => {
      screen.getByRole('radio', { name: /^JMPR R0$/ }).click();
    });
    clickStep(7);
    expect(getRegisterValue('IAR')).toBe('12');
  });

  it('Reset returns to the preset initial state', () => {
    render(<InstructionCycle />);
    clickStep(7);
    expect(getRegisterValue('R3')).toBe('8');
    clickReset();
    expect(getRegisterValue('R3')).toBe('3');
    expect(getRegisterValue('IAR')).toBe('0');
  });

  it('the active stepper cell tracks the simulator state', () => {
    render(<InstructionCycle />);
    // Initial: cell 0 active.
    expect(
      document.querySelector('[data-stepper-cell="0"][data-active="true"]'),
    ).not.toBeNull();
    clickStep(3);
    expect(
      document.querySelector('[data-stepper-cell="3"][data-active="true"]'),
    ).not.toBeNull();
  });

  it('a register being "set" by the active step is marked data-state="set"', () => {
    render(<InstructionCycle />);
    // Step 1 of ADD's recipe sets MAR (and others). Before pressing Step, the
    // current actions are step 1's, so MAR's box should be in 'set' state.
    expect(
      document.querySelector('[data-register="MAR"][data-state="set"]'),
    ).not.toBeNull();
  });

  it('persists selected instruction across mounts', () => {
    const { unmount } = render(<InstructionCycle />);
    act(() => {
      screen.getByRole('radio', { name: /^JMPR R0$/ }).click();
    });
    unmount();
    render(<InstructionCycle />);
    expect(screen.getByRole('radio', { name: /^JMPR R0$/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(getRegisterValue('R0')).toBe('12');
  });
});
